//! Demo orchestrator: wires Thunder + a mock Phoenix scorer through the
//! candidate pipeline and prints the top results for a synthetic query.
//!
//! In production the Phoenix scorer would be a gRPC call into the Python
//! ranking service. Here we stub it with a deterministic heuristic so the
//! workspace builds and runs with stdlib only.

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use candidate_pipeline::selector::TopKByScore;
use candidate_pipeline::{Candidate, CandidateSource, Filter, Hydrator, Pipeline, Query, Scorer};
use thunder::{PostEvent, Thunder};

struct PhoenixRetrieval;

impl CandidateSource for PhoenixRetrieval {
    fn name(&self) -> &'static str {
        "phoenix-retrieval"
    }

    fn fetch(&self, query: &Query) -> Vec<Candidate> {
        (0..20)
            .map(|i| {
                let post_id = 10_000 + query.user_id * 100 + i;
                let author_id = 5_000 + i;
                Candidate::new(post_id, author_id, "phoenix")
            })
            .collect()
    }
}

struct AuthorAffinity;

impl Hydrator for AuthorAffinity {
    fn hydrate(&self, query: &Query, candidate: &mut Candidate) {
        let affinity = ((candidate.author_id ^ query.user_id) % 100) as f32 / 100.0;
        candidate.features.insert("author_affinity".into(), affinity);
    }
}

struct DropOldPosts {
    max_age_secs: f32,
}

impl Filter for DropOldPosts {
    fn keep(&self, _query: &Query, candidate: &Candidate) -> bool {
        candidate
            .features
            .get("age_secs")
            .map(|age| *age <= self.max_age_secs)
            .unwrap_or(true)
    }
}

/// Stand-in for the Phoenix transformer ranker. Combines a few feature
/// signals into a single relevance score.
struct PhoenixRanker;

impl Scorer for PhoenixRanker {
    fn score(&self, _query: &Query, candidate: &Candidate) -> f32 {
        let affinity = *candidate.features.get("author_affinity").unwrap_or(&0.0);
        let age_penalty = candidate
            .features
            .get("age_secs")
            .map(|s| s / 86_400.0)
            .unwrap_or(0.0);
        let source_bias = if candidate.source == "thunder" { 0.2 } else { 0.0 };
        affinity - 0.1 * age_penalty + source_bias
    }
}

fn seed_thunder() -> Thunder {
    let thunder = Thunder::new(256);
    thunder.set_follows(1, vec![5_001, 5_005, 5_009]);
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    for author in [5_001u64, 5_005, 5_009] {
        for offset in 0..5 {
            thunder.ingest(PostEvent {
                post_id: author * 1_000 + offset,
                author_id: author,
                created_at_secs: now.saturating_sub(offset * 3_600),
            });
        }
    }
    thunder
}

fn main() {
    let thunder = seed_thunder();
    let pipeline = Pipeline::builder()
        .source(Box::new(thunder))
        .source(Box::new(PhoenixRetrieval))
        .hydrator(Box::new(AuthorAffinity))
        .filter(Box::new(DropOldPosts {
            max_age_secs: 7.0 * 86_400.0,
        }))
        .scorer(Box::new(PhoenixRanker))
        .selector(Box::new(TopKByScore))
        .build()
        .expect("pipeline build");

    let mut context = HashMap::new();
    context.insert("locale".into(), "en-US".into());
    let query = Query {
        user_id: 1,
        max_candidates: 10,
        context,
    };

    let results = pipeline.run(&query);
    println!("home-mixer: produced {} candidates", results.len());
    for c in &results {
        println!(
            "  post={} author={} source={} score={:.3}",
            c.post_id, c.author_id, c.source, c.score
        );
    }
}
