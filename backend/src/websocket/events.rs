//! WebSocket event DTOs (also exported as OpenAPI components for frontend type generation).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::domain::{ActionName, ApprovalStatus, RiskLevel, RunStatus};

// ---------- server → client ----------

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MessageEvent {
    pub id: i64,
    pub expediteur_id: i64,
    pub destinataire_id: i64,
    pub contenu: String,
    pub date_envoi: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_message_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserPresenceEvent {
    pub user_id: i64,
    pub username: String,
    pub online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TypingEvent {
    pub expediteur_id: i64,
    pub destinataire_id: i64,
    pub is_typing: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentStatusEvent {
    pub run_id: i64,
    pub case_id: i64,
    pub status: RunStatus,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalRequestedEvent {
    pub approval_id: i64,
    pub run_id: i64,
    pub case_id: i64,
    pub case_title: String,
    pub risk_level: RiskLevel,
    pub proposed_action: ActionName,
    pub requested_by: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalResolvedEvent {
    pub approval_id: i64,
    pub run_id: i64,
    pub status: ApprovalStatus,
    pub decided_by: i64,
    pub decided_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_message_id: Option<String>,
}

/// Every server → client frame. Discriminated by `type`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerEvent {
    Message(MessageEvent),
    UserPresence(UserPresenceEvent),
    Typing(TypingEvent),
    AgentStatus(AgentStatusEvent),
    ApprovalRequested(ApprovalRequestedEvent),
    ApprovalResolved(ApprovalResolvedEvent),
    Error(ErrorEvent),
}

impl ServerEvent {
    pub fn error(
        code: &str,
        message: impl Into<String>,
        client_message_id: Option<String>,
    ) -> Self {
        ServerEvent::Error(ErrorEvent {
            code: code.into(),
            message: message.into(),
            client_message_id,
        })
    }
}

// ---------- client → server ----------

/// Send a message. `expediteurId` / `dateEnvoi` are accepted for compatibility but ignored:
/// the server always uses the authenticated identity and its own clock.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientMessage {
    pub destinataire_id: i64,
    pub contenu: String,
    #[serde(default)]
    pub client_message_id: Option<String>,
    /// Ignored.
    #[serde(default)]
    #[schema(value_type = Option<i64>)]
    pub expediteur_id: Option<serde_json::Value>,
    /// Ignored.
    #[serde(default)]
    #[schema(value_type = Option<String>)]
    pub date_envoi: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ClientTyping {
    pub destinataire_id: i64,
    pub is_typing: bool,
}

/// Every client → server frame. Discriminated by `type`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientEvent {
    Message(ClientMessage),
    Typing(ClientTyping),
}
