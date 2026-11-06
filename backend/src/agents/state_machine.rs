//! Agent run state machine (CONTRACT.md):
//!
//! ```text
//! PENDING → RUNNING | CANCELLED | FAILED
//! RUNNING → AWAITING_APPROVAL | COMPLETED | FAILED
//! AWAITING_APPROVAL → APPROVED | REJECTED | CANCELLED
//! APPROVED → RUNNING
//! REJECTED → CANCELLED
//! COMPLETED, CANCELLED, FAILED: terminal
//! ```

use crate::domain::RunStatus;

pub fn can_transition(from: RunStatus, to: RunStatus) -> bool {
    use RunStatus::*;
    matches!(
        (from, to),
        (Pending, Running | Cancelled | Failed)
            | (Running, AwaitingApproval | Completed | Failed)
            | (AwaitingApproval, Approved | Rejected | Cancelled)
            | (Approved, Running)
            | (Rejected, Cancelled)
    )
}

pub fn is_terminal(status: RunStatus) -> bool {
    matches!(
        status,
        RunStatus::Completed | RunStatus::Cancelled | RunStatus::Failed
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use RunStatus::*;

    #[test]
    fn full_transition_table() {
        let allowed = [
            (Pending, Running),
            (Pending, Cancelled),
            (Pending, Failed),
            (Running, AwaitingApproval),
            (Running, Completed),
            (Running, Failed),
            (AwaitingApproval, Approved),
            (AwaitingApproval, Rejected),
            (AwaitingApproval, Cancelled),
            (Approved, Running),
            (Rejected, Cancelled),
        ];
        for &from in RunStatus::ALL {
            for &to in RunStatus::ALL {
                assert_eq!(
                    can_transition(from, to),
                    allowed.contains(&(from, to)),
                    "{from} -> {to}"
                );
            }
        }
    }

    #[test]
    fn terminal_states_have_no_exits() {
        for &s in RunStatus::ALL {
            if is_terminal(s) {
                assert!(RunStatus::ALL.iter().all(|&to| !can_transition(s, to)));
            }
        }
        assert!(!is_terminal(AwaitingApproval));
    }

    #[test]
    fn never_skips_approval() {
        assert!(!can_transition(AwaitingApproval, Completed));
        assert!(!can_transition(AwaitingApproval, Running));
        assert!(!can_transition(Rejected, Running));
        assert!(!can_transition(Pending, AwaitingApproval));
        assert!(!can_transition(Pending, Completed));
    }
}
