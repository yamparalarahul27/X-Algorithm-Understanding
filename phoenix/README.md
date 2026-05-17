# phoenix

ML half of the candidate pipeline.

- `phoenix.retrieval.two_tower` — two-tower model that surfaces out-of-network
  candidates by user/post embedding similarity.
- `phoenix.ranking.transformer` — Grok-derived transformer that predicts
  per-engagement probabilities (fav / reply / repost / negative) and emits a
  single relevance score.

The stubs in this scaffold use the Python standard library so the package
imports without ML dependencies. Install the `ml` extra (`pip install -e
.[ml]`) to wire in numpy/torch when you swap in real model code.

```
python -m phoenix.cli
```
