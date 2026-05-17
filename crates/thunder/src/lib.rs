//! In-memory store of recent posts from accounts each user follows.
//!
//! Production Thunder ingests Kafka post-events and serves sub-ms lookups
//! without touching a database. This crate keeps the same shape but backs
//! the store with a `Mutex<HashMap>` for local development.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use candidate_pipeline::{Candidate, CandidateSource, Query};

#[derive(Debug, Clone)]
pub struct PostEvent {
    pub post_id: u64,
    pub author_id: u64,
    pub created_at_secs: u64,
}

#[derive(Default)]
pub struct Thunder {
    by_author: Mutex<HashMap<u64, Vec<PostEvent>>>,
    follows: Mutex<HashMap<u64, Vec<u64>>>,
    max_per_author: usize,
}

impl Thunder {
    pub fn new(max_per_author: usize) -> Self {
        Self {
            by_author: Mutex::new(HashMap::new()),
            follows: Mutex::new(HashMap::new()),
            max_per_author,
        }
    }

    pub fn set_follows(&self, user_id: u64, follows: Vec<u64>) {
        self.follows.lock().unwrap().insert(user_id, follows);
    }

    pub fn ingest(&self, event: PostEvent) {
        let mut store = self.by_author.lock().unwrap();
        let bucket = store.entry(event.author_id).or_default();
        bucket.push(event);
        if bucket.len() > self.max_per_author {
            let overflow = bucket.len() - self.max_per_author;
            bucket.drain(0..overflow);
        }
    }

    pub fn recent_for(&self, user_id: u64, max_total: usize) -> Vec<PostEvent> {
        let follows = match self.follows.lock().unwrap().get(&user_id) {
            Some(ids) => ids.clone(),
            None => return Vec::new(),
        };
        let store = self.by_author.lock().unwrap();
        let mut out: Vec<PostEvent> = follows
            .iter()
            .flat_map(|id| store.get(id).cloned().unwrap_or_default())
            .collect();
        out.sort_by(|a, b| b.created_at_secs.cmp(&a.created_at_secs));
        out.truncate(max_total);
        out
    }
}

impl CandidateSource for Thunder {
    fn name(&self) -> &'static str {
        "thunder"
    }

    fn fetch(&self, query: &Query) -> Vec<Candidate> {
        self.recent_for(query.user_id, query.max_candidates * 4)
            .into_iter()
            .map(|e| {
                let mut c = Candidate::new(e.post_id, e.author_id, "thunder");
                c.features
                    .insert("age_secs".into(), age_secs(e.created_at_secs) as f32);
                c
            })
            .collect()
    }
}

fn age_secs(created_at_secs: u64) -> u64 {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(created_at_secs);
    now.saturating_sub(created_at_secs)
}
