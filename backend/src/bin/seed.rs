//! Seed synthetic demo users and cases (idempotent). TEST/DEMO ONLY.
//! Password: env `SEED_PASSWORD` (default `demo-password-123`).

use agentops::{MIGRATOR, seed};
use sqlx::postgres::PgPoolOptions;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL")?;
    let password =
        std::env::var("SEED_PASSWORD").unwrap_or_else(|_| seed::DEFAULT_SEED_PASSWORD.into());
    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&url)
        .await?;
    MIGRATOR.run(&pool).await?;
    let report = seed::run(&pool, &password)
        .await
        .map_err(|e| e.to_string())?;
    println!(
        "seed done: {} users created, {} cases created (users: alice, carol = OPERATOR; bob, dave = REVIEWER)",
        report.users_created, report.cases_created
    );
    Ok(())
}
