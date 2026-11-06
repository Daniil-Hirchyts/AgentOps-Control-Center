//! Authentication & authorisation.

pub mod handlers;
pub mod jwt;
pub mod password;
pub mod refresh;

use axum::extract::FromRequestParts;
use axum::http::HeaderMap;
use axum::http::header::{AUTHORIZATION, HOST, ORIGIN};
use axum::http::request::Parts;

use crate::config::Config;
use crate::domain::Role;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Authenticated caller, extracted from `Authorization: Bearer <access JWT>`.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: i64,
    pub role: Role,
    pub username: String,
}

impl AuthUser {
    pub fn require_role(&self, role: Role) -> AppResult<()> {
        if self.role == role {
            Ok(())
        } else {
            Err(AppError::Forbidden(format!(
                "this action requires the {role} role"
            )))
        }
    }
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> AppResult<Self> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(AppError::unauthorized)?;
        let token = header
            .strip_prefix("Bearer ")
            .or_else(|| header.strip_prefix("bearer "))
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .ok_or_else(AppError::unauthorized)?;
        let claims = state.jwt.verify(token, jwt::AUD_API)?;
        Ok(AuthUser {
            id: claims.user_id()?,
            role: claims.role,
            username: claims.username,
        })
    }
}

/// Origin policy shared by WebSocket upgrades and cookie-authenticated endpoints.
///
/// * No `Origin` header (non-browser client) → allowed.
/// * Origin in `ALLOWED_ORIGINS` → allowed.
/// * Origin whose `host[:port]` equals the request `Host` header (same-origin) → allowed.
pub fn origin_allowed(config: &Config, headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(ORIGIN) else {
        return true;
    };
    let Ok(origin) = origin.to_str() else {
        return false;
    };
    let origin = origin.trim_end_matches('/');
    if config.allowed_origins.iter().any(|o| o == origin) {
        return true;
    }
    let host_part = origin
        .strip_prefix("http://")
        .or_else(|| origin.strip_prefix("https://"));
    match (host_part, headers.get(HOST).and_then(|h| h.to_str().ok())) {
        (Some(o), Some(host)) => o.eq_ignore_ascii_case(host),
        _ => false,
    }
}
