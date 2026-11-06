//! Agent workflow: run creation, background worker, approved-action execution, startup recovery.

use serde_json::json;
use sqlx::types::Json as SqlJson;

use super::{RunChange, find_run, publish_status, transition};
use crate::actions;
use crate::audit::{self, event};
use crate::domain::{ActionName, ApprovalStatus, RunStatus};
use crate::error::{AppError, AppResult};
use crate::llm::{AgentAnalysis, LlmError, requires_approval};
use crate::state::AppState;
use crate::websocket::events::{ApprovalRequestedEvent, ServerEvent};

pub const MAX_LLM_ATTEMPTS: i32 = 2;

/// Insert a PENDING run (+ `run_created` audit) and publish its status.
/// The caller starts processing with [`spawn_worker`] once it no longer needs the PENDING snapshot.
pub async fn create_run(
    state: &AppState,
    creator: i64,
    case_id: i64,
    reviewer_id: i64,
    input_snapshot: &serde_json::Value,
) -> AppResult<i64> {
    let mut tx = state.db.begin().await?;
    let change = sqlx::query_as::<_, RunChange>(
        "INSERT INTO agent_runs (case_id, model_identifier, llm_mode, input_snapshot, created_by, reviewer_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, case_id, created_by, reviewer_id, status, updated_at",
    )
    .bind(case_id)
    .bind(state.llm.model_id())
    .bind(state.llm.mode().as_str())
    .bind(input_snapshot)
    .bind(creator)
    .bind(reviewer_id)
    .fetch_one(&mut *tx)
    .await?;
    audit::record(
        &mut *tx,
        Some(change.id),
        Some(creator),
        event::RUN_CREATED,
        json!({"caseId": case_id, "reviewerId": reviewer_id, "llmMode": state.llm.mode(), "model": state.llm.model_id()}),
    )
    .await?;
    tx.commit().await?;
    publish_status(&state.hub, &change);
    tracing::info!(run_id = change.id, case_id, "agent run created");
    Ok(change.id)
}

/// Start the background worker for a freshly created run.
pub fn spawn_worker(state: &AppState, run_id: i64) {
    let worker_state = state.clone();
    tokio::spawn(async move { process_run(worker_state, run_id).await });
}

/// Background worker entry point. Never panics; failures are logged.
pub async fn process_run(state: AppState, run_id: i64) {
    if let Err(e) = process_run_inner(&state, run_id).await {
        tracing::error!(run_id, error = %e, "agent worker failed");
    }
}

async fn simple_transition(
    state: &AppState,
    run_id: i64,
    from: RunStatus,
    to: RunStatus,
    actor: Option<i64>,
    output: Option<&AgentAnalysis>,
    error: Option<&str>,
) -> AppResult<Option<RunChange>> {
    let mut tx = state.db.begin().await?;
    let change = transition(&mut tx, run_id, from, to, actor, output, error).await?;
    tx.commit().await?;
    if let Some(c) = &change {
        publish_status(&state.hub, c);
    }
    Ok(change)
}

async fn process_run_inner(state: &AppState, run_id: i64) -> AppResult<()> {
    if simple_transition(
        state,
        run_id,
        RunStatus::Pending,
        RunStatus::Running,
        None,
        None,
        None,
    )
    .await?
    .is_none()
    {
        tracing::warn!(run_id, "run no longer PENDING; worker exits");
        return Ok(());
    }
    let run = find_run(&state.db, run_id)
        .await?
        .ok_or_else(|| AppError::not_found("agent run"))?;
    let invoice = run.input_snapshot.0.clone();

    let mut result: Result<AgentAnalysis, LlmError> = Err(LlmError::Timeout);
    for attempt in 1..=MAX_LLM_ATTEMPTS {
        sqlx::query("UPDATE agent_runs SET attempts = $2, updated_at = now() WHERE id = $1")
            .bind(run_id)
            .bind(attempt)
            .execute(&state.db)
            .await?;
        audit::record(
            &state.db,
            Some(run_id),
            None,
            event::LLM_REQUEST,
            json!({"attempt": attempt, "model": state.llm.model_id(), "mode": state.llm.mode()}),
        )
        .await?;
        result = state.llm.analyze(&invoice).await;
        match &result {
            Ok(analysis) => {
                audit::record(
                    &state.db,
                    Some(run_id),
                    None,
                    event::LLM_RESPONSE_VALID,
                    json!({"attempt": attempt, "output": analysis}),
                )
                .await?;
                break;
            }
            Err(e) => {
                let ev = if matches!(e, LlmError::InvalidOutput(_)) {
                    event::LLM_RESPONSE_INVALID
                } else {
                    event::LLM_ERROR
                };
                tracing::warn!(run_id, attempt, error = %e, "LLM attempt failed");
                audit::record(
                    &state.db,
                    Some(run_id),
                    None,
                    ev,
                    json!({"attempt": attempt, "kind": e.kind(), "error": e.to_string()}),
                )
                .await?;
                if !e.is_retryable() {
                    break;
                }
            }
        }
    }
    // Record the model actually used (real mode may auto-discover it).
    sqlx::query("UPDATE agent_runs SET model_identifier = $2 WHERE id = $1")
        .bind(run_id)
        .bind(state.llm.model_id())
        .execute(&state.db)
        .await?;

    let mut analysis = match result {
        Ok(a) => a,
        Err(e) => {
            // Never auto-approve: any LLM failure ends the run.
            simple_transition(
                state,
                run_id,
                RunStatus::Running,
                RunStatus::Failed,
                None,
                None,
                Some(&e.to_string()),
            )
            .await?;
            return Ok(());
        }
    };
    // Backend policy decides, not the model.
    analysis.requires_approval = requires_approval(analysis.recommended_action);

    if analysis.requires_approval {
        let mut tx = state.db.begin().await?;
        let Some(change) = transition(
            &mut tx,
            run_id,
            RunStatus::Running,
            RunStatus::AwaitingApproval,
            None,
            Some(&analysis),
            None,
        )
        .await?
        else {
            return Ok(());
        };
        let (approval_id, created_at): (i64, chrono::DateTime<chrono::Utc>) = sqlx::query_as(
            "INSERT INTO approvals (agent_run_id, reviewer_id, proposed_action)
             VALUES ($1, $2, $3) RETURNING id, created_at",
        )
        .bind(run_id)
        .bind(run.reviewer_id)
        .bind(analysis.recommended_action.as_str())
        .fetch_one(&mut *tx)
        .await?;
        audit::record(
            &mut *tx,
            Some(run_id),
            None,
            event::APPROVAL_REQUESTED,
            json!({
                "approvalId": approval_id,
                "reviewerId": run.reviewer_id,
                "proposedAction": analysis.recommended_action,
                "riskLevel": analysis.risk_level,
            }),
        )
        .await?;
        tx.commit().await?;
        publish_status(&state.hub, &change);
        state.hub.send_to_users(
            &[run.reviewer_id, run.created_by],
            &ServerEvent::ApprovalRequested(ApprovalRequestedEvent {
                approval_id,
                run_id,
                case_id: run.case_id,
                case_title: run.case_title.clone(),
                risk_level: analysis.risk_level,
                proposed_action: analysis.recommended_action,
                requested_by: run.created_by,
                created_at,
            }),
        );
    } else {
        let mut tx = state.db.begin().await?;
        let Some(change) = transition(
            &mut tx,
            run_id,
            RunStatus::Running,
            RunStatus::Completed,
            None,
            Some(&analysis),
            None,
        )
        .await?
        else {
            return Ok(());
        };
        audit::record(
            &mut *tx,
            Some(run_id),
            None,
            event::ACTION_SKIPPED,
            json!({"action": analysis.recommended_action, "reason": "no approval required; nothing to execute"}),
        )
        .await?;
        tx.commit().await?;
        publish_status(&state.hub, &change);
    }
    Ok(())
}

/// APPROVED → RUNNING → execute action exactly once → COMPLETED. Idempotent; safe to call again
/// (e.g. from recovery) for a RUNNING run whose approval is APPROVED.
pub async fn execute_approved_run(
    state: &AppState,
    run_id: i64,
    actor: Option<i64>,
) -> AppResult<()> {
    let claimed = simple_transition(
        state,
        run_id,
        RunStatus::Approved,
        RunStatus::Running,
        actor,
        None,
        None,
    )
    .await?;
    if claimed.is_none() {
        let run = find_run(&state.db, run_id)
            .await?
            .ok_or_else(|| AppError::not_found("agent run"))?;
        if run.status != RunStatus::Running {
            return Ok(()); // already handled elsewhere
        }
    }

    let mut tx = state.db.begin().await?;
    // Lock the approval row: serialises concurrent executors for this approval.
    let row: Option<(i64, String, i64, String)> = sqlx::query_as(
        "SELECT a.id, a.proposed_action, r.case_id, a.status
         FROM approvals a JOIN agent_runs r ON r.id = a.agent_run_id
         WHERE a.agent_run_id = $1 FOR UPDATE OF a",
    )
    .bind(run_id)
    .fetch_optional(&mut *tx)
    .await?;
    let Some((approval_id, action, case_id, status)) = row else {
        return Err(AppError::internal(format!("run {run_id} has no approval")));
    };
    if status != ApprovalStatus::Approved.as_str() {
        return Err(AppError::internal(format!(
            "run {run_id}: approval {approval_id} is {status}, refusing to execute"
        )));
    }
    let action: ActionName = action.parse().map_err(AppError::internal)?;
    let (already,): (bool,) =
        sqlx::query_as("SELECT EXISTS (SELECT 1 FROM action_executions WHERE approval_id = $1)")
            .bind(approval_id)
            .fetch_one(&mut *tx)
            .await?;
    if already {
        tracing::info!(run_id, approval_id, "action already executed; skipping");
    } else {
        let result = actions::execute(&mut tx, action, case_id).await?;
        let inserted: Option<(i64,)> = sqlx::query_as(
            "INSERT INTO action_executions (approval_id, agent_run_id, action, result)
             VALUES ($1, $2, $3, $4) ON CONFLICT (approval_id) DO NOTHING RETURNING id",
        )
        .bind(approval_id)
        .bind(run_id)
        .bind(action.as_str())
        .bind(SqlJson(&result))
        .fetch_optional(&mut *tx)
        .await?;
        let Some((execution_id,)) = inserted else {
            // Lost an (unexpected) race: roll back the action side effects.
            tx.rollback().await?;
            return Err(AppError::Conflict("action already executed".into()));
        };
        audit::record(
            &mut *tx,
            Some(run_id),
            actor,
            event::ACTION_EXECUTED,
            json!({"approvalId": approval_id, "executionId": execution_id, "action": action, "result": result}),
        )
        .await?;
        tracing::info!(run_id, approval_id, %action, "action executed");
    }
    let change = transition(
        &mut tx,
        run_id,
        RunStatus::Running,
        RunStatus::Completed,
        actor,
        None,
        None,
    )
    .await?;
    tx.commit().await?;
    if let Some(c) = change {
        publish_status(&state.hub, &c);
    }
    Ok(())
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RecoveryReport {
    pub failed: usize,
    pub resumed: usize,
    pub cancelled: usize,
}

/// Startup recovery (call before serving):
/// * PENDING/RUNNING runs without an approval → FAILED (`run_recovered`)
/// * APPROVED runs, or RUNNING runs with an APPROVED approval → resume execution (idempotent)
/// * REJECTED runs → CANCELLED
/// * AWAITING_APPROVAL runs are left untouched.
pub async fn recover_runs(state: &AppState) -> AppResult<RecoveryReport> {
    let mut report = RecoveryReport::default();

    let orphans: Vec<(i64, String)> = sqlx::query_as(
        "SELECT r.id, r.status FROM agent_runs r
         LEFT JOIN approvals a ON a.agent_run_id = r.id
         WHERE r.status IN ('PENDING', 'RUNNING') AND a.id IS NULL ORDER BY r.id",
    )
    .fetch_all(&state.db)
    .await?;
    for (run_id, status) in orphans {
        let from: RunStatus = status.parse().map_err(AppError::internal)?;
        let mut tx = state.db.begin().await?;
        let change = transition(
            &mut tx,
            run_id,
            from,
            RunStatus::Failed,
            None,
            None,
            Some("interrupted by server restart"),
        )
        .await?;
        if change.is_some() {
            audit::record(
                &mut *tx,
                Some(run_id),
                None,
                event::RUN_RECOVERED,
                json!({"from": from, "to": RunStatus::Failed, "reason": "interrupted by server restart"}),
            )
            .await?;
            report.failed += 1;
        }
        tx.commit().await?;
        if let Some(c) = change {
            publish_status(&state.hub, &c);
        }
    }

    let approved: Vec<(i64, String)> = sqlx::query_as(
        "SELECT r.id, r.status FROM agent_runs r JOIN approvals a ON a.agent_run_id = r.id
         WHERE r.status = 'APPROVED' OR (r.status = 'RUNNING' AND a.status = 'APPROVED')
         ORDER BY r.id",
    )
    .fetch_all(&state.db)
    .await?;
    for (run_id, status) in approved {
        audit::record(
            &state.db,
            Some(run_id),
            None,
            event::RUN_RECOVERED,
            json!({"from": status, "action": "resume_execution"}),
        )
        .await?;
        execute_approved_run(state, run_id, None).await?;
        report.resumed += 1;
    }

    let rejected: Vec<(i64,)> =
        sqlx::query_as("SELECT id FROM agent_runs WHERE status = 'REJECTED' ORDER BY id")
            .fetch_all(&state.db)
            .await?;
    for (run_id,) in rejected {
        let mut tx = state.db.begin().await?;
        let change = transition(
            &mut tx,
            run_id,
            RunStatus::Rejected,
            RunStatus::Cancelled,
            None,
            None,
            None,
        )
        .await?;
        if change.is_some() {
            audit::record(
                &mut *tx,
                Some(run_id),
                None,
                event::RUN_RECOVERED,
                json!({"from": RunStatus::Rejected, "to": RunStatus::Cancelled}),
            )
            .await?;
            report.cancelled += 1;
        }
        tx.commit().await?;
    }

    if report != RecoveryReport::default() {
        tracing::info!(?report, "startup recovery completed");
    }
    Ok(report)
}
