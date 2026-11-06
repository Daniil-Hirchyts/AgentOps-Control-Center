//! OpenAI-compatible adapter against a local stub server, plus an opt-in real LM Studio smoke test.

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use agentops::cases::InvoiceInput;
use agentops::config::{Config, LlmConfig};
use agentops::domain::{ActionName, LlmMode, RiskLevel};
use agentops::llm::openai_compat::OpenAiCompatProvider;
use agentops::llm::{LlmError, LlmProvider};
use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::NaiveDate;
use serde_json::{Value, json};

fn invoice() -> InvoiceInput {
    InvoiceInput {
        invoice_number: "INV-SMOKE-1".into(),
        vendor: "Northwind Logistics GmbH".into(),
        amount: 48_750.0,
        currency: "EUR".into(),
        issue_date: NaiveDate::from_ymd_opt(2026, 10, 28).unwrap(),
        description: "Express freight services (synthetic)".into(),
        historical_average: Some(4_200.0),
    }
}

#[derive(Clone)]
struct Stub {
    content: &'static str,
    calls: Arc<AtomicUsize>,
    schema_calls: Arc<AtomicUsize>,
}

async fn stub_server(content: &'static str) -> (String, Stub) {
    let stub = Stub {
        content,
        calls: Arc::new(AtomicUsize::new(0)),
        schema_calls: Arc::new(AtomicUsize::new(0)),
    };
    let app = Router::new()
        .route(
            "/v1/models",
            get(|| async { Json(json!({"data": [{"id": "stub-model"}, {"id": "other"}]})) }),
        )
        .route(
            "/v1/chat/completions",
            post(|State(s): State<Stub>, Json(body): Json<Value>| async move {
                s.calls.fetch_add(1, Ordering::SeqCst);
                assert_eq!(body["model"], "stub-model");
                if body.get("response_format").is_some() {
                    s.schema_calls.fetch_add(1, Ordering::SeqCst);
                    return (StatusCode::BAD_REQUEST, Json(json!({"error": "response_format unsupported"})));
                }
                (
                    StatusCode::OK,
                    Json(json!({"choices": [{"message": {"role": "assistant", "content": s.content}}]})),
                )
            }),
        )
        .with_state(stub.clone());
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (format!("http://{addr}/v1"), stub)
}

fn cfg(base_url: String) -> LlmConfig {
    LlmConfig {
        provider: "lmstudio".into(),
        base_url,
        model: None,
        api_key: None,
        timeout: Duration::from_secs(5),
        mode: LlmMode::Real,
    }
}

#[tokio::test]
async fn openai_compat_discovers_model_falls_back_and_parses_fences() {
    let (base, stub) = stub_server(
        "Here you go:\n```json\n{\"risk_level\":\"high\",\"reasoning_summary\":\"11.6x average\",\"recommended_action\":\"flag_invoice_for_review\",\"requires_approval\":false}\n```",
    )
    .await;
    let p = OpenAiCompatProvider::new(cfg(base)).unwrap();
    assert_eq!(p.model_id(), "auto");
    let a = p.analyze(&invoice()).await.unwrap();
    assert_eq!(a.risk_level, RiskLevel::High);
    assert_eq!(a.recommended_action, ActionName::FlagInvoiceForReview);
    assert!(a.requires_approval, "backend policy overrides the model");
    assert_eq!(p.model_id(), "stub-model");
    assert_eq!(stub.schema_calls.load(Ordering::SeqCst), 1);
    // second call no longer tries json_schema
    p.analyze(&invoice()).await.unwrap();
    assert_eq!(stub.schema_calls.load(Ordering::SeqCst), 1);
    assert_eq!(stub.calls.load(Ordering::SeqCst), 3);
}

#[tokio::test]
async fn openai_compat_invalid_output_and_unavailable() {
    let (base, _) = stub_server("{\"risk_level\":\"extreme\",\"reasoning_summary\":\"x\",\"recommended_action\":\"wire_money\",\"requires_approval\":true}").await;
    let p = OpenAiCompatProvider::new(cfg(base)).unwrap();
    assert!(matches!(
        p.analyze(&invoice()).await,
        Err(LlmError::InvalidOutput(_))
    ));

    let p = OpenAiCompatProvider::new(cfg("http://127.0.0.1:9/v1".into())).unwrap();
    assert!(matches!(
        p.analyze(&invoice()).await,
        Err(LlmError::ServerUnavailable(_))
    ));
}

/// Opt-in: `LLM_MODE=real cargo test --test llm_tests -- --ignored real_lmstudio_smoke`
#[tokio::test]
#[ignore]
async fn real_lmstudio_smoke() {
    let _ = dotenvy::dotenv();
    if std::env::var("LLM_MODE").as_deref() != Ok("real") {
        eprintln!("skipping: LLM_MODE != real");
        return;
    }
    let config = Config::from_env().expect("config");
    let p = OpenAiCompatProvider::new(config.llm).unwrap();
    let a = p.analyze(&invoice()).await.expect("real LLM analysis");
    eprintln!("model={} analysis={a:?}", p.model_id());
    assert!(!a.reasoning_summary.is_empty());
}
