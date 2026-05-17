"""Two-tower retrieval model.

The user tower embeds the requesting user from their engagement history;
the post tower embeds candidate posts. Out-of-network retrieval is an
approximate nearest-neighbor search in the shared embedding space.

This stub uses seeded RNG embeddings so the module imports and runs
without numpy/torch installed. Replace `_embed` with a real `nn.Module`
forward pass when you wire in the ML extras.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class TwoTowerConfig:
    embedding_dim: int = 128
    user_vocab_size: int = 100_000
    post_vocab_size: int = 1_000_000


def _embed(seed: int, dim: int) -> list[float]:
    rng = random.Random(seed)
    return [rng.gauss(0.0, 1.0) for _ in range(dim)]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _norm(v: list[float]) -> float:
    return math.sqrt(sum(x * x for x in v)) or 1.0


class TwoTowerModel:
    def __init__(self, config: TwoTowerConfig | None = None) -> None:
        self.config = config or TwoTowerConfig()

    def embed_user(self, user_id: int) -> list[float]:
        return _embed(hash(("user", user_id)) & 0xFFFFFFFF, self.config.embedding_dim)

    def embed_post(self, post_id: int) -> list[float]:
        return _embed(hash(("post", post_id)) & 0xFFFFFFFF, self.config.embedding_dim)

    def retrieve(
        self,
        user_id: int,
        candidate_post_ids: Iterable[int],
        top_k: int = 100,
    ) -> list[tuple[int, float]]:
        user_vec = self.embed_user(user_id)
        user_norm = _norm(user_vec)
        scored: list[tuple[int, float]] = []
        for pid in candidate_post_ids:
            post_vec = self.embed_post(pid)
            sim = _dot(user_vec, post_vec) / (user_norm * _norm(post_vec))
            scored.append((pid, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]
