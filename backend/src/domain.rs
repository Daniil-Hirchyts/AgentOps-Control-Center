//! Typed domain enums. All of them are stored as TEXT in PostgreSQL and converted explicitly.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

macro_rules! text_enum {
    ($(#[$m:meta])* $name:ident { $($var:ident => $s:tt),+ $(,)? }) => {
        $(#[$m])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, ToSchema)]
        pub enum $name {
            $( #[serde(rename = $s)] $var ),+
        }

        impl $name {
            pub const ALL: &'static [$name] = &[$($name::$var),+];

            pub fn as_str(self) -> &'static str {
                match self { $($name::$var => $s),+ }
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str(self.as_str())
            }
        }

        impl std::str::FromStr for $name {
            type Err = String;
            fn from_str(s: &str) -> Result<Self, String> {
                match s {
                    $($s => Ok($name::$var),)+
                    other => Err(format!("invalid {} value: {other}", stringify!($name))),
                }
            }
        }

        impl TryFrom<String> for $name {
            type Error = String;
            fn try_from(s: String) -> Result<Self, String> {
                s.parse()
            }
        }
    };
}

text_enum!(
    /// User role.
    Role { Operator => "OPERATOR", Reviewer => "REVIEWER" }
);

text_enum!(
    /// Agent run lifecycle status (see the state machine in CONTRACT.md).
    RunStatus {
        Pending => "PENDING",
        Running => "RUNNING",
        AwaitingApproval => "AWAITING_APPROVAL",
        Approved => "APPROVED",
        Rejected => "REJECTED",
        Completed => "COMPLETED",
        Cancelled => "CANCELLED",
        Failed => "FAILED",
    }
);

text_enum!(
    /// Approval request status.
    ApprovalStatus { Pending => "PENDING", Approved => "APPROVED", Rejected => "REJECTED" }
);

text_enum!(
    /// Business case status.
    CaseStatus { Open => "OPEN", FlaggedForReview => "FLAGGED_FOR_REVIEW", Closed => "CLOSED" }
);

text_enum!(
    /// Whitelisted actions the agent may propose. Only these Rust functions can ever run.
    ActionName { FlagInvoiceForReview => "flag_invoice_for_review", NoAction => "no_action" }
);

text_enum!(
    /// Risk level produced by the analysis.
    RiskLevel { Low => "low", Medium => "medium", High => "high" }
);

text_enum!(
    /// LLM execution mode.
    LlmMode { Real => "real", Mock => "mock" }
);

text_enum!(
    /// Reviewer decision.
    Decision { Approve => "approve", Reject => "reject" }
);
