//! Real-time layer: `/ws/messages?ticket=<wsTicket>`.

pub mod events;
pub mod hub;

use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::{IntoResponse, Response};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use crate::auth::{jwt, origin_allowed};
use crate::domain::Role;
use crate::error::AppError;
use crate::messaging;
use crate::state::AppState;
use crate::users;
use events::{ClientEvent, ClientMessage, ClientTyping, MessageEvent, ServerEvent, TypingEvent};

pub const MAX_FRAME_BYTES: usize = 16 * 1024;
pub const PING_INTERVAL: Duration = Duration::from_secs(25);
pub const IDLE_TIMEOUT: Duration = Duration::from_secs(60);
pub const RATE_LIMIT_MSGS: usize = 10;
pub const RATE_LIMIT_WINDOW: Duration = Duration::from_secs(5);
const MAX_CLIENT_MESSAGE_ID: usize = 128;

#[derive(Debug, Clone)]
struct WsUser {
    id: i64,
    username: String,
    #[allow(dead_code)]
    role: Role,
}

/// Sliding-window rate limiter (per connection).
pub struct RateLimiter {
    max: usize,
    window: Duration,
    hits: VecDeque<Instant>,
}

impl RateLimiter {
    pub fn new(max: usize, window: Duration) -> Self {
        Self {
            max,
            window,
            hits: VecDeque::with_capacity(max),
        }
    }

    pub fn allow(&mut self) -> bool {
        let now = Instant::now();
        while self
            .hits
            .front()
            .is_some_and(|t| now.duration_since(*t) >= self.window)
        {
            self.hits.pop_front();
        }
        if self.hits.len() >= self.max {
            return false;
        }
        self.hits.push_back(now);
        true
    }
}

/// WebSocket upgrade. 401 for a missing/invalid/expired/reused ticket, 403 for a disallowed Origin.
pub async fn ws_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
    ws: WebSocketUpgrade,
) -> Response {
    let Some(ticket) = query.get("ticket").filter(|t| !t.is_empty()) else {
        return AppError::Unauthorized("missing ws ticket".into()).into_response();
    };
    let claims = match state.jwt.verify(ticket, jwt::AUD_WS) {
        Ok(c) => c,
        Err(e) => return e.into_response(),
    };
    let (Ok(user_id), Some(jti)) = (claims.user_id(), claims.jti.as_deref()) else {
        return AppError::unauthorized().into_response();
    };
    if !origin_allowed(&state.config, &headers) {
        tracing::warn!(user_id, "ws upgrade rejected: origin not allowed");
        return AppError::Forbidden("origin not allowed".into()).into_response();
    }
    if !state.hub.consume_ticket(jti, claims.exp) {
        return AppError::Unauthorized("ws ticket already used".into()).into_response();
    }
    let user = WsUser {
        id: user_id,
        username: claims.username,
        role: claims.role,
    };
    ws.max_frame_size(MAX_FRAME_BYTES)
        .max_message_size(MAX_FRAME_BYTES)
        .on_upgrade(move |socket| run_connection(state, user, socket))
}

async fn run_connection(state: AppState, user: WsUser, socket: WebSocket) {
    let reg = state.hub.register(user.id, &user.username);
    let conn_id = reg.conn_id;
    tracing::info!(user_id = user.id, conn_id, "ws connected");
    let (mut sink, mut stream) = socket.split();
    let mut rx = reg.rx;

    let mut writer = tokio::spawn(async move {
        let mut ping = tokio::time::interval(PING_INTERVAL);
        ping.tick().await;
        loop {
            tokio::select! {
                ev = rx.recv() => {
                    let Some(ev) = ev else { break };
                    let Ok(text) = serde_json::to_string(&ev) else { continue };
                    if sink.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
                _ = ping.tick() => {
                    if sink.send(Message::Ping(Default::default())).await.is_err() {
                        break;
                    }
                }
            }
        }
        let _ = sink.close().await;
    });

    let own_tx = reg.tx;
    let reader_state = state.clone();
    let reader_user = user.clone();
    let mut reader = tokio::spawn(async move {
        let mut limiter = RateLimiter::new(RATE_LIMIT_MSGS, RATE_LIMIT_WINDOW);
        loop {
            let msg = match tokio::time::timeout(IDLE_TIMEOUT, stream.next()).await {
                Err(_) => {
                    tracing::info!(user_id = reader_user.id, "ws idle timeout");
                    break;
                }
                Ok(None) | Ok(Some(Err(_))) => break,
                Ok(Some(Ok(m))) => m,
            };
            match msg {
                Message::Text(text) => {
                    if !limiter.allow() {
                        send_own(
                            &own_tx,
                            ServerEvent::error("rate_limited", "too many messages", None),
                        );
                        continue;
                    }
                    handle_text(&reader_state, &reader_user, &own_tx, text.as_str()).await;
                }
                Message::Binary(_) => send_own(
                    &own_tx,
                    ServerEvent::error("bad_request", "binary frames are not supported", None),
                ),
                Message::Close(_) => break,
                Message::Ping(_) | Message::Pong(_) => {}
            }
        }
    });

    tokio::select! {
        _ = &mut writer => reader.abort(),
        _ = &mut reader => writer.abort(),
    }
    state.hub.unregister(user.id, conn_id);
    tracing::info!(user_id = user.id, conn_id, "ws disconnected");
}

fn send_own(tx: &mpsc::Sender<ServerEvent>, ev: ServerEvent) {
    let _ = tx.try_send(ev);
}

async fn handle_text(state: &AppState, user: &WsUser, own: &mpsc::Sender<ServerEvent>, text: &str) {
    let event: ClientEvent = match serde_json::from_str(text) {
        Ok(e) => e,
        Err(e) => {
            send_own(
                own,
                ServerEvent::error("validation_error", format!("invalid event: {e}"), None),
            );
            return;
        }
    };
    match event {
        ClientEvent::Message(m) => handle_message(state, user, own, m).await,
        ClientEvent::Typing(t) => handle_typing(state, user, own, t),
    }
}

async fn handle_message(
    state: &AppState,
    user: &WsUser,
    own: &mpsc::Sender<ServerEvent>,
    m: ClientMessage,
) {
    // `m.expediteur_id` and `m.date_envoi` are deliberately ignored (never trust the client).
    let cmid = m.client_message_id.clone();
    let fail = |code: &str, msg: &str| {
        send_own(own, ServerEvent::error(code, msg, cmid.clone()));
    };
    if cmid
        .as_ref()
        .is_some_and(|c| c.len() > MAX_CLIENT_MESSAGE_ID)
    {
        return fail("validation_error", "clientMessageId too long");
    }
    let content = match messaging::normalize_content(&m.contenu) {
        Ok(c) => c,
        Err(e) => return fail("validation_error", &e.to_string()),
    };
    if m.destinataire_id == user.id {
        return fail("validation_error", "cannot send a message to yourself");
    }
    match users::find_by_id(&state.db, m.destinataire_id).await {
        Ok(Some(_)) => {}
        Ok(None) => return fail("not_found", "recipient not found"),
        Err(e) => {
            tracing::error!(error = %e, "ws recipient lookup failed");
            return fail("internal", "internal server error");
        }
    }
    let saved =
        match messaging::insert_message(&state.db, user.id, m.destinataire_id, &content).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!(error = %e, "ws message insert failed");
                return fail("internal", "internal server error");
            }
        };
    let base = MessageEvent {
        id: saved.id,
        expediteur_id: saved.expediteur_id,
        destinataire_id: saved.destinataire_id,
        contenu: saved.contenu,
        date_envoi: saved.date_envoi,
        client_message_id: None,
    };
    state
        .hub
        .send_to_user(saved.destinataire_id, &ServerEvent::Message(base.clone()));
    state.hub.send_to_user(
        user.id,
        &ServerEvent::Message(MessageEvent {
            client_message_id: cmid,
            ..base
        }),
    );
}

fn handle_typing(
    state: &AppState,
    user: &WsUser,
    own: &mpsc::Sender<ServerEvent>,
    t: ClientTyping,
) {
    if t.destinataire_id == user.id {
        send_own(
            own,
            ServerEvent::error("validation_error", "invalid typing recipient", None),
        );
        return;
    }
    state.hub.send_to_user(
        t.destinataire_id,
        &ServerEvent::Typing(TypingEvent {
            expediteur_id: user.id,
            destinataire_id: t.destinataire_id,
            is_typing: t.is_typing,
        }),
    );
}
