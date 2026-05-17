use crate::{Candidate, Query};

/// Attaches metadata or features to a candidate (author info, media, etc).
pub trait Hydrator: Send + Sync {
    fn hydrate(&self, query: &Query, candidate: &mut Candidate);
}
