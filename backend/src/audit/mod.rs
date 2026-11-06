//! Audit trail (`audit_events`).

use axum::Json;
use axum::extract::State;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgExecutor};
use utoipa::{IntoParams, ToSchema};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::ApiQuery;
use crate::pagination::{DEFAULT_LIMIT, MAX_LIMIT, Page};
use crate::state::AppState;

pub mod event {
    pub const RUN_CREATED: &str = "run_created";
    pub const RUN_STATUS_CHANGED: &str = "run_status_changed";
    pub const LLM_REQUEST: &str = "llm_request";
    pub const LLM_RESPONSE_VALID: &str = "llm_response_valid";
    pub const LLM_RESPONSE_INVALID: &str = "llm_response_invalid";
    pub const LLM_ERROR: &str = "llm_error";
    pub const APPROVAL_REQUESTED: &str = "approval_requested";
    pub const APPROVAL_DECIDED: &str = "approval_decided";
    pub const ACTION_EXECUTED: &str = "action_executed";
    pub const ACTION_SKIPPED: &str = "action_skipped";
    pub const RUN_RECOVERED: &str = "run_recovered";
}

pub async fn record<'e, E: PgExecutor<'e>>(
    db: E,
    agent_run_id: Option<i64>,
    actor_id: Option<i64>,
    event_type: &str,
    payload: Value,
) -> AppResult<()> {
    sqlx::query(
        "INSERT INTO audit_events (agent_run_id, actor_id, event_type, payload) VALUES ($1, $2, $3, $4)",
    )
    .bind(agent_run_id)
    .bind(actor_id)
    .bind(event_type)
    .bind(payload)
    .execute(db)
    .await?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, ToSchema, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AuditEventDto {
    pub id: i64,
    pub agent_run_id: Option<i64>,
    pub actor_id: Option<i64>,
    pub actor_username: Option<String>,
    pub event_type: String,
    #[schema(value_type = Object)]
    pub payload: Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct AuditParams {
    pub agent_run_id: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Audit events for runs the caller may see (creator or assigned reviewer), ascending.
#[utoipa::path(
    get, path = "/api/audit-events", tag = "audit",
    security(("bearer" = [])),
    params(AuditParams),
    responses(
        (status = 200, body = Page<AuditEventDto>),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
    )
)]
pub async fn list_audit_events(
    State(state): State<AppState>,
    user: AuthUser,
    ApiQuery(p): ApiQuery<AuditParams>,
) -> AppResult<Json<Page<AuditEventDto>>> {
    let limit = p.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let offset = p.offset.unwrap_or(0).max(0);
    if let Some(run_id) = p.agent_run_id {
        let owner: Option<(i64, i64)> =
            sqlx::query_as("SELECT created_by, reviewer_id FROM agent_runs WHERE id = $1")
                .bind(run_id)
                .fetch_optional(&state.db)
                .await?;
        match owner {
            None => return Err(AppError::not_found("agent run")),
            Some((c, r)) if c != user.id && r != user.id => return Err(AppError::forbidden()),
            _ => {}
        }
    }
    const VISIBLE: &str = "FROM audit_events e
         JOIN agent_runs r ON r.id = e.agent_run_id
         LEFT JOIN users u ON u.id = e.actor_id
         WHERE (r.created_by = $1 OR r.reviewer_id = $1)
           AND ($2::bigint IS NULL OR e.agent_run_id = $2)";
    let items = sqlx::query_as::<_, AuditEventDto>(&format!(
        "SELECT e.id, e.agent_run_id, e.actor_id, u.username AS actor_username, e.event_type,
                e.payload, e.created_at {VISIBLE} ORDER BY e.id ASC LIMIT $3 OFFSET $4"
    ))
    .bind(user.id)
    .bind(p.agent_run_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let (total,): (i64,) = sqlx::query_as(&format!("SELECT count(*) {VISIBLE}"))
        .bind(user.id)
        .bind(p.agent_run_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(Page {
        items,
        total,
        limit,
        offset,
    }))
}
