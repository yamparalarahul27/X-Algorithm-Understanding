use std::collections::HashMap;

use crate::{CandidateSource, Filter, Hydrator, Scorer, Selector};

#[derive(Debug, Clone)]
pub struct Query {
    pub user_id: u64,
    pub max_candidates: usize,
    pub context: HashMap<String, String>,
}

impl Query {
    pub fn new(user_id: u64, max_candidates: usize) -> Self {
        Self {
            user_id,
            max_candidates,
            context: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Candidate {
    pub post_id: u64,
    pub author_id: u64,
    pub source: &'static str,
    pub features: HashMap<String, f32>,
    pub score: f32,
}

impl Candidate {
    pub fn new(post_id: u64, author_id: u64, source: &'static str) -> Self {
        Self {
            post_id,
            author_id,
            source,
            features: HashMap::new(),
            score: 0.0,
        }
    }
}

pub struct Pipeline {
    sources: Vec<Box<dyn CandidateSource>>,
    hydrators: Vec<Box<dyn Hydrator>>,
    filters: Vec<Box<dyn Filter>>,
    scorers: Vec<Box<dyn Scorer>>,
    selector: Box<dyn Selector>,
}

impl Pipeline {
    pub fn builder() -> PipelineBuilder {
        PipelineBuilder::default()
    }

    pub fn run(&self, query: &Query) -> Vec<Candidate> {
        let mut candidates: Vec<Candidate> = self
            .sources
            .iter()
            .flat_map(|s| s.fetch(query))
            .collect();

        for hydrator in &self.hydrators {
            for candidate in candidates.iter_mut() {
                hydrator.hydrate(query, candidate);
            }
        }

        candidates.retain(|c| self.filters.iter().all(|f| f.keep(query, c)));

        for scorer in &self.scorers {
            for candidate in candidates.iter_mut() {
                candidate.score += scorer.score(query, candidate);
            }
        }

        self.selector.select(query, candidates)
    }
}

#[derive(Default)]
pub struct PipelineBuilder {
    sources: Vec<Box<dyn CandidateSource>>,
    hydrators: Vec<Box<dyn Hydrator>>,
    filters: Vec<Box<dyn Filter>>,
    scorers: Vec<Box<dyn Scorer>>,
    selector: Option<Box<dyn Selector>>,
}

impl PipelineBuilder {
    pub fn source(mut self, s: Box<dyn CandidateSource>) -> Self {
        self.sources.push(s);
        self
    }

    pub fn hydrator(mut self, h: Box<dyn Hydrator>) -> Self {
        self.hydrators.push(h);
        self
    }

    pub fn filter(mut self, f: Box<dyn Filter>) -> Self {
        self.filters.push(f);
        self
    }

    pub fn scorer(mut self, s: Box<dyn Scorer>) -> Self {
        self.scorers.push(s);
        self
    }

    pub fn selector(mut self, s: Box<dyn Selector>) -> Self {
        self.selector = Some(s);
        self
    }

    pub fn build(self) -> Result<Pipeline, &'static str> {
        let selector = self.selector.ok_or("pipeline requires a selector")?;
        Ok(Pipeline {
            sources: self.sources,
            hydrators: self.hydrators,
            filters: self.filters,
            scorers: self.scorers,
            selector,
        })
    }
}
