//! Real-socket WebSocket tests (axum served on 127.0.0.1:0, tokio-tungstenite client).

mod common;

use std::net::SocketAddr;
use std::time::Duration;

use agentops::build_app;
use common::TestApp;
use futures_util::{SinkExt, StreamExt};
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::net::TcpStream;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::{Error as WsError, Message};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

type Ws = WebSocketStream<MaybeTlsStream<TcpStream>>;

async fn serve(app: &TestApp) -> SocketAddr {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let router = build_app(app.state.clone());
    tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });
    addr
}

async fn ticket(app: &TestApp, token: &str) -> String {
    let r = app.post("/api/auth/ws-ticket", token, json!({})).await;
    r.body["ticket"].as_str().unwrap().to_string()
}

async fn connect(addr: SocketAddr, ticket: &str) -> Ws {
    let (ws, resp) = connect_async(format!("ws://{addr}/ws/messages?ticket={ticket}"))
        .await
        .expect("ws connect");
    assert_eq!(resp.status(), 101);
    ws
}

async fn connect_err_status(addr: SocketAddr, query: &str, origin: Option<&str>) -> u16 {
    let mut req = format!("ws://{addr}/ws/messages{query}")
        .into_client_request()
        .unwrap();
    if let Some(o) = origin {
        req.headers_mut().insert("origin", o.parse().unwrap());
    }
    match connect_async(req).await {
        Err(WsError::Http(resp)) => resp.status().as_u16(),
        Err(e) => panic!("unexpected error {e}"),
        Ok(_) => 101,
    }
}

/// Next JSON event matching `type`, skipping others (2 s budget).
async fn next_of(ws: &mut Ws, ty: &str) -> Value {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(2);
    loop {
        let msg = tokio::time::timeout_at(deadline, ws.next())
            .await
            .unwrap_or_else(|_| panic!("timed out waiting for {ty}"))
            .expect("stream ended")
            .expect("ws error");
        if let Message::Text(t) = msg {
            let v: Value = serde_json::from_str(t.as_str()).unwrap();
            if v["type"] == ty {
                return v;
            }
        }
    }
}

async fn send(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string().into())).await.unwrap();
}

#[sqlx::test]
async fn ws_rejects_missing_invalid_reused_ticket_and_bad_origin(pool: PgPool) {
    let app = TestApp::new(pool);
    let addr = serve(&app).await;
    let (_, token) = app.user("alice", "OPERATOR").await;

    assert_eq!(connect_err_status(addr, "", None).await, 401);
    assert_eq!(connect_err_status(addr, "?ticket=garbage", None).await, 401);
    // an access token is not a ws ticket (wrong audience)
    assert_eq!(
        connect_err_status(addr, &format!("?ticket={token}"), None).await,
        401
    );

    let t = ticket(&app, &token).await;
    assert_eq!(
        connect_err_status(addr, &format!("?ticket={t}"), Some("http://evil.example")).await,
        403
    );
    // allowed origin from ALLOWED_ORIGINS
    assert_eq!(
        connect_err_status(addr, &format!("?ticket={t}"), Some("http://localhost:5173")).await,
        101
    );
    // single use
    assert_eq!(
        connect_err_status(addr, &format!("?ticket={t}"), None).await,
        401
    );
    // same-origin (Origin host == Host header) is allowed
    let t2 = ticket(&app, &token).await;
    assert_eq!(
        connect_err_status(
            addr,
            &format!("?ticket={t2}"),
            Some(&format!("http://{addr}"))
        )
        .await,
        101
    );
}

#[sqlx::test]
async fn ws_messages_persist_presence_and_spoofing(pool: PgPool) {
    let app = TestApp::new(pool);
    let addr = serve(&app).await;
    let (alice_id, alice) = app.user("alice", "OPERATOR").await;
    let (bob_id, bob) = app.user("bob", "REVIEWER").await;
    let (carol_id, _carol) = app.user("carol", "OPERATOR").await;

    let mut wa = connect(addr, &ticket(&app, &alice).await).await;
    let p = next_of(&mut wa, "user_presence").await;
    assert_eq!(p["userId"], alice_id);
    assert_eq!(p["online"], true);

    let mut wb = connect(addr, &ticket(&app, &bob).await).await;
    let p = next_of(&mut wa, "user_presence").await;
    assert_eq!(
        (p["userId"].as_i64(), p["online"].as_bool()),
        (Some(bob_id), Some(true))
    );

    // presence via REST
    let users = app.get("/api/utilisateurs", &alice).await.body;
    let online = |id: i64, users: &Value| {
        users
            .as_array()
            .unwrap()
            .iter()
            .find(|u| u["id"] == id)
            .unwrap()["online"]
            .as_bool()
            .unwrap()
    };
    assert!(online(alice_id, &users) && online(bob_id, &users) && !online(carol_id, &users));

    // alice → bob, trying to spoof sender + timestamp
    send(
        &mut wa,
        json!({"type": "message", "destinataireId": bob_id, "contenu": "  Bonjour !  ",
               "clientMessageId": "c-1", "expediteurId": carol_id, "dateEnvoi": "1999-01-01T00:00:00"}),
    )
    .await;
    let got = next_of(&mut wb, "message").await;
    assert_eq!(
        got["expediteurId"], alice_id,
        "server uses authenticated identity"
    );
    assert_eq!(got["destinataireId"], bob_id);
    assert_eq!(got["contenu"], "Bonjour !");
    assert!(!got["dateEnvoi"].as_str().unwrap().starts_with("1999"));
    let echo = next_of(&mut wa, "message").await;
    assert_eq!(echo["id"], got["id"]);
    assert_eq!(echo["clientMessageId"], "c-1");

    // bob replies
    send(
        &mut wb,
        json!({"type": "message", "destinataireId": alice_id, "contenu": "Salut"}),
    )
    .await;
    next_of(&mut wa, "message").await;

    // typing goes to recipient only
    send(
        &mut wa,
        json!({"type": "typing", "destinataireId": bob_id, "isTyping": true}),
    )
    .await;
    let t = next_of(&mut wb, "typing").await;
    assert_eq!(
        (t["expediteurId"].as_i64(), t["isTyping"].as_bool()),
        (Some(alice_id), Some(true))
    );

    // validation errors come back as error events
    send(&mut wa, json!({"type": "message", "destinataireId": bob_id, "contenu": "   ", "clientMessageId": "c-2"})).await;
    let e = next_of(&mut wa, "error").await;
    assert_eq!(e["code"], "validation_error");
    assert_eq!(e["clientMessageId"], "c-2");
    send(
        &mut wa,
        json!({"type": "message", "destinataireId": alice_id, "contenu": "me"}),
    )
    .await;
    assert_eq!(next_of(&mut wa, "error").await["code"], "validation_error");
    send(
        &mut wa,
        json!({"type": "message", "destinataireId": 999999, "contenu": "x"}),
    )
    .await;
    assert_eq!(next_of(&mut wa, "error").await["code"], "not_found");
    ws_send_raw(&mut wa, "{oops").await;
    assert_eq!(next_of(&mut wa, "error").await["code"], "validation_error");

    // conversation via REST, ascending, both directions, from either side
    let conv = app.get(&format!("/api/messages/{bob_id}"), &alice).await;
    assert_eq!(conv.status, 200);
    let msgs = conv.body.as_array().unwrap();
    assert_eq!(msgs.len(), 2);
    assert_eq!(msgs[0]["contenu"], "Bonjour !");
    assert_eq!(msgs[0]["expediteurId"], alice_id);
    assert_eq!(msgs[1]["contenu"], "Salut");
    assert!(msgs[0]["id"].as_i64() < msgs[1]["id"].as_i64());
    let conv_b = app.get(&format!("/api/messages/{alice_id}"), &bob).await;
    assert_eq!(conv_b.body.as_array().unwrap().len(), 2);
    // carol sees nothing of it
    let carol_token = app.login("carol").await;
    let conv_c = app
        .get(&format!("/api/messages/{alice_id}"), &carol_token)
        .await;
    assert_eq!(conv_c.body.as_array().unwrap().len(), 0);
    // pagination with beforeId
    let before = msgs[1]["id"].as_i64().unwrap();
    let page = app
        .get(&format!("/api/messages/{bob_id}?beforeId={before}"), &alice)
        .await;
    assert_eq!(page.body.as_array().unwrap().len(), 1);

    // bob disconnects → offline broadcast + REST presence
    wb.close(None).await.unwrap();
    let p = next_of(&mut wa, "user_presence").await;
    assert_eq!(
        (p["userId"].as_i64(), p["online"].as_bool()),
        (Some(bob_id), Some(false))
    );
    let users = app.get("/api/utilisateurs", &alice).await.body;
    assert!(!online(bob_id, &users));
}

async fn ws_send_raw(ws: &mut Ws, s: &str) {
    ws.send(Message::Text(s.to_string().into())).await.unwrap();
}

#[sqlx::test]
async fn ws_multiple_connections_rate_limit_and_frame_limit(pool: PgPool) {
    let app = TestApp::new(pool);
    let addr = serve(&app).await;
    let (alice_id, alice) = app.user("alice", "OPERATOR").await;
    let (bob_id, bob) = app.user("bob", "REVIEWER").await;

    let mut a1 = connect(addr, &ticket(&app, &alice).await).await;
    let mut a2 = connect(addr, &ticket(&app, &alice).await).await;
    assert_eq!(app.state.hub.connection_count(alice_id), 2);
    let mut b = connect(addr, &ticket(&app, &bob).await).await;

    // message from a1 is echoed to a2 as well (multi-device)
    send(
        &mut b,
        json!({"type": "message", "destinataireId": alice_id, "contenu": "hi"}),
    )
    .await;
    next_of(&mut a1, "message").await;
    next_of(&mut a2, "message").await;

    // one connection closing keeps the user online
    a2.close(None).await.unwrap();
    tokio::time::sleep(Duration::from_millis(200)).await;
    assert!(app.state.hub.is_online(alice_id));

    // rate limit: 10 msgs / 5 s
    for i in 0..11 {
        send(
            &mut a1,
            json!({"type": "typing", "destinataireId": bob_id, "isTyping": i % 2 == 0}),
        )
        .await;
    }
    assert_eq!(next_of(&mut a1, "error").await["code"], "rate_limited");

    // frames over 16 KiB close the connection
    let big = "x".repeat(20 * 1024);
    let _ = a1
        .send(Message::Text(
            json!({"type": "message", "destinataireId": bob_id, "contenu": big})
                .to_string()
                .into(),
        ))
        .await;
    let closed = tokio::time::timeout(Duration::from_secs(2), async {
        loop {
            match a1.next().await {
                None | Some(Err(_)) | Some(Ok(Message::Close(_))) => return true,
                _ => {}
            }
        }
    })
    .await
    .unwrap_or(false);
    assert!(closed, "oversized frame must close the socket");
}
