//! `/api/auth/*` handlers.

use axum::Json;
use axum::extract::State;
use axum::http::header::{COOKIE, SET_COOKIE};
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::{AuthUser, origin_allowed, password, refresh};
use crate::error::{AppError, AppResult, ErrorBody};
use crate::extract::ApiJson;
use crate::state::AppState;
use crate::users::{self, UserDto};

pub const CSRF_HEADER: &str = "x-requested-with";
pub const CSRF_VALUE: &str = "agentops";

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub access_token: String,
    /// Always "Bearer"
    pub token_type: String,
    /// Access token lifetime in seconds
    pub expires_in: i64,
    pub user: UserDto,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WsTicket {
    /// Short-lived JWT (aud `ws`) for `/ws/messages?ticket=`; single use.
    pub ticket: String,
    pub expires_in: i64,
}

fn refresh_cookie(state: &AppState, value: &str, max_age: i64) -> HeaderValue {
    let secure = if state.config.cookie_secure {
        "; Secure"
    } else {
        ""
    };
    let cookie = format!(
        "{}={value}; Path={}; HttpOnly; SameSite=Strict; Max-Age={max_age}{secure}",
        refresh::COOKIE_NAME,
        refresh::COOKIE_PATH
    );
    HeaderValue::from_str(&cookie).expect("cookie header is ASCII")
}

fn read_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(k, _)| *k == refresh::COOKIE_NAME)
        .map(|(_, v)| v.to_string())
        .filter(|v| !v.is_empty())
}

/// CSRF mitigation for cookie-authenticated endpoints (in addition to SameSite=Strict).
fn check_csrf(state: &AppState, headers: &HeaderMap) -> AppResult<()> {
    let ok = headers
        .get(CSRF_HEADER)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v == CSRF_VALUE);
    if !ok {
        return Err(AppError::Forbidden(
            "missing X-Requested-With: agentops header".into(),
        ));
    }
    if !origin_allowed(&state.config, headers) {
        return Err(AppError::Forbidden("origin not allowed".into()));
    }
    Ok(())
}

async fn login_response(
    state: &AppState,
    user: &users::UserRow,
    refresh_token: &str,
) -> AppResult<Response> {
    let access = state.jwt.issue_access(user.id, user.role, &user.username)?;
    let body = LoginResponse {
        access_token: access,
        token_type: "Bearer".into(),
        expires_in: state.config.access_ttl_seconds,
        user: UserDto::from_row(user, &state.hub),
    };
    let mut resp = Json(body).into_response();
    resp.headers_mut().insert(
        SET_COOKIE,
        refresh_cookie(state, refresh_token, state.config.refresh_ttl_seconds),
    );
    Ok(resp)
}

/// Log in with username/password. Sets the HttpOnly refresh cookie.
#[utoipa::path(
    post, path = "/api/auth/login", tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, body = LoginResponse, headers(("Set-Cookie" = String, description = "agentops_refresh cookie"))),
        (status = 401, description = "Invalid credentials", body = ErrorBody),
    )
)]
pub async fn login(
    State(state): State<AppState>,
    ApiJson(req): ApiJson<LoginRequest>,
) -> AppResult<Response> {
    let invalid = || AppError::Unauthorized("invalid username or password".into());
    if req.password.len() > 1024 || req.username.len() > 64 {
        return Err(invalid());
    }
    let Some(user) = users::find_by_username(&state.db, req.username.trim()).await? else {
        // Same work as a real verification so timing does not reveal account existence.
        password::dummy_verify(req.password).await;
        return Err(invalid());
    };
    if !password::verify_password(req.password, user.password_hash.clone()).await? {
        tracing::info!(user_id = user.id, "failed login");
        return Err(invalid());
    }
    let token = refresh::issue(&state.db, user.id, state.config.refresh_ttl_seconds).await?;
    tracing::info!(user_id = user.id, "login");
    login_response(&state, &user, &token).await
}

/// Exchange the refresh cookie for a new access token (rotates the cookie).
#[utoipa::path(
    post, path = "/api/auth/refresh", tag = "auth",
    params(("X-Requested-With" = String, Header, description = "must be `agentops`")),
    responses(
        (status = 200, body = LoginResponse),
        (status = 401, body = ErrorBody),
        (status = 403, description = "CSRF header missing or bad Origin", body = ErrorBody),
    )
)]
pub async fn refresh_token(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> AppResult<Response> {
    check_csrf(&state, &headers)?;
    let token = read_refresh_cookie(&headers).ok_or_else(AppError::unauthorized)?;
    let (user_id, new_token) =
        refresh::rotate(&state.db, &token, state.config.refresh_ttl_seconds).await?;
    let user = users::find_by_id(&state.db, user_id)
        .await?
        .ok_or_else(AppError::unauthorized)?;
    login_response(&state, &user, &new_token).await
}

/// Revoke the refresh token and clear the cookie.
#[utoipa::path(
    post, path = "/api/auth/logout", tag = "auth",
    params(("X-Requested-With" = String, Header, description = "must be `agentops`")),
    responses(
        (status = 204, description = "Logged out"),
        (status = 403, body = ErrorBody),
    )
)]
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> AppResult<Response> {
    check_csrf(&state, &headers)?;
    if let Some(token) = read_refresh_cookie(&headers) {
        refresh::revoke(&state.db, &token).await?;
    }
    let mut resp = StatusCode::NO_CONTENT.into_response();
    resp.headers_mut()
        .insert(SET_COOKIE, refresh_cookie(&state, "", 0));
    Ok(resp)
}

/// Current user.
#[utoipa::path(
    get, path = "/api/auth/me", tag = "auth",
    security(("bearer" = [])),
    responses((status = 200, body = UserDto), (status = 401, body = ErrorBody))
)]
pub async fn me(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<UserDto>> {
    let row = users::find_by_id(&state.db, user.id)
        .await?
        .ok_or_else(AppError::unauthorized)?;
    Ok(Json(UserDto::from_row(&row, &state.hub)))
}

/// Issue a short-lived, single-use WebSocket ticket.
#[utoipa::path(
    post, path = "/api/auth/ws-ticket", tag = "auth",
    security(("bearer" = [])),
    responses((status = 200, body = WsTicket), (status = 401, body = ErrorBody))
)]
pub async fn ws_ticket(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<WsTicket>> {
    let ticket = state
        .jwt
        .issue_ws_ticket(user.id, user.role, &user.username)?;
    Ok(Json(WsTicket {
        ticket,
        expires_in: state.config.ws_ticket_ttl_seconds,
    }))
}
