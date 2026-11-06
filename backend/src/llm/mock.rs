//! Deterministic mock provider (default; used in tests and demos without LM Studio).
//!
//! Rules: high + flag if amount > 3× historicalAverage (when present) or amount ≥ 10 000;
//! medium + flag if amount ≥ 5 000; otherwise low + no_action.
//! Test hooks in the invoice description: `[mock:invalid]`, `[mock:timeout]`, `[mock:slow]`.

use std::time::Duration;

use async_trait::async_trait;

use super::{AgentAnalysis, LlmError, LlmProvider, requires_approval};
use crate::cases::InvoiceInput;
use crate::domain::{ActionName, LlmMode, RiskLevel};

pub const MOCK_MODEL_ID: &str = "mock-invoice-analyst-v1";

#[derive(Debug, Default, Clone)]
pub struct MockProvider {
    slow_delay: Option<Duration>,
}

impl MockProvider {
    pub fn new() -> Self {
        Self {
            slow_delay: Some(Duration::from_secs(2)),
        }
    }

    /// Pure, deterministic classification.
    pub fn classify(invoice: &InvoiceInput) -> AgentAnalysis {
        let amount = invoice.amount;
        let ratio = invoice
            .historical_average
            .filter(|h| *h > 0.0)
            .map(|h| amount / h);
        let (risk, action, summary) = if ratio.is_some_and(|r| r > 3.0) || amount >= 10_000.0 {
            let why = match ratio {
                Some(r) if r > 3.0 => format!(
                    "Amount {amount:.2} {} is {r:.1}x the historical average for {}; this deviation is highly unusual.",
                    invoice.currency, invoice.vendor
                ),
                _ => format!(
                    "Amount {amount:.2} {} exceeds the 10,000 high-value threshold.",
                    invoice.currency
                ),
            };
            (RiskLevel::High, ActionName::FlagInvoiceForReview, why)
        } else if amount >= 5_000.0 {
            (
                RiskLevel::Medium,
                ActionName::FlagInvoiceForReview,
                format!(
                    "Amount {amount:.2} {} is above the 5,000 review threshold; a human check is recommended.",
                    invoice.currency
                ),
            )
        } else {
            (
                RiskLevel::Low,
                ActionName::NoAction,
                format!(
                    "Amount {amount:.2} {} is within normal range for {}; no action needed.",
                    invoice.currency, invoice.vendor
                ),
            )
        };
        AgentAnalysis {
            risk_level: risk,
            reasoning_summary: summary,
            recommended_action: action,
            requires_approval: requires_approval(action),
        }
    }
}

#[async_trait]
impl LlmProvider for MockProvider {
    async fn analyze(&self, invoice: &InvoiceInput) -> Result<AgentAnalysis, LlmError> {
        let d = invoice.description.as_str();
        if d.contains("[mock:invalid]") {
            return Err(LlmError::InvalidOutput(
                "mock: model returned malformed JSON".into(),
            ));
        }
        if d.contains("[mock:timeout]") {
            return Err(LlmError::Timeout);
        }
        if d.contains("[mock:slow]")
            && let Some(delay) = self.slow_delay
        {
            tokio::time::sleep(delay).await;
        }
        Ok(Self::classify(invoice))
    }

    fn model_id(&self) -> String {
        MOCK_MODEL_ID.into()
    }

    fn mode(&self) -> LlmMode {
        LlmMode::Mock
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn inv(amount: f64, avg: Option<f64>) -> InvoiceInput {
        InvoiceInput {
            invoice_number: "INV-1".into(),
            vendor: "Acme".into(),
            amount,
            currency: "EUR".into(),
            issue_date: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap(),
            description: "x".into(),
            historical_average: avg,
        }
    }

    #[test]
    fn deterministic_rules() {
        let a = MockProvider::classify(&inv(48_750.0, Some(4_200.0)));
        assert_eq!(a.risk_level, RiskLevel::High);
        assert_eq!(a.recommended_action, ActionName::FlagInvoiceForReview);
        assert!(a.requires_approval);
        assert_eq!(
            MockProvider::classify(&inv(3_500.0, Some(1_000.0))).risk_level,
            RiskLevel::High
        );
        assert_eq!(
            MockProvider::classify(&inv(6_400.0, Some(5_900.0))).risk_level,
            RiskLevel::Medium
        );
        let low = MockProvider::classify(&inv(1_180.0, Some(1_050.0)));
        assert_eq!(low.risk_level, RiskLevel::Low);
        assert_eq!(low.recommended_action, ActionName::NoAction);
        assert!(!low.requires_approval);
        assert_eq!(
            MockProvider::classify(&inv(10_000.0, None)).risk_level,
            RiskLevel::High
        );
    }
}
