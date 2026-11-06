//! LLM provider abstraction: deterministic mock + OpenAI-compatible (LM Studio) adapter.

pub mod mock;
pub mod openai_compat;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::cases::InvoiceInput;
use crate::domain::{ActionName, LlmMode, RiskLevel};

/// Validated analysis produced by the agent (API/DB representation, camelCase).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AgentAnalysis {
    pub risk_level: RiskLevel,
    pub reasoning_summary: String,
    pub recommended_action: ActionName,
    /// Set by backend policy, not by the model.
    pub requires_approval: bool,
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum LlmError {
    #[error("LLM server unavailable: {0}")]
    ServerUnavailable(String),
    #[error("LLM request timed out")]
    Timeout,
    #[error("LLM model not loaded: {0}")]
    ModelNotLoaded(String),
    #[error("LLM returned invalid output: {0}")]
    InvalidOutput(String),
    #[error("LLM HTTP error: {0}")]
    Http(String),
}

impl LlmError {
    /// Errors worth a second attempt.
    pub fn is_retryable(&self) -> bool {
        matches!(self, LlmError::InvalidOutput(_) | LlmError::Timeout)
    }

    pub fn kind(&self) -> &'static str {
        match self {
            LlmError::ServerUnavailable(_) => "server_unavailable",
            LlmError::Timeout => "timeout",
            LlmError::ModelNotLoaded(_) => "model_not_loaded",
            LlmError::InvalidOutput(_) => "invalid_output",
            LlmError::Http(_) => "http",
        }
    }
}

#[async_trait]
pub trait LlmProvider: Send + Sync {
    async fn analyze(&self, invoice: &InvoiceInput) -> Result<AgentAnalysis, LlmError>;
    /// Model identifier recorded on runs (resolved model once known).
    fn model_id(&self) -> String;
    fn mode(&self) -> LlmMode;
}

/// Backend policy: which actions require human approval. The model's opinion is ignored.
pub fn requires_approval(action: ActionName) -> bool {
    match action {
        ActionName::FlagInvoiceForReview => true,
        ActionName::NoAction => false,
    }
}

/// Raw model output contract (snake_case, strict).
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RawAnalysis {
    pub risk_level: String,
    pub reasoning_summary: String,
    pub recommended_action: String,
    pub requires_approval: bool,
}

/// Validate raw model output into an [`AgentAnalysis`], applying backend approval policy.
pub fn validate_raw(raw: RawAnalysis) -> Result<AgentAnalysis, LlmError> {
    let risk_level: RiskLevel =
        raw.risk_level.trim().parse().map_err(|_| {
            LlmError::InvalidOutput(format!("invalid risk_level '{}'", raw.risk_level))
        })?;
    let summary = raw.reasoning_summary.trim().to_string();
    let len = summary.chars().count();
    if !(1..=2000).contains(&len) {
        return Err(LlmError::InvalidOutput(
            "reasoning_summary must be 1-2000 characters".into(),
        ));
    }
    let action: ActionName = raw.recommended_action.trim().parse().map_err(|_| {
        LlmError::InvalidOutput(format!(
            "recommended_action '{}' is not in the allowlist",
            raw.recommended_action
        ))
    })?;
    Ok(AgentAnalysis {
        risk_level,
        reasoning_summary: summary,
        recommended_action: action,
        requires_approval: requires_approval(action),
    })
}

/// Extract the first top-level JSON object from model text (handles ```json fences,
/// `<think>` blocks and leading/trailing prose).
pub fn extract_json_object(text: &str) -> Option<&str> {
    let text = match text.rfind("</think>") {
        Some(i) => &text[i + "</think>".len()..],
        None => text,
    };
    let start = text.find('{')?;
    let bytes = text.as_bytes();
    let (mut depth, mut in_str, mut escaped) = (0i32, false, false);
    for (i, &b) in bytes.iter().enumerate().skip(start) {
        if in_str {
            match b {
                _ if escaped => escaped = false,
                b'\\' => escaped = true,
                b'"' => in_str = false,
                _ => {}
            }
            continue;
        }
        match b {
            b'"' => in_str = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&text[start..=i]);
                }
            }
            _ => {}
        }
    }
    None
}

/// Parse + validate model text.
pub fn parse_model_output(text: &str) -> Result<AgentAnalysis, LlmError> {
    let json = extract_json_object(text)
        .ok_or_else(|| LlmError::InvalidOutput("no JSON object in model output".into()))?;
    let raw: RawAnalysis = serde_json::from_str(json)
        .map_err(|e| LlmError::InvalidOutput(format!("schema mismatch: {e}")))?;
    validate_raw(raw)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_fenced_json() {
        let t = "Sure!\n```json\n{\"risk_level\":\"high\",\"reasoning_summary\":\"Amount {x} is 11x\",\"recommended_action\":\"flag_invoice_for_review\",\"requires_approval\":false}\n```";
        let a = parse_model_output(t).unwrap();
        assert_eq!(a.risk_level, RiskLevel::High);
        // policy overrides the model
        assert!(a.requires_approval);
    }

    #[test]
    fn rejects_unknown_action_and_fields() {
        let bad_action = r#"{"risk_level":"low","reasoning_summary":"x","recommended_action":"delete_db","requires_approval":false}"#;
        assert!(matches!(
            parse_model_output(bad_action),
            Err(LlmError::InvalidOutput(_))
        ));
        let extra = r#"{"risk_level":"low","reasoning_summary":"x","recommended_action":"no_action","requires_approval":false,"extra":1}"#;
        assert!(matches!(
            parse_model_output(extra),
            Err(LlmError::InvalidOutput(_))
        ));
        assert!(parse_model_output("no json here").is_err());
        let empty = r#"{"risk_level":"low","reasoning_summary":"  ","recommended_action":"no_action","requires_approval":false}"#;
        assert!(parse_model_output(empty).is_err());
    }

    #[test]
    fn strips_think_block() {
        let t = "<think>maybe {not this}</think>{\"risk_level\":\"low\",\"reasoning_summary\":\"ok\",\"recommended_action\":\"no_action\",\"requires_approval\":false}";
        assert_eq!(
            parse_model_output(t).unwrap().recommended_action,
            ActionName::NoAction
        );
    }
}
