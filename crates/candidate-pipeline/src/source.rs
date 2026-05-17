use crate::{Candidate, Query};

/// Produces an initial pool of candidates for a [`Query`].
pub trait CandidateSource: Send + Sync {
    fn name(&self) -> &'static str;
    fn fetch(&self, query: &Query) -> Vec<Candidate>;
}
