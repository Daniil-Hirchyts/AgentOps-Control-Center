//! Opaque refresh tokens: 32 random bytes (hex) in an HttpOnly cookie, SHA-256 stored in DB, rotated on use.

use chrono::{Duration, Utc};
use sha2::{Digest, Sha256};
use sqlx::PgPool;

use crate::error::{AppError, AppResult};

pub const COOKIE_NAME: &str = "agentops_refresh";
pub const COOKIE_PATH: &str = "/api/auth";

pub fn generate_token() -> String {
    let bytes: [u8; 32] = rand::random();
    hex::encode(bytes)
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Create and persist a new refresh token; returns the raw token for the cookie.
pub async fn issue(db: &PgPool, user_id: i64, ttl_seconds: i64) -> AppResult<String> {
    let token = generate_token();
    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(hash_token(&token))
        .bind(Utc::now() + Duration::seconds(ttl_seconds))
        .execute(db)
        .await?;
    Ok(token)
}

/// Atomically consume a refresh token and issue its replacement. Returns `(user_id, new_token)`.
/// Presenting an already-revoked token revokes every token of that user (reuse detection).
pub async fn rotate(db: &PgPool, token: &str, ttl_seconds: i64) -> AppResult<(i64, String)> {
    let hash = hash_token(token);
    let mut tx = db.begin().await?;
    let consumed: Option<(i64,)> = sqlx::query_as(
        "UPDATE refresh_tokens SET revoked_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
         RETURNING user_id",
    )
    .bind(&hash)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((user_id,)) = consumed else {
        tx.rollback().await?;
        let reused: Option<(i64,)> = sqlx::query_as(
            "SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NOT NULL",
        )
        .bind(&hash)
        .fetch_optional(db)
        .await?;
        if let Some((uid,)) = reused {
            tracing::warn!(
                user_id = uid,
                "refresh token reuse detected; revoking all sessions"
            );
            revoke_all(db, uid).await?;
        }
        return Err(AppError::Unauthorized("invalid refresh token".into()));
    };
    let new_token = generate_token();
    sqlx::query("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(hash_token(&new_token))
        .bind(Utc::now() + Duration::seconds(ttl_seconds))
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok((user_id, new_token))
}

pub async fn revoke(db: &PgPool, token: &str) -> AppResult<()> {
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    )
    .bind(hash_token(token))
    .execute(db)
    .await?;
    Ok(())
}

pub async fn revoke_all(db: &PgPool, user_id: i64) -> AppResult<()> {
    sqlx::query(
        "UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}
