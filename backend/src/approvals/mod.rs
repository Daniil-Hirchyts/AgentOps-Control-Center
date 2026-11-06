//! Human-in-the-loop approvals.

use axum::Json;
use axum::extract::State;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::types::Json as SqlJson;
use sqlx::{FromRow, PgPool};
use utoipa::{IntoParams, ToSchema};

use crate::agents::{publish_status, service::execute_approved_run, transition};
use crate::audit::{self, event};
use crate::auth::AuthUser;
use crate::cases::InvoiceInput;
use crate::domain::{ActionName, ApprovalStatus, Decision, RiskLevel, Role, RunStatus};
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::{ApiJson, ApiPath, ApiQuery};
use crate::llm::AgentAnalysis;
use crate::pagination::{DEFAULT_LIMIT, MAX_LIMIT, Page};
use crate::state::AppState;
use crate::websocket::events::{ApprovalResolvedEvent, ServerEvent};

#[derive(Debug, Clone, FromRow)]
struct ApprovalRow {
    id: i64,
    agent_run_id: i64,
    case_id: i64,
    case_title: String,
    reviewer_id: i64,
    reviewer_username: String,
    requested_by: i64,
    requested_by_username: String,
    #[sqlx(try_from = "String")]
    proposed_action: ActionName,
    output: Option<SqlJson<AgentAnalysis>>,
    input_snapshot: SqlJson<InvoiceInput>,
    #[sqlx(try_from = "String")]
    status: ApprovalStatus,
    decision_reason: Option<String>,
    decided_by: Option<i64>,
    created_at: DateTime<Utc>,
    decided_at: Option<DateTime<Utc>>,
}

const APPROVAL_SELECT: &str = "SELECT a.id, a.agent_run_id, r.case_id, c.title AS case_title,
        a.reviewer_id, rv.username AS reviewer_username, r.created_by AS requested_by,
        rq.username AS requested_by_username, a.proposed_action, r.output, r.input_snapshot,
        a.status, a.decision_reason, a.decided_by, a.created_at, a.decided_at
    FROM approvals a
    JOIN agent_runs r ON r.id = a.agent_run_id
    JOIN cases c ON c.id = r.case_id
    JOIN users rv ON rv.id = a.reviewer_id
    JOIN users rq ON rq.id = r.created_by";

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalDto {
    pub id: i64,
    pub agent_run_id: i64,
    pub case_id: i64,
    pub case_title: String,
    pub reviewer_id: i64,
    pub reviewer_username: String,
    pub requested_by: i64,
    pub requested_by_username: String,
    pub proposed_action: ActionName,
    pub risk_level: RiskLevel,
    pub reasoning_summary: String,
    pub invoice: InvoiceInput,
    pub status: ApprovalStatus,
    pub decision_reason: Option<String>,
    pub decided_by: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub decided_at: Option<DateTime<Utc>>,
}

impl From<ApprovalRow> for ApprovalDto {
    fn from(r: ApprovalRow) -> Self {
        let (risk_level, reasoning_summary) = r
            .output
            .map(|o| (o.0.risk_level, o.0.reasoning_summary))
            .unwrap_or((RiskLevel::High, String::new()));
        ApprovalDto {
            id: r.id,
            agent_run_id: r.agent_run_id,
            case_id: r.case_id,
            case_title: r.case_title,
            reviewer_id: r.reviewer_id,
            reviewer_username: r.reviewer_username,
            requested_by: r.requested_by,
            requested_by_username: r.requested_by_username,
            proposed_action: r.proposed_action,
            risk_level,
            reasoning_summary,
            invoice: r.input_snapshot.0,
            status: r.status,
            decision_reason: r.decision_reason,
            decided_by: r.decided_by,
            created_at: r.created_at,
            decided_at: r.decided_at,
        }
    }
}

pub async fn find_by_run_ids(db: &PgPool, run_ids: &[i64]) -> AppResult<Vec<ApprovalDto>> {
    if run_ids.is_empty() {
        return Ok(Vec::new());
    }
    let rows = sqlx::query_as::<_, ApprovalRow>(&format!(
        "{APPROVAL_SELECT} WHERE a.agent_run_id = ANY($1)"
    ))
    .bind(run_ids)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn find_approval(db: &PgPool, id: i64) -> AppResult<Option<ApprovalDto>> {
    Ok(
        sqlx::query_as::<_, ApprovalRow>(&format!("{APPROVAL_SELECT} WHERE a.id = $1"))
            .bind(id)
            .fetch_optional(db)
            .await?
            .map(Into::into),
    )
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DecisionRequest {
    pub decision: Decision,
    /// Optional, at most 1000 characters
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct ApprovalListParams {
    /// Filter by status (default: all)
    pub status: Option<ApprovalStatus>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// List approvals: reviewers see those assigned to them, operators those they requested.
#[utoipa::path(
    get, path = "/api/approvals", tag = "approvals",
    security(("bearer" = [])),
    params(ApprovalListParams),
    responses((status = 200, body = Page<ApprovalDto>), (status = 401, body = ErrorBody))
)]
pub async fn list_approvals(
    State(state): State<AppState>,
    user: AuthUser,
    ApiQuery(p): ApiQuery<ApprovalListParams>,
) -> AppResult<Json<Page<ApprovalDto>>> {
    let limit = p.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let offset = p.offset.unwrap_or(0).max(0);
    let owner_col = match user.role {
        Role::Reviewer => "a.reviewer_id",
        Role::Operator => "r.created_by",
    };
    let filter = format!("WHERE {owner_col} = $1 AND ($2::text IS NULL OR a.status = $2)");
    let status = p.status.map(|s| s.as_str());
    let rows = sqlx::query_as::<_, ApprovalRow>(&format!(
        "{APPROVAL_SELECT} {filter} ORDER BY a.id DESC LIMIT $3 OFFSET $4"
    ))
    .bind(user.id)
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let (total,): (i64,) = sqlx::query_as(&format!(
        "SELECT count(*) FROM approvals a JOIN agent_runs r ON r.id = a.agent_run_id {filter}"
    ))
    .bind(user.id)
    .bind(status)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(Page {
        items: rows.into_iter().map(Into::into).collect(),
        total,
        limit,
        offset,
    }))
}

/// Get an approval (assigned reviewer or requester).
#[utoipa::path(
    get, path = "/api/approvals/{id}", tag = "approvals",
    security(("bearer" = [])),
    params(("id" = i64, Path)),
    responses(
        (status = 200, body = ApprovalDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
    )
)]
pub async fn get_approval(
    State(state): State<AppState>,
    user: AuthUser,
    ApiPath(id): ApiPath<i64>,
) -> AppResult<Json<ApprovalDto>> {
    let a = find_approval(&state.db, id)
        .await?
        .ok_or_else(|| AppError::not_found("approval"))?;
    if a.reviewer_id != user.id && a.requested_by != user.id {
        return Err(AppError::forbidden());
    }
    Ok(Json(a))
}

/// Approve or reject (assigned REVIEWER only). Atomic; a second decision gets 409.
#[utoipa::path(
    post, path = "/api/approvals/{id}/decision", tag = "approvals",
    security(("bearer" = [])),
    params(("id" = i64, Path)),
    request_body = DecisionRequest,
    responses(
        (status = 200, body = ApprovalDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
        (status = 409, description = "Already decided", body = ErrorBody),
        (status = 422, body = ErrorBody),
    )
)]
pub async fn decide(
    State(state): State<AppState>,
    user: AuthUser,
    ApiPath(id): ApiPath<i64>,
    ApiJson(req): ApiJson<DecisionRequest>,
) -> AppResult<Json<ApprovalDto>> {
    user.require_role(Role::Reviewer)?;
    let reason = req
        .reason
        .map(|r| r.trim().to_string())
        .filter(|r| !r.is_empty());
    if reason.as_ref().is_some_and(|r| r.chars().count() > 1000) {
        return Err(AppError::validation(
            "reason must be at most 1000 characters",
        ));
    }
    let new_status = match req.decision {
        Decision::Approve => ApprovalStatus::Approved,
        Decision::Reject => ApprovalStatus::Rejected,
    };

    let mut tx = state.db.begin().await?;
    let updated: Option<(i64, DateTime<Utc>)> = sqlx::query_as(
        "UPDATE approvals
         SET status = $2, decision_reason = $3, decided_by = $4, decided_at = now()
         WHERE id = $1 AND status = 'PENDING' AND reviewer_id = $4
         RETURNING agent_run_id, decided_at",
    )
    .bind(id)
    .bind(new_status.as_str())
    .bind(&reason)
    .bind(user.id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((run_id, decided_at)) = updated else {
        tx.rollback().await?;
        let existing: Option<(i64,)> =
            sqlx::query_as("SELECT reviewer_id FROM approvals WHERE id = $1")
                .bind(id)
                .fetch_optional(&state.db)
                .await?;
        return Err(match existing {
            None => AppError::not_found("approval"),
            Some((reviewer,)) if reviewer != user.id => {
                AppError::Forbidden("you are not the assigned reviewer".into())
            }
            Some(_) => AppError::Conflict("approval already decided".into()),
        });
    };
    audit::record(
        &mut *tx,
        Some(run_id),
        Some(user.id),
        event::APPROVAL_DECIDED,
        json!({"approvalId": id, "decision": req.decision, "status": new_status, "reason": reason}),
    )
    .await?;
    let target = match new_status {
        ApprovalStatus::Approved => RunStatus::Approved,
        _ => RunStatus::Rejected,
    };
    let Some(first) = transition(
        &mut tx,
        run_id,
        RunStatus::AwaitingApproval,
        target,
        Some(user.id),
        None,
        None,
    )
    .await?
    else {
        tx.rollback().await?;
        return Err(AppError::Conflict("run is not awaiting approval".into()));
    };
    let mut changes = vec![first];
    if target == RunStatus::Rejected {
        if let Some(c) = transition(
            &mut tx,
            run_id,
            RunStatus::Rejected,
            RunStatus::Cancelled,
            Some(user.id),
            None,
            None,
        )
        .await?
        {
            changes.push(c);
        }
        audit::record(
            &mut *tx,
            Some(run_id),
            Some(user.id),
            event::ACTION_SKIPPED,
            json!({"approvalId": id, "reason": "rejected by reviewer"}),
        )
        .await?;
    }
    tx.commit().await?;
    tracing::info!(approval_id = id, run_id, status = %new_status, reviewer = user.id, "approval decided");

    let first = &changes[0];
    state.hub.send_to_users(
        &[first.reviewer_id, first.created_by],
        &ServerEvent::ApprovalResolved(ApprovalResolvedEvent {
            approval_id: id,
            run_id,
            status: new_status,
            decided_by: user.id,
            decided_at,
        }),
    );
    for c in &changes {
        publish_status(&state.hub, c);
    }

    if target == RunStatus::Approved
        && let Err(e) = execute_approved_run(&state, run_id, Some(user.id)).await
    {
        // The run stays APPROVED/RUNNING; startup recovery will resume it idempotently.
        tracing::error!(run_id, error = %e, "approved action execution failed");
    }

    let dto = find_approval(&state.db, id)
        .await?
        .ok_or_else(|| AppError::not_found("approval"))?;
    Ok(Json(dto))
}
