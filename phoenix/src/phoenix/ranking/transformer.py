"""Transformer ranker adapted from Grok-1.

Consumes a user engagement sequence and a candidate post, then emits
per-engagement probabilities (fav / reply / repost / negative) which are
combined into a single relevance score.

The stub is a deterministic stand-in so the module is importable with
only the standard library. Swap `predict` for a real torch forward pass
when you install the `ml` extras.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class RankerConfig:
    hidden_dim: int = 768
    n_layers: int = 12
    n_heads: int = 12
    max_seq_len: int = 1024


@dataclass
class EngagementHeads:
    fav: float = 0.0
    reply: float = 0.0
    repost: float = 0.0
    negative: float = 0.0

    def relevance(self) -> float:
        # Mirrors X's weighted blend: rewards positive engagement, penalizes
        # negative actions (block, mute, "show less often").
        return (
            0.5 * self.fav
            + 0.2 * self.reply
            + 0.4 * self.repost
            - 1.0 * self.negative
        )


def _sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


class TransformerRanker:
    def __init__(self, config: RankerConfig | None = None) -> None:
        self.config = config or RankerConfig()

    def predict(
        self,
        user_id: int,
        candidate_post_id: int,
        engagement_history: list[int] | None = None,
    ) -> EngagementHeads:
        engagement_history = engagement_history or []
        # Deterministic fake logits — replaced by a torch forward pass in
        # production. Mixes user/post/history so changes propagate.
        seed = hash((user_id, candidate_post_id, tuple(engagement_history))) & 0xFFFFFFFF
        fav_logit = ((seed >> 0) & 0xFF) / 255.0 - 0.5
        reply_logit = ((seed >> 8) & 0xFF) / 255.0 - 0.6
        repost_logit = ((seed >> 16) & 0xFF) / 255.0 - 0.55
        neg_logit = ((seed >> 24) & 0xFF) / 255.0 - 0.8
        return EngagementHeads(
            fav=_sigmoid(fav_logit),
            reply=_sigmoid(reply_logit),
            repost=_sigmoid(repost_logit),
            negative=_sigmoid(neg_logit),
        )
