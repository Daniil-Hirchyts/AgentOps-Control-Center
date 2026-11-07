//! Runtime configuration loaded from environment variables.

use std::time::Duration;

use crate::domain::LlmMode;

#[derive(Debug, thiserror::Error)]
#[error("configuration error: {0}")]
pub struct ConfigError(pub String);

#[derive(Clone)]
pub struct LlmConfig {
    pub provider: String,
    pub base_url: String,
    pub model: Option<String>,
    pub api_key: Option<String>,
    /// Sent as `reasoning_effort` when set (e.g. `none` to stop a reasoning model from thinking).
    pub reasoning_effort: Option<String>,
    pub timeout: Duration,
    pub mode: LlmMode,
}

/// Application configuration. Intentionally does not implement `Debug` (contains secrets).
#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub bind_addr: String,
    pub allowed_origins: Vec<String>,
    pub jwt_secret: String,
    pub access_ttl_seconds: i64,
    pub refresh_ttl_seconds: i64,
    pub ws_ticket_ttl_seconds: i64,
    pub cookie_secure: bool,
    pub llm: LlmConfig,
}

pub const MIN_JWT_SECRET_LEN: usize = 32;

fn var(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn parse_num<T: std::str::FromStr>(name: &str, default: T) -> Result<T, ConfigError> {
    match var(name) {
        None => Ok(default),
        Some(v) => v
            .parse()
            .map_err(|_| ConfigError(format!("{name} must be a number"))),
    }
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let database_url =
            var("DATABASE_URL").ok_or_else(|| ConfigError("DATABASE_URL is required".into()))?;
        let jwt_secret =
            var("JWT_SECRET").ok_or_else(|| ConfigError("JWT_SECRET is required".into()))?;
        let mode = match var("LLM_MODE").as_deref().unwrap_or("mock") {
            "real" => LlmMode::Real,
            "mock" => LlmMode::Mock,
            other => {
                return Err(ConfigError(format!(
                    "LLM_MODE must be real|mock, got {other}"
                )));
            }
        };
        let cfg = Config {
            database_url,
            bind_addr: var("BIND_ADDR").unwrap_or_else(|| "0.0.0.0:8080".into()),
            allowed_origins: var("ALLOWED_ORIGINS")
                .map(|v| {
                    v.split(',')
                        .map(|s| s.trim().trim_end_matches('/').to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default(),
            jwt_secret,
            access_ttl_seconds: parse_num("ACCESS_TOKEN_TTL_SECONDS", 900)?,
            refresh_ttl_seconds: parse_num("REFRESH_TOKEN_TTL_SECONDS", 604_800)?,
            ws_ticket_ttl_seconds: parse_num("WS_TICKET_TTL_SECONDS", 30)?,
            cookie_secure: var("COOKIE_SECURE").is_some_and(|v| v == "true" || v == "1"),
            llm: LlmConfig {
                provider: var("LLM_PROVIDER").unwrap_or_else(|| "lmstudio".into()),
                base_url: var("LLM_BASE_URL")
                    .unwrap_or_else(|| "http://localhost:1234/v1".into())
                    .trim_end_matches('/')
                    .to_string(),
                model: var("LLM_MODEL"),
                api_key: var("LLM_API_KEY"),
                reasoning_effort: var("LLM_REASONING_EFFORT"),
                timeout: Duration::from_secs(parse_num("LLM_TIMEOUT_SECONDS", 120u64)?),
                mode,
            },
        };
        cfg.validate()?;
        Ok(cfg)
    }

    pub fn validate(&self) -> Result<(), ConfigError> {
        if self.jwt_secret.len() < MIN_JWT_SECRET_LEN {
            return Err(ConfigError(format!(
                "JWT_SECRET must be at least {MIN_JWT_SECRET_LEN} bytes"
            )));
        }
        if self.access_ttl_seconds <= 0
            || self.refresh_ttl_seconds <= 0
            || self.ws_ticket_ttl_seconds <= 0
        {
            return Err(ConfigError("token TTLs must be positive".into()));
        }
        Ok(())
    }

    /// Deterministic configuration for tests (mock LLM, test-only secret).
    pub fn for_tests(database_url: impl Into<String>) -> Self {
        Config {
            database_url: database_url.into(),
            bind_addr: "127.0.0.1:0".into(),
            allowed_origins: vec!["http://localhost:5173".into()],
            jwt_secret: "test-only-secret-test-only-secret-0123456789".into(),
            access_ttl_seconds: 900,
            refresh_ttl_seconds: 3600,
            ws_ticket_ttl_seconds: 30,
            cookie_secure: false,
            llm: LlmConfig {
                provider: "lmstudio".into(),
                base_url: "http://127.0.0.1:9/v1".into(),
                model: None,
                api_key: None,
                reasoning_effort: None,
                timeout: Duration::from_secs(5),
                mode: LlmMode::Mock,
            },
        }
    }
}
