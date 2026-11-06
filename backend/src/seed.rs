//! Idempotent synthetic demo data (TEST/DEMO ONLY — never use these credentials in production).

use chrono::NaiveDate;
use sqlx::PgPool;

use crate::cases::{self, InvoiceInput};
use crate::domain::Role;
use crate::error::{AppError, AppResult};
use crate::users;

pub const DEFAULT_SEED_PASSWORD: &str = "demo-password-123";

pub const DEMO_USERS: &[(&str, Role)] = &[
    ("alice", Role::Operator),
    ("carol", Role::Operator),
    ("bob", Role::Reviewer),
    ("dave", Role::Reviewer),
];

#[derive(Debug, Default)]
pub struct SeedReport {
    pub users_created: usize,
    pub cases_created: usize,
}

fn demo_cases() -> Vec<(&'static str, InvoiceInput)> {
    let d = |m, day| NaiveDate::from_ymd_opt(2026, m, day).expect("valid date");
    vec![
        (
            "Northwind Logistics — unusual freight invoice",
            InvoiceInput {
                invoice_number: "INV-2026-0481".into(),
                vendor: "Northwind Logistics GmbH".into(),
                amount: 48_750.0,
                currency: "EUR".into(),
                issue_date: d(10, 28),
                description: "Express freight services, October (synthetic demo data)".into(),
                historical_average: Some(4_200.0),
            },
        ),
        (
            "Contoso Office Supplies — monthly order",
            InvoiceInput {
                invoice_number: "INV-2026-0482".into(),
                vendor: "Contoso Office Supplies".into(),
                amount: 1_180.0,
                currency: "EUR".into(),
                issue_date: d(10, 30),
                description: "Paper, toner and stationery (synthetic demo data)".into(),
                historical_average: Some(1_050.0),
            },
        ),
        (
            "Fabrikam Cloud — hosting renewal",
            InvoiceInput {
                invoice_number: "INV-2026-0483".into(),
                vendor: "Fabrikam Cloud Services".into(),
                amount: 6_400.0,
                currency: "EUR".into(),
                issue_date: d(11, 2),
                description: "Quarterly hosting renewal (synthetic demo data)".into(),
                historical_average: Some(5_900.0),
            },
        ),
    ]
}

pub async fn run(db: &PgPool, password: &str) -> AppResult<SeedReport> {
    let mut report = SeedReport::default();
    for (name, role) in DEMO_USERS {
        if users::find_by_username(db, name).await?.is_some() {
            continue;
        }
        match users::create_user(db, name, password.to_string(), *role).await {
            Ok(_) => report.users_created += 1,
            Err(AppError::Conflict(_)) => {}
            Err(e) => return Err(e),
        }
    }
    let alice = users::find_by_username(db, "alice")
        .await?
        .ok_or_else(|| AppError::internal("alice missing after seeding"))?;
    for (title, invoice) in demo_cases() {
        let (exists,): (bool,) = sqlx::query_as(
            "SELECT EXISTS (SELECT 1 FROM cases WHERE created_by = $1 AND input_data->>'invoiceNumber' = $2)",
        )
        .bind(alice.id)
        .bind(&invoice.invoice_number)
        .fetch_one(db)
        .await?;
        if !exists {
            cases::insert_case(db, alice.id, title, &invoice).await?;
            report.cases_created += 1;
        }
    }
    Ok(report)
}
