//! Invoice cases.

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::types::Json as SqlJson;
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;

use crate::auth::AuthUser;
use crate::domain::{CaseStatus, Role};
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::{ApiJson, ApiPath, ApiQuery};
use crate::pagination::{Page, PageParams};
use crate::state::AppState;

/// Synthetic invoice data analysed by the agent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InvoiceInput {
    pub invoice_number: String,
    pub vendor: String,
    pub amount: f64,
    /// ISO 4217, 3 letters
    pub currency: String,
    /// YYYY-MM-DD
    #[schema(value_type = String, format = Date, example = "2026-10-01")]
    pub issue_date: NaiveDate,
    pub description: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub historical_average: Option<f64>,
}

impl InvoiceInput {
    /// Validate and normalise (trim, uppercase currency).
    pub fn validated(mut self) -> AppResult<Self> {
        self.invoice_number = self.invoice_number.trim().to_string();
        self.vendor = self.vendor.trim().to_string();
        self.description = self.description.trim().to_string();
        self.currency = self.currency.trim().to_ascii_uppercase();
        let n = self.invoice_number.chars().count();
        if !(1..=64).contains(&n) {
            return Err(AppError::validation(
                "invoiceNumber must be 1-64 characters",
            ));
        }
        let v = self.vendor.chars().count();
        if !(1..=200).contains(&v) {
            return Err(AppError::validation("vendor must be 1-200 characters"));
        }
        if self.description.chars().count() > 2000 {
            return Err(AppError::validation(
                "description must be at most 2000 characters",
            ));
        }
        if !self.amount.is_finite() || self.amount <= 0.0 || self.amount >= 1e12 {
            return Err(AppError::validation("amount must be a positive number"));
        }
        if self.currency.len() != 3 || !self.currency.chars().all(|c| c.is_ascii_uppercase()) {
            return Err(AppError::validation("currency must be 3 letters"));
        }
        if let Some(h) = self.historical_average
            && (!h.is_finite() || !(0.0..1e12).contains(&h))
        {
            return Err(AppError::validation(
                "historicalAverage must be a non-negative number",
            ));
        }
        Ok(self)
    }
}

#[derive(Debug, Clone, FromRow)]
pub struct CaseRow {
    pub id: i64,
    pub title: String,
    pub input_data: SqlJson<InvoiceInput>,
    #[sqlx(try_from = "String")]
    pub status: CaseStatus,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CaseDto {
    pub id: i64,
    pub title: String,
    pub invoice: InvoiceInput,
    pub status: CaseStatus,
    pub created_by: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<CaseRow> for CaseDto {
    fn from(r: CaseRow) -> Self {
        CaseDto {
            id: r.id,
            title: r.title,
            invoice: r.input_data.0,
            status: r.status,
            created_by: r.created_by,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateCaseRequest {
    pub title: String,
    pub invoice: InvoiceInput,
}

const CASE_COLS: &str = "id, title, input_data, status, created_by, created_at, updated_at";

pub async fn insert_case(
    db: &PgPool,
    owner: i64,
    title: &str,
    invoice: &InvoiceInput,
) -> AppResult<CaseRow> {
    Ok(sqlx::query_as::<_, CaseRow>(&format!(
        "INSERT INTO cases (title, input_data, created_by) VALUES ($1, $2, $3) RETURNING {CASE_COLS}"
    ))
    .bind(title)
    .bind(SqlJson(invoice))
    .bind(owner)
    .fetch_one(db)
    .await?)
}

pub async fn find_case(db: &PgPool, id: i64) -> AppResult<Option<CaseRow>> {
    Ok(
        sqlx::query_as::<_, CaseRow>(&format!("SELECT {CASE_COLS} FROM cases WHERE id = $1"))
            .bind(id)
            .fetch_optional(db)
            .await?,
    )
}

pub fn validate_title(title: &str) -> AppResult<String> {
    let t = title.trim();
    if !(1..=200).contains(&t.chars().count()) {
        return Err(AppError::validation("title must be 1-200 characters"));
    }
    Ok(t.to_string())
}

/// Create an invoice case (OPERATOR).
#[utoipa::path(
    post, path = "/api/cases", tag = "cases",
    security(("bearer" = [])),
    request_body = CreateCaseRequest,
    responses(
        (status = 201, body = CaseDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 422, body = ErrorBody),
    )
)]
pub async fn create_case(
    State(state): State<AppState>,
    user: AuthUser,
    ApiJson(req): ApiJson<CreateCaseRequest>,
) -> AppResult<(StatusCode, Json<CaseDto>)> {
    user.require_role(Role::Operator)?;
    let title = validate_title(&req.title)?;
    let invoice = req.invoice.validated()?;
    let row = insert_case(&state.db, user.id, &title, &invoice).await?;
    tracing::info!(case_id = row.id, user_id = user.id, "case created");
    Ok((StatusCode::CREATED, Json(row.into())))
}

/// List the caller's own cases (OPERATOR).
#[utoipa::path(
    get, path = "/api/cases", tag = "cases",
    security(("bearer" = [])),
    params(PageParams),
    responses(
        (status = 200, body = Page<CaseDto>),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
    )
)]
pub async fn list_cases(
    State(state): State<AppState>,
    user: AuthUser,
    ApiQuery(page): ApiQuery<PageParams>,
) -> AppResult<Json<Page<CaseDto>>> {
    user.require_role(Role::Operator)?;
    let (limit, offset) = page.resolve();
    let rows = sqlx::query_as::<_, CaseRow>(&format!(
        "SELECT {CASE_COLS} FROM cases WHERE created_by = $1 ORDER BY id DESC LIMIT $2 OFFSET $3"
    ))
    .bind(user.id)
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;
    let (total,): (i64,) = sqlx::query_as("SELECT count(*) FROM cases WHERE created_by = $1")
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(Page {
        items: rows.into_iter().map(Into::into).collect(),
        total,
        limit,
        offset,
    }))
}

/// Get a case: owner OPERATOR, or a REVIEWER assigned to one of its runs.
#[utoipa::path(
    get, path = "/api/cases/{id}", tag = "cases",
    security(("bearer" = [])),
    params(("id" = i64, Path)),
    responses(
        (status = 200, body = CaseDto),
        (status = 401, body = ErrorBody),
        (status = 403, body = ErrorBody),
        (status = 404, body = ErrorBody),
    )
)]
pub async fn get_case(
    State(state): State<AppState>,
    user: AuthUser,
    ApiPath(id): ApiPath<i64>,
) -> AppResult<Json<CaseDto>> {
    let row = find_case(&state.db, id)
        .await?
        .ok_or_else(|| AppError::not_found("case"))?;
    let allowed = match user.role {
        Role::Operator => row.created_by == user.id,
        Role::Reviewer => {
            let (assigned,): (bool,) = sqlx::query_as(
                "SELECT EXISTS (SELECT 1 FROM agent_runs WHERE case_id = $1 AND reviewer_id = $2)",
            )
            .bind(id)
            .bind(user.id)
            .fetch_one(&state.db)
            .await?;
            assigned
        }
    };
    if !allowed {
        return Err(AppError::forbidden());
    }
    Ok(Json(row.into()))
}
