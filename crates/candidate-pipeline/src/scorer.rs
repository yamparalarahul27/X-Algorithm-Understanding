use crate::{Candidate, Query};

/// Returns an additive score contribution for a candidate.
///
/// Candidates are scored in isolation — a scorer must not consult other
/// candidates in the pool. This preserves cacheability and makes scoring
/// trivially parallel.
pub trait Scorer: Send + Sync {
    fn score(&self, query: &Query, candidate: &Candidate) -> f32;
}
