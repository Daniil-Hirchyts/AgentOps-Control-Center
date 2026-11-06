//! User accounts (`POST /api/comptes`) and the directory (`GET /api/utilisateurs`).

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use utoipa::ToSchema;

use crate::auth::{AuthUser, password};
use crate::domain::Role;
use crate::error::{AppError, AppResult, ErrorBody, is_unique_violation};
use crate::extract::ApiJson;
use crate::state::AppState;
use crate::websocket::hub::Hub;

#[derive(Debug, Clone, FromRow)]
pub struct UserRow {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    #[sqlx(try_from = "String")]
    pub role: Role,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub id: i64,
    pub username: String,
    pub role: Role,
    /// Live presence: true when the user holds at least one WebSocket connection.
    pub online: bool,
    pub created_at: DateTime<Utc>,
}

impl UserDto {
    pub fn from_row(row: &UserRow, hub: &Hub) -> Self {
        UserDto {
            id: row.id,
            username: row.username.clone(),
            role: row.role,
            online: hub.is_online(row.id),
            created_at: row.created_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateAccountRequest {
    /// 3–32 chars, `[A-Za-z0-9_.-]`
    pub username: String,
    /// 8–128 chars
    pub password: String,
    /// Defaults to OPERATOR
    pub role: Option<Role>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AccountCreated {
    pub id: i64,
    pub username: String,
    pub role: Role,
    pub created_at: DateTime<Utc>,
}

const USER_COLS: &str = "id, username, password_hash, role, created_at";

pub async fn find_by_username(db: &PgPool, username: &str) -> AppResult<Option<UserRow>> {
    Ok(sqlx::query_as::<_, UserRow>(&format!(
        "SELECT {USER_COLS} FROM users WHERE lower(username) = lower($1)"
    ))
    .bind(username)
    .fetch_optional(db)
    .await?)
}

pub async fn find_by_id(db: &PgPool, id: i64) -> AppResult<Option<UserRow>> {
    Ok(
        sqlx::query_as::<_, UserRow>(&format!("SELECT {USER_COLS} FROM users WHERE id = $1"))
            .bind(id)
            .fetch_optional(db)
            .await?,
    )
}

pub async fn list_all(db: &PgPool) -> AppResult<Vec<UserRow>> {
    Ok(
        sqlx::query_as::<_, UserRow>(&format!("SELECT {USER_COLS} FROM users ORDER BY id"))
            .fetch_all(db)
            .await?,
    )
}

pub fn validate_username(username: &str) -> AppResult<()> {
    let len = username.chars().count();
    if !(3..=32).contains(&len)
        || !username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'))
    {
        return Err(AppError::validation(
            "username must be 3-32 characters of [A-Za-z0-9_.-]",
        ));
    }
    Ok(())
}

pub fn validate_password(password: &str) -> AppResult<()> {
    let len = password.chars().count();
    if !(8..=128).contains(&len) {
        return Err(AppError::validation("password must be 8-128 characters"));
    }
    Ok(())
}

/// Create a user (shared by the API and the seeder).
pub async fn create_user(
    db: &PgPool,
    username: &str,
    password_plain: String,
    role: Role,
) -> AppResult<UserRow> {
    validate_username(username)?;
    validate_password(&password_plain)?;
    let hash = password::hash_password(password_plain).await?;
    sqlx::query_as::<_, UserRow>(&format!(
        "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING {USER_COLS}"
    ))
    .bind(username)
    .bind(hash)
    .bind(role.as_str())
    .fetch_one(db)
    .await
    .map_err(|e| {
        if is_unique_violation(&e) {
            AppError::Conflict("username already taken".into())
        } else {
            e.into()
        }
    })
}

/// Create an account.
#[utoipa::path(
    post, path = "/api/comptes", tag = "users",
    request_body = CreateAccountRequest,
    responses(
        (status = 201, description = "Account created", body = AccountCreated),
        (status = 409, description = "Username taken", body = ErrorBody),
        (status = 422, description = "Validation error", body = ErrorBody),
    )
)]
pub async fn create_account(
    State(state): State<AppState>,
    ApiJson(req): ApiJson<CreateAccountRequest>,
) -> AppResult<(StatusCode, Json<AccountCreated>)> {
    let role = req.role.unwrap_or(Role::Operator);
    let user = create_user(&state.db, req.username.trim(), req.password, role).await?;
    tracing::info!(user_id = user.id, role = %user.role, "account created");
    Ok((
        StatusCode::CREATED,
        Json(AccountCreated {
            id: user.id,
            username: user.username,
            role: user.role,
            created_at: user.created_at,
        }),
    ))
}

/// List all users (including the caller) with live online status.
#[utoipa::path(
    get, path = "/api/utilisateurs", tag = "users",
    security(("bearer" = [])),
    responses(
        (status = 200, body = Vec<UserDto>),
        (status = 401, body = ErrorBody),
    )
)]
pub async fn list_users(
    State(state): State<AppState>,
    _user: AuthUser,
) -> AppResult<Json<Vec<UserDto>>> {
    let rows = list_all(&state.db).await?;
    Ok(Json(
        rows.iter()
            .map(|r| UserDto::from_row(r, &state.hub))
            .collect(),
    ))
}
