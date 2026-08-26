"""
verify_kg.py — 端到端只读验收
=============================

跑之前:确保 Neo4j 已部署,build_kg.py 已跑过。

输出:每个数据/接口维度的 PASS/FAIL 总结。
"""

from __future__ import annotations

import json
import os
import sys
from typing import Any, Dict, List

import requests
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass



sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from database import get_neo4j_driver


def _section(title: str):
    print(f"\n=== {title} ===")


def _check(label: str, ok: bool, detail: str = ""):
    flag = "✅" if ok else "❌"
    print(f"  {flag} {label} {('— ' + detail) if detail else ''}")
    return ok


def check_neo4j(driver) -> bool:
    _section("Neo4j 数据层")
    all_ok = True
    with driver.session() as s:
        for label in ["Job", "JobSnapshot", "ChangeEvent", "Skill", "Industry", "Company"]:
            cnt = s.run(f"MATCH (n: {label}) RETURN count(n) AS c").single()["c"]
            all_ok &= _check(f"{label} 节点", cnt > 0, f"{cnt} 个")
        # ChangeEvent 有 reason 的比例
        ch_total = s.run("MATCH (c:ChangeEvent) RETURN count(c) AS c").single()["c"]
        ch_attr = s.run("MATCH (c:ChangeEvent) WHERE c.reason IS NOT NULL RETURN count(c) AS c").single()["c"]
        if ch_total > 0:
            ratio = round(ch_attr / ch_total, 2)
            all_ok &= _check("ChangeEvent 归因覆盖率", ratio >= 0.5, f"{ch_attr}/{ch_total} = {ratio}")
    return all_ok


def check_api(base: str) -> bool:
    _section("REST API")
    all_ok = True
    endpoints = [
        ("GET",  "/api/kg/jobs/overview",               None,  lambda d: d.get("data", {}).get("jobs", 0) > 0),
        ("GET",  "/api/kg/jobs/graph",                  None,  lambda d: len(d.get("data", {}).get("nodes", [])) > 0),
        ("GET",  "/api/kg/jobs?limit=5",                None,  lambda d: len(d.get("data", [])) > 0),
        ("GET",  "/api/kg/snapshot/timeline?bucket=month", None, lambda d: len(d.get("data", [])) > 0),
        ("GET",  "/api/kg/chat/tools",                  None,  lambda d: len(d.get("data", [])) > 0),
    ]
    for method, path, body, check_fn in endpoints:
        try:
            r = requests.request(method, base + path, json=body, timeout=10)
            j = r.json()
            ok = r.status_code == 200 and j.get("success", False) and check_fn(j)
            all_ok &= _check(f"{method} {path}", ok, f"status={r.status_code}")
        except Exception as e:
            all_ok &= _check(f"{method} {path}", False, str(e)[:80])

    # 找一个有变化的 Job,试 changes/evolution
    try:
        r = requests.get(base + "/api/kg/jobs?limit=200").json()
        for j in (r.get("data") or [])[:10]:
            jid = j.get("id")
            if not jid: continue
            rc = requests.get(f"{base}/api/kg/jobs/{jid}/changes").json()
            if rc.get("data"):
                all_ok &= _check(f"GET /api/kg/jobs/{jid}/changes", True,
                                 f"{len(rc['data'])} 个变化事件")
                break
    except Exception as e:
        all_ok &= _check("获取某 Job 的变化", False, str(e)[:80])
    return all_ok


def check_chat_sse(base: str) -> bool:
    _section("Chat SSE (Plan-Execute-Report)")
    try:
        r = requests.post(
            base + "/api/kg/chat",
            json={"message": "Java 后端薪资趋势?", "history": []},
            stream=True,
            timeout=60,
        )
        events = []
        for line in r.iter_lines(decode_unicode=True):
            if not line: continue
            if line.startswith("data: ") and line.strip() != "data: [DONE]":
                try:
                    events.append(json.loads(line[6:]))
                except Exception:
                    pass
            if line.strip() == "data: [DONE]":
                break
        seen = {e.get("event") for e in events}
        for needed in ["plan_started", "plan_ready", "tool_call", "tool_result",
                        "report_token", "report_done"]:
            ok = needed in seen
            print(f"  {'✅' if ok else '❌'} 事件 {needed} {'— 出现' if ok else '— 缺失'}")
        return len([e for e in seen if e in ["plan_started","plan_ready","report_done"]]) >= 3
    except Exception as e:
        print(f"  ❌ SSE 流失败: {str(e)[:120]}")
        return False


def main():
    base = os.getenv("API_BASE", "http://127.0.0.1:8081")
    print(f"验证目标: {base}\n")

    neo4j_ok = False
    try:
        driver = get_neo4j_driver()
        neo4j_ok = check_neo4j(driver)
    except Exception as e:
        print(f"❌ Neo4j 连接失败: {str(e)[:120]}")

    api_ok = check_api(base)
    chat_ok = check_chat_sse(base)

    print("\n" + "=" * 50)
    print(f"Neo4j: {'✅' if neo4j_ok else '❌'}")
    print(f"API:   {'✅' if api_ok else '❌'}")
    print(f"Chat:  {'✅' if chat_ok else '❌'}")
    if not (neo4j_ok and api_ok and chat_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()