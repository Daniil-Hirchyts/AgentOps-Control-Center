//! In-memory connection registry: `user_id -> [(conn_id, sender)]`, presence and fan-out.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};

use tokio::sync::mpsc;

use super::events::{ServerEvent, UserPresenceEvent};

/// Per-connection outbound queue size. Slow consumers drop events instead of blocking the hub.
pub const OUTBOUND_QUEUE: usize = 256;

struct Conn {
    conn_id: u64,
    tx: mpsc::Sender<ServerEvent>,
}

struct UserConns {
    username: String,
    conns: Vec<Conn>,
}

/// Handle returned to a newly registered connection.
pub struct Registration {
    pub conn_id: u64,
    /// Sender for events addressed to this connection only (e.g. errors).
    pub tx: mpsc::Sender<ServerEvent>,
    pub rx: mpsc::Receiver<ServerEvent>,
}

#[derive(Default)]
pub struct Hub {
    users: RwLock<HashMap<i64, UserConns>>,
    next_conn_id: AtomicU64,
    /// Consumed WS ticket ids (jti → exp) so a ticket can be used once.
    used_tickets: Mutex<HashMap<String, i64>>,
}

impl Hub {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a connection. Broadcasts `user_presence online=true` when it's the user's first.
    pub fn register(&self, user_id: i64, username: &str) -> Registration {
        let (tx, rx) = mpsc::channel(OUTBOUND_QUEUE);
        let own_tx = tx.clone();
        let conn_id = self.next_conn_id.fetch_add(1, Ordering::Relaxed) + 1;
        let first = {
            let mut users = self.users.write().expect("hub lock poisoned");
            let entry = users.entry(user_id).or_insert_with(|| UserConns {
                username: username.to_string(),
                conns: Vec::new(),
            });
            entry.conns.push(Conn { conn_id, tx });
            entry.conns.len() == 1
        };
        if first {
            self.broadcast(ServerEvent::UserPresence(UserPresenceEvent {
                user_id,
                username: username.to_string(),
                online: true,
            }));
        }
        Registration {
            conn_id,
            tx: own_tx,
            rx,
        }
    }

    /// Unregister a connection. Broadcasts `user_presence online=false` when it was the last one.
    pub fn unregister(&self, user_id: i64, conn_id: u64) {
        let gone = {
            let mut users = self.users.write().expect("hub lock poisoned");
            match users.get_mut(&user_id) {
                Some(entry) => {
                    entry.conns.retain(|c| c.conn_id != conn_id);
                    if entry.conns.is_empty() {
                        users.remove(&user_id).map(|e| e.username)
                    } else {
                        None
                    }
                }
                None => None,
            }
        };
        if let Some(username) = gone {
            self.broadcast(ServerEvent::UserPresence(UserPresenceEvent {
                user_id,
                username,
                online: false,
            }));
        }
    }

    pub fn is_online(&self, user_id: i64) -> bool {
        self.users
            .read()
            .expect("hub lock poisoned")
            .contains_key(&user_id)
    }

    pub fn connection_count(&self, user_id: i64) -> usize {
        self.users
            .read()
            .expect("hub lock poisoned")
            .get(&user_id)
            .map_or(0, |e| e.conns.len())
    }

    fn deliver(conn: &Conn, event: &ServerEvent) {
        if let Err(e) = conn.tx.try_send(event.clone()) {
            tracing::warn!(conn_id = conn.conn_id, error = %e, "dropping ws event for slow/closed connection");
        }
    }

    pub fn send_to_user(&self, user_id: i64, event: &ServerEvent) {
        let users = self.users.read().expect("hub lock poisoned");
        if let Some(entry) = users.get(&user_id) {
            for c in &entry.conns {
                Self::deliver(c, event);
            }
        }
    }

    /// Send to each distinct user once (all of their connections).
    pub fn send_to_users(&self, user_ids: &[i64], event: &ServerEvent) {
        let unique: HashSet<i64> = user_ids.iter().copied().collect();
        for id in unique {
            self.send_to_user(id, event);
        }
    }

    pub fn broadcast(&self, event: ServerEvent) {
        let users = self.users.read().expect("hub lock poisoned");
        for entry in users.values() {
            for c in &entry.conns {
                Self::deliver(c, &event);
            }
        }
    }

    /// Mark a ticket id as used. Returns false if it was already consumed.
    pub fn consume_ticket(&self, jti: &str, exp: i64) -> bool {
        let now = chrono::Utc::now().timestamp();
        let mut used = self.used_tickets.lock().expect("ticket lock poisoned");
        used.retain(|_, e| *e >= now);
        used.insert(jti.to_string(), exp).is_none()
    }
}
