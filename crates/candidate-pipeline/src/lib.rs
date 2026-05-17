//! Reusable building blocks for a recommendation pipeline.
//!
//! Mirrors the trait layout of `xai-org/x-algorithm`'s candidate-pipeline:
//! a [`Pipeline`] is composed of one or more [`CandidateSource`]s, then a
//! chain of [`Hydrator`]s, [`Filter`]s, [`Scorer`]s, and finally a
//! [`Selector`].

pub mod filter;
pub mod hydrator;
pub mod pipeline;
pub mod scorer;
pub mod selector;
pub mod source;

pub use filter::Filter;
pub use hydrator::Hydrator;
pub use pipeline::{Candidate, Pipeline, Query};
pub use scorer::Scorer;
pub use selector::Selector;
pub use source::CandidateSource;
