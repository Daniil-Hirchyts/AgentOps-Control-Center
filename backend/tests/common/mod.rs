#![allow(dead_code)]

use std::time::Duration;

use agentops::config::Config;
use agentops::{AppState, build_app};
use axum::Router;
use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

pub const PASSWORD: &str = "correct-horse-battery";

pub struct TestApp {
    pub router: Router,
    pub state: AppState,
}

pub struct Resp {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub body: Value,
}

impl TestApp {
    pub fn new(pool: PgPool) -> Self {
        let state = AppState::new(pool, Config::for_tests("unused")).expect("state");
        Self {
            router: build_app(state.clone()),
            state,
        }
    }

    pub async fn send(&self, req: Request<Body>) -> Resp {
        let resp = self.router.clone().oneshot(req).await.expect("oneshot");
        let status = resp.status();
        let headers = resp.headers().clone();
        let bytes = resp.into_body().collect().await.expect("body").to_bytes();
        let body = if bytes.is_empty() {
            Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into()))
        };
        Resp {
            status,
            headers,
            body,
        }
    }

    pub async fn call(
        &self,
        method: Method,
        uri: &str,
        token: Option<&str>,
        body: Option<Value>,
    ) -> Resp {
        let mut b = Request::builder().method(method).uri(uri);
        if let Some(t) = token {
            b = b.header("authorization", format!("Bearer {t}"));
        }
        let req = match body {
            Some(v) => b
                .header("content-type", "application/json")
                .body(Body::from(v.to_string()))
                .unwrap(),
            None => b.body(Body::empty()).unwrap(),
        };
        self.send(req).await
    }

    pub async fn get(&self, uri: &str, token: &str) -> Resp {
        self.call(Method::GET, uri, Some(token), None).await
    }

    pub async fn post(&self, uri: &str, token: &str, body: Value) -> Resp {
        self.call(Method::POST, uri, Some(token), Some(body)).await
    }

    pub async fn register(&self, username: &str, role: &str) -> i64 {
        let r = self
            .call(
                Method::POST,
                "/api/comptes",
                None,
                Some(json!({"username": username, "password": PASSWORD, "role": role})),
            )
            .await;
        assert_eq!(r.status, StatusCode::CREATED, "{:?}", r.body);
        r.body["id"].as_i64().unwrap()
    }

    pub async fn login(&self, username: &str) -> String {
        let r = self
            .call(
                Method::POST,
                "/api/auth/login",
                None,
                Some(json!({"username": username, "password": PASSWORD})),
            )
            .await;
        assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
        r.body["accessToken"].as_str().unwrap().to_string()
    }

    /// Register + login. Returns (id, token).
    pub async fn user(&self, username: &str, role: &str) -> (i64, String) {
        let id = self.register(username, role).await;
        (id, self.login(username).await)
    }

    pub async fn create_case(
        &self,
        token: &str,
        amount: f64,
        avg: Option<f64>,
        description: &str,
    ) -> i64 {
        let mut invoice = json!({
            "invoiceNumber": "INV-T-1",
            "vendor": "Test Vendor",
            "amount": amount,
            "currency": "EUR",
            "issueDate": "2026-10-01",
            "description": description,
        });
        if let Some(a) = avg {
            invoice["historicalAverage"] = json!(a);
        }
        let r = self
            .post(
                "/api/cases",
                token,
                json!({"title": "Test case", "invoice": invoice}),
            )
            .await;
        assert_eq!(r.status, StatusCode::CREATED, "{:?}", r.body);
        r.body["id"].as_i64().unwrap()
    }

    pub async fn start_run(&self, token: &str, case_id: i64, reviewer_id: i64) -> i64 {
        let r = self
            .post(
                "/api/agent-runs",
                token,
                json!({"caseId": case_id, "reviewerId": reviewer_id}),
            )
            .await;
        assert_eq!(r.status, StatusCode::ACCEPTED, "{:?}", r.body);
        assert_eq!(r.body["status"], "PENDING");
        r.body["id"].as_i64().unwrap()
    }

    /// Poll a run until its status is one of `want` (5 s budget).
    pub async fn wait_run(&self, token: &str, run_id: i64, want: &[&str]) -> Value {
        for _ in 0..100 {
            let r = self.get(&format!("/api/agent-runs/{run_id}"), token).await;
            assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
            if want.iter().any(|w| r.body["status"] == *w) {
                return r.body;
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        panic!("run {run_id} never reached {want:?}");
    }

    pub async fn audit_types(&self, token: &str, run_id: i64) -> Vec<String> {
        let r = self
            .get(
                &format!("/api/audit-events?agentRunId={run_id}&limit=200"),
                token,
            )
            .await;
        assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
        r.body["items"]
            .as_array()
            .unwrap()
            .iter()
            .map(|e| e["eventType"].as_str().unwrap().to_string())
            .collect()
    }
}
