//! OpenAPI document (served at `/api/openapi.json`, Swagger UI at `/api/docs`).

use utoipa::openapi::security::{HttpAuthScheme, HttpBuilder, SecurityScheme};
use utoipa::{Modify, OpenApi};

use crate::websocket::events;

#[derive(OpenApi)]
#[openapi(
    info(
        title = "AgentOps Control Center API",
        version = "1.0.0",
        description = "Instant messaging between two devices + AI-agent human-in-the-loop approvals.\n\n\
WebSocket: `GET /ws/messages?ticket=<wsTicket>` — frames are `ClientEvent` (client→server) and `ServerEvent` (server→client); see components."
    ),
    paths(
        crate::users::create_account,
        crate::users::list_users,
        crate::auth::handlers::login,
        crate::auth::handlers::refresh_token,
        crate::auth::handlers::logout,
        crate::auth::handlers::me,
        crate::auth::handlers::ws_ticket,
        crate::messaging::get_conversation,
        crate::cases::create_case,
        crate::cases::list_cases,
        crate::cases::get_case,
        crate::agents::handlers::create_run,
        crate::agents::handlers::list_runs,
        crate::agents::handlers::get_run,
        crate::approvals::list_approvals,
        crate::approvals::get_approval,
        crate::approvals::decide,
        crate::audit::list_audit_events,
        crate::api::health,
        crate::api::llm_models,
    ),
    components(schemas(
        events::ServerEvent,
        events::ClientEvent,
        events::MessageEvent,
        events::UserPresenceEvent,
        events::TypingEvent,
        events::AgentStatusEvent,
        events::ApprovalRequestedEvent,
        events::ApprovalResolvedEvent,
        events::ErrorEvent,
        events::ClientMessage,
        events::ClientTyping,
        crate::domain::CaseStatus,
        crate::domain::RunStatus,
    )),
    modifiers(&BearerAuth),
    tags(
        (name = "auth"), (name = "users"), (name = "messages"), (name = "cases"),
        (name = "agent-runs"), (name = "approvals"), (name = "audit"), (name = "system"),
    )
)]
pub struct ApiDoc;

struct BearerAuth;

impl Modify for BearerAuth {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        let components = openapi.components.get_or_insert_with(Default::default);
        components.add_security_scheme(
            "bearer",
            SecurityScheme::Http(
                HttpBuilder::new()
                    .scheme(HttpAuthScheme::Bearer)
                    .bearer_format("JWT")
                    .build(),
            ),
        );
    }
}
