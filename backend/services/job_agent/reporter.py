"""
job_agent/reporter.py — Reporter (Map-Reduce 简化版)
=====================================================

输入: 用户的 query + ExecutionRecord 列表(每条含 tool_name + result)
输出: 流式文字(token by token)

简化:不再做 OutlineBuilder → SectionWriter → ConsistencyChecker 三层,
而是直接 prompt LLM "根据以上执行结果写答案",用 streaming 输出。
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator, Dict, List

from langchain_core.messages import HumanMessage, SystemMessage

from database import get_llm_strong


REPORTER_PROMPT = """你是星图(XINGTU)的报告生成器。根据下面执行结果,生成精炼的中文答案(给求职者看)。

用户查询: {query}

执行结果(已通过知识图谱查询得到):
{evidence}

要求:
1. 引用具体岗位 ID/名称(job_id, title)
2. 涉及数据时给出具体数字
3. 时序变化要简短解释原因(如有)
4. 不要复述工具调用过程
5. 简洁精炼(200-400 字)
6. 末尾如果有"建议"/"推荐",单独一段

直接开始写答案,不要前缀。"""


async def stream_report(
    query: str,
    executions: List[Dict[str, Any]],
) -> AsyncIterator[str]:
    """流式生成报告。每次 yield 一个 token 块。"""
    llm = get_llm_strong()

    # 准备 evidence 文本(避免过大)
    evidence_lines = []
    for i, ex in enumerate(executions, 1):
        result_str = _short_result(ex.get("result"))
        evidence_lines.append(f"[{i}] {ex.get('tool', '')}: {result_str}")
    evidence = "\n".join(evidence_lines) or "(无执行结果)"

    prompt = REPORTER_PROMPT.format(query=query, evidence=evidence)

    try:
        async for chunk in llm.astream([
            SystemMessage(content="你是星图报告生成器。"),
            HumanMessage(content=prompt),
        ]):
            token = chunk.content or ""
            if token:
                yield token
    except Exception as e:
        yield f"\n\n(报告生成失败:{str(e)[:120]})"


def _short_result(r: Any, max_chars: int = 600) -> str:
    """把执行结果压成短文本(避免 prompt 过大)。"""
    if r is None:
        return "null"
    if isinstance(r, str):
        return r[:max_chars]
    try:
        s = json.dumps(r, ensure_ascii=False, default=str)
    except Exception:
        s = str(r)
    return s[:max_chars]


def collect_references(executions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """从执行结果中提取可引用的实体 ID。"""
    refs = []
    for ex in executions:
        r = ex.get("result")
        if isinstance(r, list):
            for item in r[:5]:
                if isinstance(item, dict) and item.get("id") is not None:
                    refs.append({
                        "job_id": item["id"],
                        "title": item.get("title") or "",
                    })
        elif isinstance(r, dict) and r.get("id") is not None:
            refs.append({"job_id": r["id"], "title": r.get("title") or ""})
    # 去重
    seen = set()
    uniq = []
    for ref in refs:
        if ref["job_id"] in seen: continue
        seen.add(ref["job_id"])
        uniq.append(ref)
    return uniq[:10]