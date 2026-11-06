//! Persisted 1:1 messages and the conversation endpoint.

use axum::Json;
use axum::extract::State;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::{IntoParams, ToSchema};

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::{ApiPath, ApiQuery};
use crate::state::AppState;
use crate::users;

pub const MAX_CONTENT_CHARS: usize = 4000;

#[derive(Debug, Clone, Serialize, ToSchema, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MessageDto {
    pub id: i64,
    #[sqlx(rename = "sender_id")]
    pub expediteur_id: i64,
    #[sqlx(rename = "recipient_id")]
    pub destinataire_id: i64,
    #[sqlx(rename = "content")]
    pub contenu: String,
    #[sqlx(rename = "created_at")]
    pub date_envoi: DateTime<Utc>,
}

/// Validate and normalise (trim) message content.
pub fn normalize_content(raw: &str) -> AppResult<String> {
    let content = raw.trim();
    let len = content.chars().count();
    if len == 0 || len > MAX_CONTENT_CHARS {
        return Err(AppError::validation(format!(
            "contenu must be 1-{MAX_CONTENT_CHARS} characters"
        )));
    }
    Ok(content.to_string())
}

/// Persist a message. Sender identity and timestamp are always server-side.
pub async fn insert_message(
    db: &PgPool,
    sender_id: i64,
    recipient_id: i64,
    content: &str,
) -> AppResult<MessageDto> {
    Ok(sqlx::query_as::<_, MessageDto>(
        "INSERT INTO messages (sender_id, recipient_id, content) VALUES ($1, $2, $3)
         RETURNING id, sender_id, recipient_id, content, created_at",
    )
    .bind(sender_id)
    .bind(recipient_id)
    .bind(content)
    .fetch_one(db)
    .await?)
}

pub async fn conversation(
    db: &PgPool,
    a: i64,
    b: i64,
    limit: i64,
    before_id: Option<i64>,
) -> AppResult<Vec<MessageDto>> {
    let mut rows = sqlx::query_as::<_, MessageDto>(
        "SELECT id, sender_id, recipient_id, content, created_at FROM messages
         WHERE LEAST(sender_id, recipient_id) = LEAST($1::bigint, $2::bigint)
           AND GREATEST(sender_id, recipient_id) = GREATEST($1::bigint, $2::bigint)
           AND ($3::bigint IS NULL OR id < $3)
         ORDER BY id DESC LIMIT $4",
    )
    .bind(a)
    .bind(b)
    .bind(before_id)
    .bind(limit)
    .fetch_all(db)
    .await?;
    rows.reverse();
    Ok(rows)
}

#[derive(Debug, Deserialize, IntoParams)]
#[serde(rename_all = "camelCase")]
#[into_params(parameter_in = Query)]
pub struct ConversationParams {
    /// Max messages (default 200, max 500)
    pub limit: Option<i64>,
    /// Only messages with id < beforeId (pagination backwards)
    pub before_id: Option<i64>,
}

/// Conversation between the caller and another user, ascending by id.
#[utoipa::path(
    get, path = "/api/messages/{utilisateurId}", tag = "messages",
    security(("bearer" = [])),
    params(("utilisateurId" = i64, Path, description = "Other user's id"), ConversationParams),
    responses(
        (status = 200, body = Vec<MessageDto>),
        (status = 401, body = ErrorBody),
        (status = 404, body = ErrorBody),
    )
)]
pub async fn get_conversation(
    State(state): State<AppState>,
    user: AuthUser,
    ApiPath(other_id): ApiPath<i64>,
    ApiQuery(params): ApiQuery<ConversationParams>,
) -> AppResult<Json<Vec<MessageDto>>> {
    if users::find_by_id(&state.db, other_id).await?.is_none() {
        return Err(AppError::not_found("user"));
    }
    let limit = params.limit.unwrap_or(200).clamp(1, 500);
    let rows = conversation(&state.db, user.id, other_id, limit, params.before_id).await?;
    Ok(Json(rows))
}
