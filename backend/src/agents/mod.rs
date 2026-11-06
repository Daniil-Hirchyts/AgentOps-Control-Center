//! Agent runs: DTOs, repository, state transitions, worker, recovery.

pub mod handlers;
pub mod service;
pub mod state_machine;

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::types::Json as SqlJson;
use sqlx::{FromRow, PgConnection, PgPool};
use utoipa::ToSchema;

use crate::approvals::{self, ApprovalDto};
use crate::audit;
use crate::cases::InvoiceInput;
use crate::domain::{LlmMode, RunStatus};
use crate::error::{AppError, AppResult};
use crate::llm::AgentAnalysis;
use crate::websocket::events::{AgentStatusEvent, ServerEvent};
use crate::websocket::hub::Hub;

#[derive(Debug, Clone, FromRow)]
pub struct RunRow {
    pub id: i64,
    pub case_id: i64,
    pub case_title: String,
    #[sqlx(try_from = "String")]
    pub status: RunStatus,
    pub model_identifier: String,
    #[sqlx(try_from = "String")]
    pub llm_mode: LlmMode,
    pub input_snapshot: SqlJson<InvoiceInput>,
    pub output: Option<SqlJson<AgentAnalysis>>,
    pub error: Option<String>,
    pub attempts: i32,
    pub reviewer_id: i64,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub const RUN_SELECT: &str =
    "SELECT r.id, r.case_id, c.title AS case_title, r.status, r.model_identifier,
        r.llm_mode, r.input_snapshot, r.output, r.error, r.attempts, r.reviewer_id, r.created_by,
        r.created_at, r.updated_at
    FROM agent_runs r JOIN cases c ON c.id = r.case_id";

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentRunDto {
    pub id: i64,
    pub case_id: i64,
    pub case_title: String,
    pub status: RunStatus,
    pub model_identifier: String,
    pub llm_mode: LlmMode,
    pub input_snapshot: InvoiceInput,
    pub output: Option<AgentAnalysis>,
    pub error: Option<String>,
    pub attempts: i32,
    pub reviewer_id: i64,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub approval: Option<ApprovalDto>,
}

impl AgentRunDto {
    pub fn from_row(r: RunRow, approval: Option<ApprovalDto>) -> Self {
        AgentRunDto {
            id: r.id,
            case_id: r.case_id,
            case_title: r.case_title,
            status: r.status,
            model_identifier: r.model_identifier,
            llm_mode: r.llm_mode,
            input_snapshot: r.input_snapshot.0,
            output: r.output.map(|o| o.0),
            error: r.error,
            attempts: r.attempts,
            reviewer_id: r.reviewer_id,
            created_by: r.created_by,
            created_at: r.created_at,
            updated_at: r.updated_at,
            approval,
        }
    }
}

pub async fn find_run(db: &PgPool, id: i64) -> AppResult<Option<RunRow>> {
    Ok(
        sqlx::query_as::<_, RunRow>(&format!("{RUN_SELECT} WHERE r.id = $1"))
            .bind(id)
            .fetch_optional(db)
            .await?,
    )
}

/// Attach approvals to run rows.
pub async fn to_dtos(db: &PgPool, rows: Vec<RunRow>) -> AppResult<Vec<AgentRunDto>> {
    let ids: Vec<i64> = rows.iter().map(|r| r.id).collect();
    let mut by_run: HashMap<i64, ApprovalDto> = approvals::find_by_run_ids(db, &ids)
        .await?
        .into_iter()
        .map(|a| (a.agent_run_id, a))
        .collect();
    Ok(rows
        .into_iter()
        .map(|r| {
            let a = by_run.remove(&r.id);
            AgentRunDto::from_row(r, a)
        })
        .collect())
}

pub async fn load_dto(db: &PgPool, id: i64) -> AppResult<AgentRunDto> {
    let row = find_run(db, id)
        .await?
        .ok_or_else(|| AppError::not_found("agent run"))?;
    Ok(to_dtos(db, vec![row]).await?.remove(0))
}

/// Result of a successful transition (enough to publish events).
#[derive(Debug, Clone, FromRow)]
pub struct RunChange {
    pub id: i64,
    pub case_id: i64,
    pub created_by: i64,
    pub reviewer_id: i64,
    #[sqlx(try_from = "String")]
    pub status: RunStatus,
    pub updated_at: DateTime<Utc>,
}

/// Central, race-safe state transition:
/// `UPDATE … WHERE id = $1 AND status = $from`. Returns `None` if the run was not in `from`
/// (e.g. a concurrent transition won). Writes a `run_status_changed` audit event.
pub async fn transition(
    conn: &mut PgConnection,
    run_id: i64,
    from: RunStatus,
    to: RunStatus,
    actor: Option<i64>,
    output: Option<&AgentAnalysis>,
    error: Option<&str>,
) -> AppResult<Option<RunChange>> {
    if !state_machine::can_transition(from, to) {
        return Err(AppError::internal(format!(
            "illegal transition {from} -> {to} for run {run_id}"
        )));
    }
    let change = sqlx::query_as::<_, RunChange>(
        "UPDATE agent_runs
         SET status = $3, updated_at = now(),
             output = COALESCE($4::jsonb, output),
             error = COALESCE($5, error)
         WHERE id = $1 AND status = $2
         RETURNING id, case_id, created_by, reviewer_id, status, updated_at",
    )
    .bind(run_id)
    .bind(from.as_str())
    .bind(to.as_str())
    .bind(output.map(SqlJson))
    .bind(error)
    .fetch_optional(&mut *conn)
    .await?;
    if change.is_some() {
        audit::record(
            &mut *conn,
            Some(run_id),
            actor,
            audit::event::RUN_STATUS_CHANGED,
            serde_json::json!({"from": from, "to": to}),
        )
        .await?;
        tracing::info!(run_id, %from, %to, "run transition");
    }
    Ok(change)
}

/// Publish `agent_status` to the run creator and assigned reviewer.
pub fn publish_status(hub: &Hub, c: &RunChange) {
    hub.send_to_users(
        &[c.created_by, c.reviewer_id],
        &ServerEvent::AgentStatus(AgentStatusEvent {
            run_id: c.id,
            case_id: c.case_id,
            status: c.status,
            updated_at: c.updated_at,
        }),
    );
}
