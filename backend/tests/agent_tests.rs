//! Cases, agent runs, approvals, actions, audit, recovery.

mod common;

use std::sync::Arc;

use agentops::agents::service::recover_runs;
use axum::http::StatusCode;
use common::TestApp;
use serde_json::json;
use sqlx::PgPool;

struct World {
    app: TestApp,
    alice_id: i64,
    alice: String,
    bob_id: i64,
    bob: String,
    dave_id: i64,
    dave: String,
    carol: String,
}

async fn world(pool: PgPool) -> World {
    let app = TestApp::new(pool);
    let (alice_id, alice) = app.user("alice", "OPERATOR").await;
    let (_, carol) = app.user("carol", "OPERATOR").await;
    let (bob_id, bob) = app.user("bob", "REVIEWER").await;
    let (dave_id, dave) = app.user("dave", "REVIEWER").await;
    World {
        app,
        alice_id,
        alice,
        bob_id,
        bob,
        dave_id,
        dave,
        carol,
    }
}

async fn count(pool: &PgPool, sql: &str, id: i64) -> i64 {
    let (n,): (i64,) = sqlx::query_as(sql).bind(id).fetch_one(pool).await.unwrap();
    n
}

#[sqlx::test]
async fn rbac_on_cases_runs_and_decisions(pool: PgPool) {
    let w = world(pool).await;
    let app = &w.app;
    // reviewer cannot create or list cases
    let r = app
        .post("/api/cases", &w.bob, json!({"title": "x", "invoice": {"invoiceNumber": "1", "vendor": "v", "amount": 1.0, "currency": "EUR", "issueDate": "2026-01-01", "description": ""}}))
        .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    assert_eq!(r.body["error"]["code"], "forbidden");
    assert_eq!(
        app.get("/api/cases", &w.bob).await.status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.get("/api/llm/models", &w.bob).await.status,
        StatusCode::FORBIDDEN
    );

    // case validation
    let r = app
        .post("/api/cases", &w.alice, json!({"title": "x", "invoice": {"invoiceNumber": "1", "vendor": "v", "amount": -5.0, "currency": "EUR", "issueDate": "2026-01-01", "description": ""}}))
        .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    let r = app
        .post("/api/cases", &w.alice, json!({"title": "x", "invoice": {"invoiceNumber": "1", "vendor": "v", "amount": 5.0, "currency": "EUR", "issueDate": "not-a-date", "description": ""}}))
        .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);

    let case_id = app
        .create_case(&w.alice, 48_750.0, Some(4_200.0), "suspicious")
        .await;
    let list = app.get("/api/cases", &w.alice).await;
    assert_eq!(list.body["total"], 1);
    assert_eq!(
        list.body["items"][0]["invoice"]["historicalAverage"],
        4200.0
    );
    // other operator cannot read or run it
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.carol)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(app.get("/api/cases", &w.carol).await.body["total"], 0);
    let r = app
        .post(
            "/api/agent-runs",
            &w.carol,
            json!({"caseId": case_id, "reviewerId": w.bob_id}),
        )
        .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    // reviewer not yet assigned cannot read the case
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.bob)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    // reviewerId must be a reviewer
    let r = app
        .post(
            "/api/agent-runs",
            &w.alice,
            json!({"caseId": case_id, "reviewerId": w.alice_id}),
        )
        .await;
    assert_eq!(r.status, StatusCode::UNPROCESSABLE_ENTITY);
    // reviewer cannot start runs
    let r = app
        .post(
            "/api/agent-runs",
            &w.bob,
            json!({"caseId": case_id, "reviewerId": w.dave_id}),
        )
        .await;
    assert_eq!(r.status, StatusCode::FORBIDDEN);
    assert_eq!(
        app.post(
            "/api/agent-runs",
            &w.alice,
            json!({"caseId": 999999, "reviewerId": w.bob_id})
        )
        .await
        .status,
        StatusCode::NOT_FOUND
    );

    let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = app.wait_run(&w.alice, run_id, &["AWAITING_APPROVAL"]).await;
    let approval_id = run["approval"]["id"].as_i64().unwrap();
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.bob)
            .await
            .status,
        StatusCode::OK
    );

    // run & approval visibility
    assert_eq!(
        app.get(&format!("/api/agent-runs/{run_id}"), &w.dave)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.get(&format!("/api/agent-runs/{run_id}"), &w.carol)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.get(&format!("/api/approvals/{approval_id}"), &w.dave)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(app.get("/api/approvals", &w.dave).await.body["total"], 0);
    assert_eq!(
        app.get("/api/approvals?status=PENDING", &w.bob).await.body["total"],
        1
    );
    assert_eq!(
        app.get("/api/approvals", &w.alice).await.body["total"],
        1,
        "requester sees it"
    );
    assert_eq!(
        app.get(&format!("/api/audit-events?agentRunId={run_id}"), &w.dave)
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(app.get("/api/audit-events", &w.dave).await.body["total"], 0);

    // operator cannot decide; non-assigned reviewer cannot decide
    let decide = format!("/api/approvals/{approval_id}/decision");
    assert_eq!(
        app.post(&decide, &w.alice, json!({"decision": "approve"}))
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.post(&decide, &w.dave, json!({"decision": "approve"}))
            .await
            .status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.post(
            "/api/approvals/999999/decision",
            &w.bob,
            json!({"decision": "approve"})
        )
        .await
        .status,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        app.post(&decide, &w.bob, json!({"decision": "maybe"}))
            .await
            .status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    assert_eq!(
        app.post(
            &decide,
            &w.bob,
            json!({"decision": "approve", "reason": "x".repeat(1001)})
        )
        .await
        .status,
        StatusCode::UNPROCESSABLE_ENTITY
    );
    // still pending after all those attempts
    let a = app
        .get(&format!("/api/approvals/{approval_id}"), &w.bob)
        .await;
    assert_eq!(a.body["status"], "PENDING");
}

#[sqlx::test]
async fn approve_executes_action_exactly_once(pool: PgPool) {
    let w = world(pool.clone()).await;
    let app = &w.app;
    let case_id = app
        .create_case(&w.alice, 48_750.0, Some(4_200.0), "freight")
        .await;
    let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = app.wait_run(&w.alice, run_id, &["AWAITING_APPROVAL"]).await;
    assert_eq!(run["output"]["riskLevel"], "high");
    assert_eq!(
        run["output"]["recommendedAction"],
        "flag_invoice_for_review"
    );
    assert_eq!(run["output"]["requiresApproval"], true);
    assert_eq!(run["llmMode"], "mock");
    assert_eq!(run["attempts"], 1);
    let approval = &run["approval"];
    assert_eq!(approval["status"], "PENDING");
    assert_eq!(approval["reviewerUsername"], "bob");
    assert_eq!(approval["requestedByUsername"], "alice");
    assert_eq!(approval["invoice"]["amount"], 48750.0);
    // nothing executed yet, case still OPEN
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
            run_id
        )
        .await,
        0
    );
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.alice)
            .await
            .body["status"],
        "OPEN"
    );

    let approval_id = approval["id"].as_i64().unwrap();
    let r = app
        .post(
            &format!("/api/approvals/{approval_id}/decision"),
            &w.bob,
            json!({"decision": "approve", "reason": "  confirmed with vendor  "}),
        )
        .await;
    assert_eq!(r.status, StatusCode::OK, "{:?}", r.body);
    assert_eq!(r.body["status"], "APPROVED");
    assert_eq!(r.body["decidedBy"], w.bob_id);
    assert_eq!(r.body["decisionReason"], "confirmed with vendor");

    let run = app.wait_run(&w.alice, run_id, &["COMPLETED"]).await;
    assert_eq!(run["approval"]["status"], "APPROVED");
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.alice)
            .await
            .body["status"],
        "FLAGGED_FOR_REVIEW"
    );
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
            run_id
        )
        .await,
        1
    );

    // second decision → 409, still one execution
    let r = app
        .post(
            &format!("/api/approvals/{approval_id}/decision"),
            &w.bob,
            json!({"decision": "reject"}),
        )
        .await;
    assert_eq!(r.status, StatusCode::CONFLICT);
    assert_eq!(r.body["error"]["code"], "conflict");
    // re-running execution is idempotent
    agentops::agents::service::execute_approved_run(&app.state, run_id, None)
        .await
        .unwrap();
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
            run_id
        )
        .await,
        1
    );

    let types = app.audit_types(&w.alice, run_id).await;
    for t in [
        "run_created",
        "run_status_changed",
        "llm_request",
        "llm_response_valid",
        "approval_requested",
        "approval_decided",
        "action_executed",
    ] {
        assert!(types.contains(&t.to_string()), "missing {t} in {types:?}");
    }
    assert_eq!(types.iter().filter(|t| *t == "action_executed").count(), 1);
    // reviewer sees the same audit trail, with actor usernames
    let r = app
        .get(
            &format!("/api/audit-events?agentRunId={run_id}&limit=200"),
            &w.bob,
        )
        .await;
    let decided = r.body["items"]
        .as_array()
        .unwrap()
        .iter()
        .find(|e| e["eventType"] == "approval_decided")
        .unwrap()
        .clone();
    assert_eq!(decided["actorUsername"], "bob");
}

#[sqlx::test]
async fn reject_cancels_without_action(pool: PgPool) {
    let w = world(pool.clone()).await;
    let app = &w.app;
    let case_id = app
        .create_case(&w.alice, 6_400.0, Some(5_900.0), "hosting")
        .await;
    let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = app.wait_run(&w.bob, run_id, &["AWAITING_APPROVAL"]).await;
    assert_eq!(run["output"]["riskLevel"], "medium");
    let approval_id = run["approval"]["id"].as_i64().unwrap();

    let r = app
        .post(
            &format!("/api/approvals/{approval_id}/decision"),
            &w.bob,
            json!({"decision": "reject", "reason": "known renewal"}),
        )
        .await;
    assert_eq!(r.status, StatusCode::OK);
    assert_eq!(r.body["status"], "REJECTED");
    let run = app.wait_run(&w.alice, run_id, &["CANCELLED"]).await;
    assert_eq!(run["approval"]["status"], "REJECTED");
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
            run_id
        )
        .await,
        0
    );
    assert_eq!(
        app.get(&format!("/api/cases/{case_id}"), &w.alice)
            .await
            .body["status"],
        "OPEN"
    );
    let types = app.audit_types(&w.alice, run_id).await;
    assert!(types.contains(&"approval_decided".to_string()));
    assert!(!types.contains(&"action_executed".to_string()));
}

#[sqlx::test]
async fn low_risk_completes_without_approval(pool: PgPool) {
    let w = world(pool.clone()).await;
    let app = &w.app;
    let case_id = app
        .create_case(&w.alice, 1_180.0, Some(1_050.0), "supplies")
        .await;
    let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = app
        .wait_run(&w.alice, run_id, &["COMPLETED", "FAILED"])
        .await;
    assert_eq!(run["status"], "COMPLETED");
    assert_eq!(run["output"]["recommendedAction"], "no_action");
    assert_eq!(run["output"]["requiresApproval"], false);
    assert!(run["approval"].is_null());
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM approvals WHERE agent_run_id = $1",
            run_id
        )
        .await,
        0
    );
    assert!(
        app.audit_types(&w.alice, run_id)
            .await
            .contains(&"action_skipped".to_string())
    );
    // list filters
    let r = app
        .get(
            &format!("/api/agent-runs?status=COMPLETED&caseId={case_id}"),
            &w.alice,
        )
        .await;
    assert_eq!(r.body["total"], 1);
    assert_eq!(
        app.get("/api/agent-runs?status=FAILED", &w.alice)
            .await
            .body["total"],
        0
    );
    assert_eq!(
        app.get("/api/agent-runs", &w.bob).await.body["total"],
        1,
        "assigned reviewer sees it"
    );
    assert_eq!(app.get("/api/agent-runs", &w.dave).await.body["total"], 0);
}

#[sqlx::test]
async fn invalid_llm_output_fails_without_approval(pool: PgPool) {
    let w = world(pool.clone()).await;
    let app = &w.app;
    for (desc, err_event) in [
        ("[mock:invalid] garbage", "llm_response_invalid"),
        ("[mock:timeout]", "llm_error"),
    ] {
        let case_id = app
            .create_case(&w.alice, 48_750.0, Some(4_200.0), desc)
            .await;
        let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
        let run = app
            .wait_run(
                &w.alice,
                run_id,
                &["FAILED", "AWAITING_APPROVAL", "COMPLETED"],
            )
            .await;
        assert_eq!(run["status"], "FAILED", "{desc}");
        assert_eq!(run["attempts"], 2, "retried once");
        assert!(run["error"].as_str().unwrap().len() > 3);
        assert!(run["output"].is_null());
        assert!(run["approval"].is_null());
        assert_eq!(
            count(
                &pool,
                "SELECT count(*) FROM approvals WHERE agent_run_id = $1",
                run_id
            )
            .await,
            0
        );
        let types = app.audit_types(&w.alice, run_id).await;
        assert_eq!(
            types.iter().filter(|t| *t == err_event).count(),
            2,
            "{types:?}"
        );
        assert_eq!(types.iter().filter(|t| *t == "llm_request").count(), 2);
    }
}

#[sqlx::test]
async fn slow_run_is_observable_as_running(pool: PgPool) {
    let w = world(pool).await;
    let app = &w.app;
    let case_id = app.create_case(&w.alice, 100.0, None, "[mock:slow]").await;
    let run_id = app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = app.wait_run(&w.alice, run_id, &["RUNNING"]).await;
    assert_eq!(run["status"], "RUNNING");
}

#[sqlx::test]
async fn concurrent_decisions_exactly_one_wins(pool: PgPool) {
    let w = world(pool.clone()).await;
    let case_id = w
        .app
        .create_case(&w.alice, 48_750.0, Some(4_200.0), "race")
        .await;
    let run_id = w.app.start_run(&w.alice, case_id, w.bob_id).await;
    let run = w
        .app
        .wait_run(&w.alice, run_id, &["AWAITING_APPROVAL"])
        .await;
    let approval_id = run["approval"]["id"].as_i64().unwrap();

    let app = Arc::new(w.app);
    let mut handles = Vec::new();
    for i in 0..10 {
        let app = app.clone();
        let bob = w.bob.clone();
        handles.push(tokio::spawn(async move {
            let decision = if i % 2 == 0 { "approve" } else { "reject" };
            app.post(
                &format!("/api/approvals/{approval_id}/decision"),
                &bob,
                json!({"decision": decision}),
            )
            .await
            .status
        }));
    }
    let mut statuses = Vec::new();
    for h in handles {
        statuses.push(h.await.unwrap());
    }
    assert_eq!(
        statuses.iter().filter(|s| **s == StatusCode::OK).count(),
        1,
        "{statuses:?}"
    );
    assert_eq!(
        statuses
            .iter()
            .filter(|s| **s == StatusCode::CONFLICT)
            .count(),
        9,
        "{statuses:?}"
    );

    let final_run = app
        .wait_run(&w.alice, run_id, &["COMPLETED", "CANCELLED"])
        .await;
    let execs = count(
        &pool,
        "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
        run_id,
    )
    .await;
    match final_run["status"].as_str().unwrap() {
        "COMPLETED" => assert_eq!(execs, 1),
        _ => assert_eq!(execs, 0),
    }
    assert_eq!(count(&pool, "SELECT count(*) FROM audit_events WHERE agent_run_id = $1 AND event_type = 'approval_decided'", run_id).await, 1);
}

/// Insert a run directly in a given state (simulating a crash mid-flight).
async fn insert_run(pool: &PgPool, case_id: i64, creator: i64, reviewer: i64, status: &str) -> i64 {
    let output = json!({"riskLevel": "high", "reasoningSummary": "test", "recommendedAction": "flag_invoice_for_review", "requiresApproval": true});
    let (id,): (i64,) = sqlx::query_as(
        "INSERT INTO agent_runs (case_id, status, model_identifier, llm_mode, input_snapshot, output, created_by, reviewer_id)
         SELECT $1, $2, 'mock', 'mock', input_data, $3, $4, $5 FROM cases WHERE id = $1 RETURNING id",
    )
    .bind(case_id)
    .bind(status)
    .bind(output)
    .bind(creator)
    .bind(reviewer)
    .fetch_one(pool)
    .await
    .unwrap();
    id
}

async fn insert_approval(pool: &PgPool, run_id: i64, reviewer: i64, status: &str) -> i64 {
    let (id,): (i64,) = sqlx::query_as(
        "INSERT INTO approvals (agent_run_id, reviewer_id, proposed_action, status, decided_by, decided_at)
         VALUES ($1, $2, 'flag_invoice_for_review', $3,
                 CASE WHEN $3 = 'PENDING' THEN NULL ELSE $2 END,
                 CASE WHEN $3 = 'PENDING' THEN NULL ELSE now() END)
         RETURNING id",
    )
    .bind(run_id)
    .bind(reviewer)
    .bind(status)
    .fetch_one(pool)
    .await
    .unwrap();
    id
}

async fn status_of(pool: &PgPool, run_id: i64) -> String {
    let (s,): (String,) = sqlx::query_as("SELECT status FROM agent_runs WHERE id = $1")
        .bind(run_id)
        .fetch_one(pool)
        .await
        .unwrap();
    s
}

#[sqlx::test]
async fn restart_recovery(pool: PgPool) {
    let w = world(pool.clone()).await;
    let app = &w.app;
    let case_approved = app
        .create_case(&w.alice, 48_750.0, Some(4_200.0), "a")
        .await;
    let case_other = app
        .create_case(&w.alice, 48_750.0, Some(4_200.0), "b")
        .await;

    let approved_run = insert_run(&pool, case_approved, w.alice_id, w.bob_id, "APPROVED").await;
    insert_approval(&pool, approved_run, w.bob_id, "APPROVED").await;
    let running_approved = insert_run(&pool, case_other, w.alice_id, w.bob_id, "RUNNING").await;
    insert_approval(&pool, running_approved, w.bob_id, "APPROVED").await;
    let pending_run = insert_run(&pool, case_other, w.alice_id, w.bob_id, "PENDING").await;
    let running_run = insert_run(&pool, case_other, w.alice_id, w.bob_id, "RUNNING").await;
    let awaiting_run =
        insert_run(&pool, case_other, w.alice_id, w.bob_id, "AWAITING_APPROVAL").await;
    insert_approval(&pool, awaiting_run, w.bob_id, "PENDING").await;
    let rejected_run = insert_run(&pool, case_other, w.alice_id, w.bob_id, "REJECTED").await;
    insert_approval(&pool, rejected_run, w.bob_id, "REJECTED").await;

    let report = recover_runs(&app.state).await.unwrap();
    assert_eq!((report.failed, report.resumed, report.cancelled), (2, 2, 1));

    assert_eq!(status_of(&pool, approved_run).await, "COMPLETED");
    assert_eq!(status_of(&pool, running_approved).await, "COMPLETED");
    assert_eq!(status_of(&pool, pending_run).await, "FAILED");
    assert_eq!(status_of(&pool, running_run).await, "FAILED");
    assert_eq!(status_of(&pool, awaiting_run).await, "AWAITING_APPROVAL");
    assert_eq!(status_of(&pool, rejected_run).await, "CANCELLED");
    for run in [approved_run, running_approved] {
        assert_eq!(
            count(
                &pool,
                "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
                run
            )
            .await,
            1
        );
    }
    assert_eq!(
        app.get(&format!("/api/cases/{case_approved}"), &w.alice)
            .await
            .body["status"],
        "FLAGGED_FOR_REVIEW"
    );
    assert_eq!(count(&pool, "SELECT count(*) FROM audit_events WHERE agent_run_id = $1 AND event_type = 'run_recovered'", pending_run).await, 1);

    // running recovery again is a no-op (idempotent, still exactly one execution)
    let again = recover_runs(&app.state).await.unwrap();
    assert_eq!((again.failed, again.resumed, again.cancelled), (0, 0, 0));
    assert_eq!(
        count(
            &pool,
            "SELECT count(*) FROM action_executions WHERE agent_run_id = $1",
            approved_run
        )
        .await,
        1
    );
}

#[sqlx::test]
async fn seed_is_idempotent(pool: PgPool) {
    let r1 = agentops::seed::run(&pool, "demo-password-123")
        .await
        .unwrap();
    assert_eq!((r1.users_created, r1.cases_created), (4, 3));
    let r2 = agentops::seed::run(&pool, "demo-password-123")
        .await
        .unwrap();
    assert_eq!((r2.users_created, r2.cases_created), (0, 0));
}
