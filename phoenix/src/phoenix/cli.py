"""Run a tiny end-to-end demo against the stub models."""

from __future__ import annotations

from phoenix.ranking import RankerConfig, TransformerRanker
from phoenix.retrieval import TwoTowerConfig, TwoTowerModel


def main() -> None:
    retriever = TwoTowerModel(TwoTowerConfig(embedding_dim=32))
    ranker = TransformerRanker(RankerConfig())

    user_id = 1
    candidate_pool = list(range(10_000, 10_050))
    retrieved = retriever.retrieve(user_id, candidate_pool, top_k=5)

    print(f"phoenix: retrieved {len(retrieved)} candidates for user={user_id}")
    for post_id, sim in retrieved:
        heads = ranker.predict(user_id, post_id, engagement_history=[42, 43, 44])
        print(
            f"  post={post_id} sim={sim:+.3f} "
            f"fav={heads.fav:.3f} reply={heads.reply:.3f} "
            f"repost={heads.repost:.3f} neg={heads.negative:.3f} "
            f"relevance={heads.relevance():+.3f}"
        )


if __name__ == "__main__":
    main()
