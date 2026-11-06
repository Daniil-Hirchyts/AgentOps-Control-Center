//! Application error type, rendered as `{"error": {"code", "message"}}` per CONTRACT.md.

use axum::extract::rejection::{JsonRejection, PathRejection, QueryRejection};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use utoipa::ToSchema;

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    Forbidden(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    Validation(String),
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    PayloadTooLarge(String),
    #[error("{0}")]
    RateLimited(String),
    #[error("{0}")]
    LlmUnavailable(String),
    #[error("internal error: {0}")]
    Internal(String),
}

/// Error body: `{"error": {"code": "...", "message": "..."}}`.
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    pub error: ErrorDetail,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorDetail {
    /// snake_case error code (unauthorized, forbidden, not_found, conflict, validation_error, ...)
    pub code: String,
    pub message: String,
}

impl AppError {
    pub fn unauthorized() -> Self {
        Self::Unauthorized("authentication required".into())
    }
    pub fn forbidden() -> Self {
        Self::Forbidden("you are not allowed to perform this action".into())
    }
    pub fn not_found(what: &str) -> Self {
        Self::NotFound(format!("{what} not found"))
    }
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }
    pub fn internal(msg: impl std::fmt::Display) -> Self {
        Self::Internal(msg.to_string())
    }

    pub fn status_and_code(&self) -> (StatusCode, &'static str) {
        match self {
            Self::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "unauthorized"),
            Self::Forbidden(_) => (StatusCode::FORBIDDEN, "forbidden"),
            Self::NotFound(_) => (StatusCode::NOT_FOUND, "not_found"),
            Self::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            Self::Validation(_) => (StatusCode::UNPROCESSABLE_ENTITY, "validation_error"),
            Self::BadRequest(_) => (StatusCode::BAD_REQUEST, "bad_request"),
            Self::PayloadTooLarge(_) => (StatusCode::PAYLOAD_TOO_LARGE, "bad_request"),
            Self::RateLimited(_) => (StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
            Self::LlmUnavailable(_) => (StatusCode::SERVICE_UNAVAILABLE, "llm_unavailable"),
            Self::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "internal"),
        }
    }

    pub fn body(&self) -> ErrorBody {
        let (_, code) = self.status_and_code();
        let message = match self {
            // Never leak internals to clients.
            Self::Internal(_) => "internal server error".to_string(),
            other => other.to_string(),
        };
        ErrorBody {
            error: ErrorDetail {
                code: code.to_string(),
                message,
            },
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, _) = self.status_and_code();
        if let Self::Internal(detail) = &self {
            tracing::error!(error = %detail, "internal error");
        }
        (status, axum::Json(self.body())).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        Self::Internal(format!("database: {e}"))
    }
}

impl From<JsonRejection> for AppError {
    fn from(r: JsonRejection) -> Self {
        match r {
            JsonRejection::JsonDataError(e) => Self::Validation(e.body_text()),
            JsonRejection::JsonSyntaxError(e) => Self::BadRequest(e.body_text()),
            JsonRejection::MissingJsonContentType(e) => Self::BadRequest(e.body_text()),
            other if other.status() == StatusCode::PAYLOAD_TOO_LARGE => {
                Self::PayloadTooLarge("request body too large".into())
            }
            other => Self::BadRequest(other.body_text()),
        }
    }
}

impl From<PathRejection> for AppError {
    fn from(r: PathRejection) -> Self {
        Self::BadRequest(r.body_text())
    }
}

impl From<QueryRejection> for AppError {
    fn from(r: QueryRejection) -> Self {
        Self::BadRequest(r.body_text())
    }
}

/// True when the sqlx error is a unique-constraint violation.
pub fn is_unique_violation(e: &sqlx::Error) -> bool {
    matches!(e, sqlx::Error::Database(db) if db.code().as_deref() == Some("23505"))
}
