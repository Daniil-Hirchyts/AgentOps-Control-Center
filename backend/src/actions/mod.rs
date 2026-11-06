//! Whitelisted business actions. The LLM can only *name* one of these; it never executes code.
//! Every action runs inside the caller's transaction so it commits atomically with the
//! `action_executions` ledger row (exactly-once).

use serde_json::{Value, json};
use sqlx::PgConnection;

use crate::domain::{ActionName, CaseStatus};
use crate::error::AppResult;

/// Execute an allowlisted action against a case. Returns a JSON result for the ledger.
pub async fn execute(
    conn: &mut PgConnection,
    action: ActionName,
    case_id: i64,
) -> AppResult<Value> {
    match action {
        ActionName::FlagInvoiceForReview => flag_invoice_for_review(conn, case_id).await,
        ActionName::NoAction => Ok(json!({"action": "no_action", "changed": false})),
    }
}

async fn flag_invoice_for_review(conn: &mut PgConnection, case_id: i64) -> AppResult<Value> {
    let prev: Option<(String,)> = sqlx::query_as(
        "UPDATE cases c SET status = $2, updated_at = now()
         FROM (SELECT id, status FROM cases WHERE id = $1 FOR UPDATE) old
         WHERE c.id = old.id
         RETURNING old.status",
    )
    .bind(case_id)
    .bind(CaseStatus::FlaggedForReview.as_str())
    .fetch_optional(&mut *conn)
    .await?;
    Ok(json!({
        "action": ActionName::FlagInvoiceForReview.as_str(),
        "caseId": case_id,
        "previousStatus": prev.map(|p| p.0),
        "newStatus": CaseStatus::FlaggedForReview.as_str(),
    }))
}
