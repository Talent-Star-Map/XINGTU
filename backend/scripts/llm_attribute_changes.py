"""
llm_attribute_changes.py — 给 ChangeEvent 补 LLM 归因(reason 字段)

流程:
  1. 找 ChangeEvent WHERE reason IS NULL
  2. 拉同期 Article 节点(同月发布的文章)做上下文
  3. 调 LLM(DeepSeek 主)生成 1-2 句中文归因
  4. 回写 Neo4j

用法:
  python -m scripts.llm_attribute_changes
  python -m scripts.llm_attribute_changes --limit 20
  python -m scripts.llm_attribute_changes --job_id 5
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_neo4j_driver, get_llm_fast, close_neo4j

PROMPT = """你是互联网行业分析师。请根据岗位的变化和同期行业信息,简洁说明变化原因(1-2 句话,中文,30-80 字)。

岗位: {title}
变化类型: {change_type}
变化前: {before}
变化后: {after}
变化幅度: {magnitude}

同期行业信息(可选):
{context}

直接输出归因,不要前缀解释。"""


def _fetch_pending(driver, limit: int, job_id: int | None):
    with driver.session() as s:
        if job_id:
            rows = s.run(
                "MATCH (j:Job {id: $jid})-[:HAS_CHANGE]->(c:ChangeEvent) "
                "WHERE c.reason IS NULL "
                "RETURN c.change_id AS change_id, c.type AS type, c.before AS before, "
                "c.after AS after, c.magnitude AS magnitude, c.date AS date, "
                "j.title AS title, j.id AS job_id LIMIT $limit",
                jid=job_id, limit=limit,
            )
        else:
            rows = s.run(
                "MATCH (j:Job)-[:HAS_CHANGE]->(c:ChangeEvent) "
                "WHERE c.reason IS NULL "
                "RETURN c.change_id AS change_id, c.type AS type, c.before AS before, "
                "c.after AS after, c.magnitude AS magnitude, c.date AS date, "
                "j.title AS title, j.id AS job_id LIMIT $limit",
                limit=limit,
            )
        return [dict(r) for r in rows]


def _fetch_context(driver, date) -> List[Dict[str, Any]]:
    """拉同期文章(±30 天)作为行业背景。"""
    with driver.session() as s:
        rows = s.run(
            """
            MATCH (a:Article)
            WHERE a.publish_time IS NOT NULL
              AND abs(duration.between(a.publish_time, $date).days) <= 30
            RETURN a.title AS title LIMIT 5
            """,
            date=date,
        )
        return [r["title"] for r in rows if r.get("title")]


def _set_reason(driver, change_id: str, reason: str, source: str):
    with driver.session() as s:
        s.run(
            """
            MATCH (c:ChangeEvent {change_id: $cid})
            SET c.reason = $reason, c.reason_source = $source, c.reason_at = datetime()
            """,
            cid=change_id, reason=reason, source=source,
        )


async def attribute_async(llm, change: Dict[str, Any], context: List[str]) -> str:
    before = change.get("before")
    after = change.get("after")
    if isinstance(before, str):
        try: before = json.loads(before)
        except: pass
    if isinstance(after, str):
        try: after = json.loads(after)
        except: pass

    prompt = PROMPT.format(
        title=change.get("title") or "未知岗位",
        change_type=change.get("type") or "",
        before=json.dumps(before, ensure_ascii=False)[:300],
        after=json.dumps(after, ensure_ascii=False)[:300],
        magnitude=change.get("magnitude") or 0,
        context="\n".join(f"- {t}" for t in context) or "(无同期文章)",
    )
    try:
        # LangChain ChatModel
        from langchain_core.messages import HumanMessage, SystemMessage
        resp = await llm.ainvoke([
            SystemMessage(content="你是互联网行业分析专家。"),
            HumanMessage(content=prompt),
        ])
        return (resp.content or "").strip()[:200]
    except Exception as e:
        return f"(归因失败:{str(e)[:80]})"


async def run(args):
    try:
        llm = get_llm_fast()
    except RuntimeError as e:
        print(f"❌ {e}")
        return

    driver = get_neo4j_driver()
    pending = _fetch_pending(driver, args.limit, args.job_id)
    print(f"⏱ 待归因 {len(pending)} 条 ChangeEvent")
    if not pending:
        return

    t0 = time.time()
    for i, ch in enumerate(pending):
        ctx = _fetch_context(driver, ch["date"])
        reason = await attribute_async(llm, ch, ctx)
        _set_reason(driver, ch["change_id"], reason, os.getenv("DEEPSEEK_MODEL", "deepseek-chat"))
        if (i + 1) % 5 == 0:
            elapsed = time.time() - t0
            print(f"   进度 {i+1}/{len(pending)}  耗时 {elapsed:.1f}s")
        await asyncio.sleep(0.3)

    print(f"✅ LLM 归因完成: {len(pending)} 条, 总耗时 {time.time() - t0:.1f}s")
    close_neo4j()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--job_id", type=int, default=None)
    args = ap.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()