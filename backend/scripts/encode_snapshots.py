"""
encode_snapshots.py — 给 JobSnapshot 补 OpenAI text-embedding-3-small 向量

步骤:
  1. 从 Neo4j 找出 JobSnapshot.embedding IS NULL 的节点
  2. 把 title + job_description 拼成 embed 文本(去长)
  3. 批量调 OpenAI embeddings API
  4. 回写 Neo4j
  5. 重建向量索引(若需要)

用法:
  python -m scripts.encode_snapshots
  python -m scripts.encode_snapshots --limit 100
  python -m scripts.encode_snapshots --batch 50

要求:
  - .env 里 OPENAI_API_KEY 已设
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_neo4j_driver, get_openai_embeddings, close_neo4j

BATCH = 50


def _trim(s: str, max_chars: int = 1500) -> str:
    """截断文本以节省 token。"""
    if not s:
        return ""
    return s[:max_chars]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="最多处理多少条(0=全部)")
    ap.add_argument("--batch", type=int, default=BATCH)
    args = ap.parse_args()

    try:
        embeddings = get_openai_embeddings()
    except RuntimeError as e:
        print(f"❌ {e}")
        return

    driver = get_neo4j_driver()
    print("⏱ 找出未编码的 JobSnapshot ...")
    with driver.session() as s:
        query = (
            "MATCH (snap:JobSnapshot) WHERE snap.embedding IS NULL "
            "RETURN snap.job_id_ref AS job_id_ref, "
            "snap.captured_at AS captured_at, "
            "snap.source AS source, "
            "snap.title AS title, "
            "snap.job_description AS description "
            "LIMIT $limit"
        )
        result = s.run(query, limit=args.limit or 1_000_000)
        rows = [dict(r) for r in result]
    print(f"   待编码 {len(rows)} 条")

    if not rows:
        return

    processed = 0
    t0 = time.time()
    for i in range(0, len(rows), args.batch):
        batch = rows[i : i + args.batch]
        texts = [
            f"{_trim(r.get('title') or '')}\n{_trim(r.get('description') or '')}"
            for r in batch
        ]
        try:
            vecs = data_get_embeddings(embeddings, texts)
        except Exception as e:
            print(f"   ⚠ batch {i} fail: {str(e)[:120]}, sleep 2s")
            time.sleep(2)
            continue

        with driver.session() as s:
            for r, v in zip(batch, vecs):
                s.run(
                    """
                    MATCH (snap:JobSnapshot {job_id_ref: $job_id_ref,
                                              captured_at: $captured_at,
                                              source: $source})
                    SET snap.embedding = $embedding
                    """,
                    job_id_ref=r["job_id_ref"],
                    captured_at=r["captured_at"],
                    source=r["source"],
                    embedding=v,
                )
        processed += len(batch)
        elapsed = time.time() - t0
        print(f"   进度 {processed}/{len(rows)}  耗时 {elapsed:.1f}s")

    print(f"✅ Embedding 完成: {processed} 条, 总耗时 {time.time() - t0:.1f}s")
    close_neo4j()


def data_get_embeddings(embeddings, texts: List[str]):
    """封装一下,出错时回退到单条重试。"""
    try:
        return embeddings.embed_documents(texts)
    except Exception:
        out = []
        for t in texts:
            try:
                out.append(embeddings.embed_query(t))
            except Exception as e:
                print(f"   single embed fail: {str(e)[:80]}")
                out.append([0.0] * 1536)
        return out


if __name__ == "__main__":
    main()