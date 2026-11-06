//! Router assembly, cross-cutting middleware, health and LLM discovery endpoints.

pub mod openapi;

use axum::extract::{DefaultBodyLimit, State};
use axum::http::{HeaderName, HeaderValue, Method, Request, StatusCode, header};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Serialize;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use utoipa::{OpenApi, ToSchema};
use utoipa_swagger_ui::SwaggerUi;

use crate::auth::{AuthUser, handlers as auth_h};
use crate::domain::{LlmMode, Role};
use crate::error::{AppError, AppResult, ErrorBody};
use crate::llm::openai_compat::discover_models;
use crate::state::AppState;
use crate::{agents, approvals, audit, cases, messaging, users, websocket};

pub const BODY_LIMIT_BYTES: usize = 64 * 1024;

/// Build the full application router (used by `main` and by tests).
pub fn build_app(state: AppState) -> Router {
    let api = Router::new()
        .route("/api/comptes", post(users::create_account))
        .route("/api/auth/login", post(auth_h::login))
        .route("/api/auth/refresh", post(auth_h::refresh_token))
        .route("/api/auth/logout", post(auth_h::logout))
        .route("/api/auth/me", get(auth_h::me))
        .route("/api/auth/ws-ticket", post(auth_h::ws_ticket))
        .route("/api/utilisateurs", get(users::list_users))
        .route(
            "/api/messages/{utilisateur_id}",
            get(messaging::get_conversation),
        )
        .route(
            "/api/cases",
            post(cases::create_case).get(cases::list_cases),
        )
        .route("/api/cases/{id}", get(cases::get_case))
        .route(
            "/api/agent-runs",
            post(agents::handlers::create_run).get(agents::handlers::list_runs),
        )
        .route("/api/agent-runs/{id}", get(agents::handlers::get_run))
        .route("/api/approvals", get(approvals::list_approvals))
        .route("/api/approvals/{id}", get(approvals::get_approval))
        .route("/api/approvals/{id}/decision", post(approvals::decide))
        .route("/api/audit-events", get(audit::list_audit_events))
        .route("/api/health", get(health))
        .route("/api/llm/models", get(llm_models))
        .route("/ws/messages", get(websocket::ws_handler))
        .fallback(fallback)
        .with_state(state.clone());

    let docs = SwaggerUi::new("/api/docs").url("/api/openapi.json", openapi::ApiDoc::openapi());

    Router::new()
        .merge(docs)
        .merge(api)
        .layer(DefaultBodyLimit::max(BODY_LIMIT_BYTES))
        .layer(cors_layer(&state))
        .layer(
            // Span records method + path only: never the query string (WS tickets live there).
            TraceLayer::new_for_http().make_span_with(|req: &Request<_>| {
                tracing::info_span!("http", method = %req.method(), path = %req.uri().path())
            }),
        )
}

fn cors_layer(state: &AppState) -> CorsLayer {
    let origins: Vec<HeaderValue> = state
        .config
        .allowed_origins
        .iter()
        .filter_map(|o| HeaderValue::from_str(o).ok())
        .collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_credentials(true)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static("x-requested-with"),
        ])
}

async fn fallback() -> AppError {
    AppError::NotFound("route not found".into())
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LlmHealth {
    pub mode: LlmMode,
    pub provider: String,
    pub model: String,
    /// null in mock mode (not probed)
    pub reachable: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HealthDto {
    /// "ok" | "degraded"
    pub status: String,
    /// "ok" | "error"
    pub database: String,
    pub llm: LlmHealth,
}

/// Liveness/readiness: checks the database with `SELECT 1`.
#[utoipa::path(
    get, path = "/api/health", tag = "system",
    responses(
        (status = 200, body = HealthDto),
        (status = 503, description = "Database unreachable", body = HealthDto),
    )
)]
pub async fn health(State(state): State<AppState>) -> (StatusCode, Json<HealthDto>) {
    let db_ok = sqlx::query("SELECT 1").execute(&state.db).await.is_ok();
    let cfg = &state.config.llm;
    let reachable = match cfg.mode {
        LlmMode::Mock => None,
        LlmMode::Real => Some(
            discover_models(&state.http, &cfg.base_url, cfg.api_key.as_deref())
                .await
                .is_ok(),
        ),
    };
    let body = HealthDto {
        status: if db_ok { "ok" } else { "degraded" }.into(),
        database: if db_ok { "ok" } else { "error" }.into(),
        llm: LlmHealth {
            mode: cfg.mode,
            provider: cfg.provider.clone(),
            model: state.llm.model_id(),
            reachable,
        },
    };
    let code = if db_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (code, Json(body))
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LlmModelsDto {
    pub mode: LlmMode,
    pub base_url: String,
    pub configured_model: Option<String>,
    pub models: Vec<String>,
    pub reachable: bool,
}

/// Models exposed by the OpenAI-compatible server (`GET {LLM_BASE_URL}/models`). OPERATOR only.
#[utoipa::path(
    get, path = "/api/llm/models", tag = "system",
    security(("bearer" = [])),
    responses(
        (status = 200, body = LlmModelsDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
    )
)]
pub async fn llm_models(
    State(state): State<AppState>,
    user: AuthUser,
) -> AppResult<Json<LlmModelsDto>> {
    user.require_role(Role::Operator)?;
    let cfg = &state.config.llm;
    let (models, reachable) =
        match discover_models(&state.http, &cfg.base_url, cfg.api_key.as_deref()).await {
            Ok(m) => (m, true),
            Err(e) => {
                tracing::debug!(error = %e, "LLM model discovery failed");
                (Vec::new(), false)
            }
        };
    Ok(Json(LlmModelsDto {
        mode: cfg.mode,
        base_url: cfg.base_url.clone(),
        configured_model: cfg.model.clone(),
        models,
        reachable,
    }))
}
