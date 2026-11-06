//! AgentOps Control Center backend — modular monolith.
//!
//! * `auth`       – passwords, JWT access tokens, WS tickets, refresh tokens, extractor
//! * `users`      – accounts and the user directory (with live presence)
//! * `messaging`  – persisted 1:1 instant messages
//! * `websocket`  – connection hub, presence, real-time events
//! * `cases`      – invoice cases
//! * `agents`     – agent runs, state machine, worker, recovery
//! * `approvals`  – human-in-the-loop decisions
//! * `actions`    – whitelisted business actions (exactly-once)
//! * `audit`      – audit trail
//! * `llm`        – LLM provider abstraction (mock + OpenAI-compatible)
//! * `api`        – router assembly, health, OpenAPI

pub mod actions;
pub mod agents;
pub mod api;
pub mod approvals;
pub mod audit;
pub mod auth;
pub mod cases;
pub mod config;
pub mod domain;
pub mod error;
pub mod extract;
pub mod llm;
pub mod messaging;
pub mod pagination;
pub mod seed;
pub mod state;
pub mod users;
pub mod websocket;

pub use api::build_app;
pub use state::AppState;

/// Embedded SQL migrations (`backend/migrations`).
pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
