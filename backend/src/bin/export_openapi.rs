//! Writes the OpenAPI document to `../contracts/openapi/openapi.json` (or the path given as arg 1).

use std::path::PathBuf;

use agentops::api::openapi::ApiDoc;
use utoipa::OpenApi;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../contracts/openapi/openapi.json")
        });
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let json = ApiDoc::openapi().to_pretty_json()?;
    std::fs::write(&path, json + "\n")?;
    println!("wrote {}", path.display());
    Ok(())
}
