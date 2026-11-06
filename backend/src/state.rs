//! Shared application state.

use std::sync::Arc;

use sqlx::PgPool;

use crate::auth::jwt::JwtKeys;
use crate::config::{Config, ConfigError};
use crate::domain::LlmMode;
use crate::llm::{LlmProvider, mock::MockProvider, openai_compat::OpenAiCompatProvider};
use crate::websocket::hub::Hub;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub jwt: Arc<JwtKeys>,
    pub hub: Arc<Hub>,
    pub llm: Arc<dyn LlmProvider>,
    /// HTTP client used for LLM model discovery / health probes.
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(db: PgPool, config: Config) -> Result<Self, ConfigError> {
        config.validate()?;
        let llm: Arc<dyn LlmProvider> = match config.llm.mode {
            LlmMode::Mock => Arc::new(MockProvider::new()),
            LlmMode::Real => Arc::new(
                OpenAiCompatProvider::new(config.llm.clone())
                    .map_err(|e| ConfigError(format!("LLM client: {e}")))?,
            ),
        };
        Ok(Self::with_llm(db, config, llm))
    }

    /// Build state with an explicit LLM provider (useful in tests).
    pub fn with_llm(db: PgPool, config: Config, llm: Arc<dyn LlmProvider>) -> Self {
        let jwt = JwtKeys::new(
            config.jwt_secret.as_bytes(),
            config.access_ttl_seconds,
            config.ws_ticket_ttl_seconds,
        );
        let http = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(2))
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .unwrap_or_default();
        AppState {
            db,
            config: Arc::new(config),
            jwt: Arc::new(jwt),
            hub: Arc::new(Hub::new()),
            llm,
            http,
        }
    }
}
