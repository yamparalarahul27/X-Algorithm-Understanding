# forya

A scaffold of a Twitter/X-style "For You" recommendation system, modeled
after the structure of [`xai-org/x-algorithm`][upstream]. The previous
Electron localhost-status app has been replaced with this codebase.

[upstream]: https://github.com/xai-org/x-algorithm

## Layout

```
crates/
  candidate-pipeline/  # Composable traits: source, hydrator, filter, scorer, selector
  thunder/             # In-memory store of recent in-network posts
  home-mixer/          # Orchestrator binary that runs the pipeline
phoenix/               # Python ML package: two-tower retrieval + transformer ranker
```

| Module                | Role                                                                                 | Language |
| --------------------- | ------------------------------------------------------------------------------------ | -------- |
| `home-mixer`          | Drives the full pipeline (hydrate -> source -> enrich -> filter -> score -> select). | Rust     |
| `thunder`             | Holds recent posts from followed authors for sub-ms in-network lookups.              | Rust     |
| `candidate-pipeline`  | Reusable trait framework; everything else plugs into these traits.                   | Rust     |
| `phoenix.retrieval`   | Two-tower model that surfaces out-of-network candidates.                             | Python   |
| `phoenix.ranking`     | Grok-derived transformer that predicts per-engagement probabilities.                 | Python   |

This is a **scaffold**, not a production system. The Rust side has no
external dependencies and the Python side runs on the standard library so
the project builds and runs anywhere with `cargo` and `python3`. The ML
code is a deterministic stub - install `phoenix[ml]` and replace the stubs
to wire in real numpy/torch.

## Running

Rust orchestrator:

```sh
cargo run -p home-mixer
```

Python retrieval + ranking demo:

```sh
PYTHONPATH=phoenix/src python3 -m phoenix.cli
# or, after `pip install -e ./phoenix`:
phoenix-demo
```

## Pipeline shape

1. **Hydrate query** - user id, engagement history, locale.
2. **Source candidates** - Thunder (in-network) + Phoenix retrieval (out-of-network).
3. **Hydrate candidates** - attach author affinity, age, etc.
4. **Filter** - drop old posts, duplicates, blocked content.
5. **Score** - Phoenix transformer emits per-engagement probabilities, blended into one relevance score.
6. **Select** - top-K by score.

Candidates are scored in isolation - a scorer cannot consult other
candidates - which keeps the pipeline cacheable and trivially parallel.

## License

MIT. See `LICENSE`.
