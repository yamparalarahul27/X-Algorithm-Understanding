use crate::{Candidate, Query};

/// Drops candidates that should not be ranked (duplicates, blocked, etc).
pub trait Filter: Send + Sync {
    fn keep(&self, query: &Query, candidate: &Candidate) -> bool;
}
