use std::process::ExitCode;

use agentops::config::Config;
use agentops::{AppState, MIGRATOR, agents, build_app};
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> ExitCode {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("agentops=info,tower_http=info")),
        )
        .init();
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("fatal: {e}");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env()?;
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&config.database_url)
        .await?;
    MIGRATOR.run(&pool).await?;
    tracing::info!("database migrations applied");

    let bind = config.bind_addr.clone();
    let state = AppState::new(pool, config)?;
    tracing::info!(mode = %state.llm.mode(), model = %state.llm.model_id(), "LLM provider ready");
    agents::service::recover_runs(&state).await?;

    let listener = tokio::net::TcpListener::bind(&bind).await?;
    tracing::info!("listening on http://{bind} (docs at /api/docs)");
    axum::serve(listener, build_app(state))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
            tracing::info!("shutting down");
        })
        .await?;
    Ok(())
}
