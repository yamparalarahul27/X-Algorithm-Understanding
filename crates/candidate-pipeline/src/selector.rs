use crate::{Candidate, Query};

/// Final stage: pick and order the candidates that will be returned.
pub trait Selector: Send + Sync {
    fn select(&self, query: &Query, candidates: Vec<Candidate>) -> Vec<Candidate>;
}

pub struct TopKByScore;

impl Selector for TopKByScore {
    fn select(&self, query: &Query, mut candidates: Vec<Candidate>) -> Vec<Candidate> {
        candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        candidates.truncate(query.max_candidates);
        candidates
    }
}
