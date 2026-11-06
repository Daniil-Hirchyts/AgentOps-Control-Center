mod common;

use agentops::auth::jwt::{AUD_API, Claims};
use agentops::auth::password::{hash_password_blocking, verify_password_blocking};
use agentops::domain::Role;
use axum::body::Body;
use axum::http::{Method, Request, StatusCode};
use common::{PASSWORD, TestApp};
use serde_json::json;
use sqlx::PgPool;

#[sqlx::test]
async fn account_creation_duplicate_and_validation(pool: PgPool) {
    let app = TestApp::new(pool);
    let r = app
        .call(
            Method::POST,
            "/api/comptes",
            None,
            Some(json!({"username": "alice", "password": PASSWORD})),
        )
        .await;
    assert_eq!(r.status, StatusCode::CREATED);
    assert_eq!(r.body["username"], "alice");
    assert_eq!(r.body["role"], "OPERATOR", "role defaults to OPERATOR");
    assert!(r.body.get("passwordHash").is_none() && r.body.get("password").is_none());

    // duplicate (case-insensitive)
    let r = app
        .call(
            Method::POST,
            "/api/comptes",
            None,
            Some(json!({"username": "ALICE", "password": PASSWORD})),
        )
        .await;
    assert_eq!(r.status, StatusCode::CONFLICT);
    assert_eq!(r.body["error"]["code"], "conflict");

    for body in [
        json!({"username": "bob", "password": "short"}),
        json!({"username": "a", "password": PASSWORD}),
        json!({"username": "bad name!", "password": PASSWORD}),
        json!({"username": "bob", "password": PASSWORD, "role": "ADMIN"}),
        json!({"username": "bob"}),
    ] {
        let r = app
            .call(Method::POST, "/api/comptes", None, Some(body.clone()))
            .await;
        assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
        assert_eq!(r.body["error"]["code"], "validation_error");
    }

    // malformed JSON → 400 with JSON error body
    let req = Request::builder()
        .method(Method::POST)
        .uri("/api/comptes")
        .header("content-type", "application/json")
        .body(Body::from("{not json"))
        .unwrap();
    let r = app.send(req).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    assert_eq!(r.body["error"]["code"], "bad_request");
}

#[sqlx::test]
async fn passwords_are_argon2id_hashed(pool: PgPool) {
    let app = TestApp::new(pool.clone());
    app.register("hashme", "REVIEWER").await;
    let (hash,): (String,) =
        sqlx::query_as("SELECT password_hash FROM users WHERE username = 'hashme'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(hash.starts_with("$argon2id$"), "{hash}");
    assert!(!hash.contains(PASSWORD));
    assert!(verify_password_blocking(PASSWORD, &hash));
    assert!(!verify_password_blocking("wrong-password", &hash));

    let h1 = hash_password_blocking("same-password").unwrap();
    let h2 = hash_password_blocking("same-password").unwrap();
    assert_ne!(h1, h2, "salted");
}

#[sqlx::test]
async fn login_ok_and_generic_failures(pool: PgPool) {
    let app = TestApp::new(pool);
    app.register("alice", "OPERATOR").await;
    let r = app
        .call(
            Method::POST,
            "/api/auth/login",
            None,
            Some(json!({"username": "alice", "password": PASSWORD})),
        )
        .await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.body["tokenType"], "Bearer");
    assert_eq!(r.body["expiresIn"], 900);
    assert_eq!(r.body["user"]["username"], "alice");
    let cookie = r.headers.get("set-cookie").unwrap().to_str().unwrap();
    assert!(cookie.starts_with("agentops_refresh="));
    assert!(
        cookie.contains("HttpOnly")
            && cookie.contains("SameSite=Strict")
            && cookie.contains("Path=/api/auth")
    );

    let wrong = app
        .call(
            Method::POST,
            "/api/auth/login",
            None,
            Some(json!({"username": "alice", "password": "nope-nope-nope"})),
        )
        .await;
    let unknown = app
        .call(
            Method::POST,
            "/api/auth/login",
            None,
            Some(json!({"username": "ghost", "password": PASSWORD})),
        )
        .await;
    assert_eq!(wrong.status, StatusCode::UNAUTHORIZED);
    assert_eq!(unknown.status, StatusCode::UNAUTHORIZED);
    assert_eq!(
        wrong.body, unknown.body,
        "must not reveal whether the user exists"
    );
}

#[sqlx::test]
async fn jwt_valid_invalid_expired_wrong_audience(pool: PgPool) {
    let app = TestApp::new(pool);
    let (id, token) = app.user("alice", "OPERATOR").await;

    let r = app.get("/api/auth/me", &token).await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.body["id"], id);

    let r = app.get("/api/auth/me", "not.a.jwt").await;
    assert_eq!(r.status, StatusCode::UNAUTHORIZED);
    assert_eq!(r.body["error"]["code"], "unauthorized");

    // tampered signature
    let mut bad = token.clone();
    bad.push('x');
    assert_eq!(
        app.get("/api/auth/me", &bad).await.status,
        StatusCode::UNAUTHORIZED
    );

    // expired
    let now = chrono::Utc::now().timestamp();
    let expired = app
        .state
        .jwt
        .sign(&Claims {
            sub: id.to_string(),
            role: Role::Operator,
            username: "alice".into(),
            iat: now - 1000,
            exp: now - 10,
            aud: AUD_API.into(),
            jti: None,
        })
        .unwrap();
    assert_eq!(
        app.get("/api/auth/me", &expired).await.status,
        StatusCode::UNAUTHORIZED
    );

    // signed with another secret
    let other =
        agentops::auth::jwt::JwtKeys::new(b"another-secret-another-secret-0123456789", 900, 30);
    let forged = other.issue_access(id, Role::Reviewer, "alice").unwrap();
    assert_eq!(
        app.get("/api/auth/me", &forged).await.status,
        StatusCode::UNAUTHORIZED
    );

    // a WS ticket (aud=ws) is not an access token
    let t = app.post("/api/auth/ws-ticket", &token, json!({})).await;
    assert_eq!(t.status, StatusCode::OK);
    assert_eq!(t.body["expiresIn"], 30);
    let ticket = t.body["ticket"].as_str().unwrap();
    assert_eq!(
        app.get("/api/auth/me", ticket).await.status,
        StatusCode::UNAUTHORIZED
    );
}

#[sqlx::test]
async fn all_protected_endpoints_require_token(pool: PgPool) {
    let app = TestApp::new(pool);
    let endpoints = [
        (Method::GET, "/api/auth/me"),
        (Method::POST, "/api/auth/ws-ticket"),
        (Method::GET, "/api/utilisateurs"),
        (Method::GET, "/api/messages/1"),
        (Method::POST, "/api/cases"),
        (Method::GET, "/api/cases"),
        (Method::GET, "/api/cases/1"),
        (Method::POST, "/api/agent-runs"),
        (Method::GET, "/api/agent-runs"),
        (Method::GET, "/api/agent-runs/1"),
        (Method::GET, "/api/approvals"),
        (Method::GET, "/api/approvals/1"),
        (Method::POST, "/api/approvals/1/decision"),
        (Method::GET, "/api/audit-events"),
        (Method::GET, "/api/llm/models"),
    ];
    for (m, uri) in endpoints {
        let body = (m == Method::POST).then(|| json!({}));
        let r = app.call(m.clone(), uri, None, body).await;
        assert_eq!(r.status, StatusCode::UNAUTHORIZED, "{m} {uri}");
        assert_eq!(r.body["error"]["code"], "unauthorized", "{m} {uri}");
    }
    // public ones
    assert_eq!(
        app.call(Method::GET, "/api/health", None, None)
            .await
            .status,
        StatusCode::OK
    );
    assert_eq!(
        app.call(Method::GET, "/api/openapi.json", None, None)
            .await
            .status,
        StatusCode::OK
    );
}

fn cookie_from(r: &common::Resp) -> String {
    let c = r.headers.get("set-cookie").unwrap().to_str().unwrap();
    c.split(';').next().unwrap().to_string()
}

#[sqlx::test]
async fn refresh_rotation_csrf_and_logout(pool: PgPool) {
    let app = TestApp::new(pool);
    app.register("alice", "OPERATOR").await;
    let login = app
        .call(
            Method::POST,
            "/api/auth/login",
            None,
            Some(json!({"username": "alice", "password": PASSWORD})),
        )
        .await;
    let cookie1 = cookie_from(&login);

    let refresh = |cookie: String, csrf: bool| {
        let mut b = Request::builder()
            .method(Method::POST)
            .uri("/api/auth/refresh")
            .header("cookie", cookie);
        if csrf {
            b = b.header("x-requested-with", "agentops");
        }
        b.body(Body::empty()).unwrap()
    };

    // missing CSRF header
    let r = app.send(refresh(cookie1.clone(), false)).await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);

    let r = app.send(refresh(cookie1.clone(), true)).await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert!(r.body["accessToken"].is_string());
    let cookie2 = cookie_from(&r);
    assert_ne!(cookie1, cookie2, "rotated");

    // old token can no longer be used (and reuse revokes the family)
    assert_eq!(
        app.send(refresh(cookie1, true)).await.status,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        app.send(refresh(cookie2.clone(), true)).await.status,
        StatusCode::UNAUTHORIZED
    );

    // fresh login → logout → refresh fails
    let login = app
        .call(
            Method::POST,
            "/api/auth/login",
            None,
            Some(json!({"username": "alice", "password": PASSWORD})),
        )
        .await;
    let cookie3 = cookie_from(&login);
    let req = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/logout")
        .header("cookie", cookie3.clone())
        .header("x-requested-with", "agentops")
        .body(Body::empty())
        .unwrap();
    let r = app.send(req).await;
    assert_eq!(r.status, StatusCode::NO_CONTENT);
    assert!(
        r.headers
            .get("set-cookie")
            .unwrap()
            .to_str()
            .unwrap()
            .contains("Max-Age=0")
    );
    assert_eq!(
        app.send(refresh(cookie3, true)).await.status,
        StatusCode::UNAUTHORIZED
    );

    // bad origin rejected
    let req = Request::builder()
        .method(Method::POST)
        .uri("/api/auth/refresh")
        .header("x-requested-with", "agentops")
        .header("origin", "http://evil.example")
        .header("host", "localhost:8080")
        .body(Body::empty())
        .unwrap();
    assert_eq!(app.send(req).await.status, StatusCode::FORBIDDEN);
}

#[sqlx::test]
async fn users_list_and_unknown_routes(pool: PgPool) {
    let app = TestApp::new(pool);
    let (_, token) = app.user("alice", "OPERATOR").await;
    app.register("bob", "REVIEWER").await;
    let r = app.get("/api/utilisateurs", &token).await;
    assert_eq!(r.status, StatusCode::OK);
    let arr = r.body.as_array().unwrap();
    assert_eq!(arr.len(), 2, "includes caller");
    assert!(arr.iter().all(|u| u["online"] == false));
    assert!(arr.iter().all(|u| u.get("passwordHash").is_none()));

    let r = app.get("/api/nope", &token).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
    assert_eq!(r.body["error"]["code"], "not_found");
    let r = app.get("/api/messages/abc", &token).await;
    assert_eq!(r.status, StatusCode::BAD_REQUEST);
    let r = app.get("/api/messages/99999", &token).await;
    assert_eq!(r.status, StatusCode::NOT_FOUND);
}
