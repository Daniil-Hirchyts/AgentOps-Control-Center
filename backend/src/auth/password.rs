//! Argon2id password hashing (run on the blocking pool).

use std::sync::LazyLock;

use argon2::Argon2;
use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};

use crate::error::{AppError, AppResult};

/// Synchronous hash; prefer [`hash_password`] from async code.
pub fn hash_password_blocking(password: &str) -> Result<String, String> {
    let hash: PasswordHash = Argon2::default()
        .hash_password(password.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(hash.to_string())
}

/// Synchronous verify; returns false on mismatch or malformed hash.
pub fn verify_password_blocking(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(_) => false,
    }
}

pub async fn hash_password(password: String) -> AppResult<String> {
    tokio::task::spawn_blocking(move || hash_password_blocking(&password))
        .await
        .map_err(AppError::internal)?
        .map_err(AppError::internal)
}

pub async fn verify_password(password: String, hash: String) -> AppResult<bool> {
    tokio::task::spawn_blocking(move || verify_password_blocking(&password, &hash))
        .await
        .map_err(AppError::internal)
}

/// Hash of a random secret; verified against on unknown usernames to equalise login timing.
static DUMMY_HASH: LazyLock<String> = LazyLock::new(|| {
    let secret: [u8; 16] = rand::random();
    hash_password_blocking(&hex::encode(secret)).unwrap_or_default()
});

pub async fn dummy_verify(password: String) {
    let _ = tokio::task::spawn_blocking(move || {
        verify_password_blocking(&password, &DUMMY_HASH);
    })
    .await;
}
