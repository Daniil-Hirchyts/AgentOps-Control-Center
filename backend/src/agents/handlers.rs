//! `/api/agent-runs` handlers.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

use super::{AgentRunDto, RUN_SELECT, RunRow, find_run, load_dto, service, to_dtos};
use crate::auth::AuthUser;
use crate::cases;
use crate::domain::{Role, RunStatus};
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::{ApiJson, ApiPath, ApiQuery};
use crate::pagination::{DEFAULT_LIMIT, MAX_LIMIT, Page};
use crate::state::AppState;
use crate::users;

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRunRequest {
    pub case_id: i64,
    /// Must be a REVIEWER different from the caller.
    pub reviewer_id: i64,
}

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct RunListParams {
    pub status: Option<RunStatus>,
    pub case_id: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

/// Start an agent run on an owned case (OPERATOR). Processing is asynchronous.
#[utoipa::path(
    post, path = "/api/agent-runs", tag = "agent-runs",
    security(("bearer" = [])),
    request_body = CreateRunRequest,
    responses(
        (status = 202, description = "Run accepted (PENDING)", body = AgentRunDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
        (status = 422, body = ErrorBody),
    )
)]
pub async fn create_run(
    State(state): State<AppState>,
    user: AuthUser,
    ApiJson(req): ApiJson<CreateRunRequest>,
) -> AppResult<(StatusCode, Json<AgentRunDto>)> {
    user.require_role(Role::Operator)?;
    let case = cases::find_case(&state.db, req.case_id)
        .await?
        .ok_or_else(|| AppError::not_found("case"))?;
    if case.created_by != user.id {
        return Err(AppError::Forbidden("you do not own this case".into()));
    }
    let reviewer = users::find_by_id(&state.db, req.reviewer_id).await?;
    match reviewer {
        Some(r) if r.role == Role::Reviewer && r.id != user.id => {}
        _ => {
            return Err(AppError::validation(
                "reviewerId must reference a REVIEWER other than yourself",
            ));
        }
    }
    let snapshot = serde_json::to_value(&case.input_data.0).map_err(AppError::internal)?;
    let run_id = service::create_run(&state, user.id, case.id, req.reviewer_id, &snapshot).await?;
    // Load the PENDING snapshot before the worker can move the run forward,
    // so the 202 response always reflects the accepted (not yet processed) state.
    let dto = load_dto(&state.db, run_id).await;
    service::spawn_worker(&state, run_id);
    Ok((StatusCode::ACCEPTED, Json(dto?)))
}

/// List runs: operators see runs they created, reviewers see runs assigned to them.
#[utoipa::path(
    get, path = "/api/agent-runs", tag = "agent-runs",
    security(("bearer" = [])),
    params(RunListParams),
    responses((status = 200, body = Page<AgentRunDto>), (status = 401, body = ErrorBody))
)]
pub async fn list_runs(
    State(state): State<AppState>,
    user: AuthUser,
    ApiQuery(p): ApiQuery<RunListParams>,
) -> AppResult<Json<Page<AgentRunDto>>> {
    let limit = p.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);
    let offset = p.offset.unwrap_or(0).max(0);
    let owner_col = match user.role {
        Role::Operator => "r.created_by",
        Role::Reviewer => "r.reviewer_id",
    };
    let filter = format!(
        "WHERE {owner_col} = $1 AND ($2::text IS NULL OR r.status = $2)
           AND ($3::bigint IS NULL OR r.case_id = $3)"
    );
    let status = p.status.map(|s| s.as_str());
    let rows = sqlx::query_as::<_, RunRow>(&format!(
        "{RUN_SELECT} {filter} ORDER BY r.id DESC LIMIT $4 OFFSET $5"
    ))
    .bind(user.id)
    .bind(status)
    .bind(p.case_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let (total,): (i64,) = sqlx::query_as(&format!("SELECT count(*) FROM agent_runs r {filter}"))
        .bind(user.id)
        .bind(status)
        .bind(p.case_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(Page {
        items: to_dtos(&state.db, rows).await?,
        total,
        limit,
        offset,
    }))
}

/// Get a run (creator or assigned reviewer).
#[utoipa::path(
    get, path = "/api/agent-runs/{id}", tag = "agent-runs",
    security(("bearer" = [])),
    params(("id" = i64, Path)),
    responses(
        (status = 200, body = AgentRunDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
    )
)]
pub async fn get_run(
    State(state): State<AppState>,
    user: AuthUser,
    ApiPath(id): ApiPath<i64>,
) -> AppResult<Json<AgentRunDto>> {
    let row = find_run(&state.db, id)
        .await?
        .ok_or_else(|| AppError::not_found("agent run"))?;
    if row.created_by != user.id && row.reviewer_id != user.id {
        return Err(AppError::forbidden());
    }
    Ok(Json(to_dtos(&state.db, vec![row]).await?.remove(0)))
}
