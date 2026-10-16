"""实体抽取主流程。

输入:xingtu_raw.raw_github_repos / raw_github_discussions(analysis_status=pending)
输出:xingtu_analyzed.analyzed_entities(实体聚合)+ analyzed_mentions(文档→实体)

设计:
- 单文档一次 DeepSeek 调用,避免批量化幻觉
- 实体归一化:lower + 去空格 + 排序 aliases
- hot_score: stars*0.4 + watchers*0.3 + 讨论数*0.3(repos);评论数*0.5 + 反应*0.5(disc)
- 每批 50 文档,够吃满 DeepSeek 余额又不会卡死
"""

import os
import re
import time
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from pymongo import MongoClient, UpdateOne

from .deepseek_client import chat_completion, extract_json, DeepSeekError
from .prompts import (
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    ANALYSIS_STATUS_PENDING,
    ANALYSIS_STATUS_ANALYZED,
    ANALYSIS_STATUS_FAILED,
)


# ========== 配置 ==========

MONGO_HOST = os.environ.get("MONGO_HOST", "127.0.0.1")
MONGO_PORT = int(os.environ.get("MONGO_PORT", "27017"))
MONGO_USER = os.environ.get("MONGO_USER", "admin")
MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "")
MONGO_AUTH_DB = os.environ.get("MONGO_AUTH_DB", "admin")
ANALYZED_DB = "xingtu_analyzed"

BATCH_SIZE = int(os.environ.get("ANALYZER_BATCH_SIZE", "50"))
MAX_CONTENT_CHARS = 2000  # 单文档送 LLM 的最长字符数
MAX_ENTITIES_PER_DOC = 12


# ========== 工具 ==========

def log(*a):
    print("[INFO]", *a, flush=True)


def log_err(*a):
    print("[ERROR]", *a, flush=True)


def get_mongo() -> MongoClient:
    uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/?authSource={MONGO_AUTH_DB}"
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


def normalize_name(name: str) -> str:
    """实体名归一化:小写、trim、合并多余空格。"""
    return re.sub(r"\s+", " ", name.strip().lower())


def compute_hot_score(doc: Dict[str, Any]) -> float:
    """按来源计算 hot_score(简单加权,够排序)。"""
    source = doc.get("source")
    if source == "github":
        kind = doc.get("source_kind")  # 由 caller 注入
    else:
        kind = None

    if kind == "repo":
        # stars 主导
        stars = doc.get("stars", 0) or 0
        watchers = doc.get("watchers", 0) or 0
        forks = doc.get("forks", 0) or 0
        # log scale,让大 repo 不至于淹没小 repo
        import math
        return math.log10(stars + 1) * 10 + math.log10(watchers + 1) * 5 + math.log10(forks + 1) * 3
    if kind == "discussion":
        comments = doc.get("comments", 0) or 0
        reactions = doc.get("reactions_plus1", 0) or 0
        import math
        return math.log10(comments + 1) * 10 + math.log10(reactions + 1) * 5
    return 0.0


# ========== 文档 → 文本 ==========

def doc_to_prompt(repo_or_disc: Dict[str, Any]) -> Dict[str, str]:
    """把 mongo 文档拼成 prompt 输入。"""
    source = repo_or_disc.get("source", "github")
    if "/discussions/" in (repo_or_disc.get("url") or ""):
        doc_type = "github_discussion"
        title = repo_or_disc.get("title", "")
        extra = f"仓库: {repo_or_disc.get('source_repo', '')}\n分类: {repo_or_disc.get('category', '')}\n作者: {repo_or_disc.get('author', '')}\n评论数: {repo_or_disc.get('comments', 0)}\n"
        content = (repo_or_disc.get("body") or "")[:MAX_CONTENT_CHARS]
    else:
        doc_type = "github_repo"
        title = repo_or_disc.get("name", "") or repo_or_disc.get("source_id", "")
        lang = repo_or_disc.get("primary_language") or ""
        topics = ", ".join(repo_or_disc.get("topics", []) or [])
        stars = repo_or_disc.get("stars", 0)
        extra = f"仓库: {repo_or_disc.get('source_id', '')}\n主语言: {lang}\nTopics: {topics}\nStars: {stars}\n简介: {repo_or_disc.get('description') or ''}\n"
        content = (repo_or_disc.get("readme") or "")[:MAX_CONTENT_CHARS] or repo_or_disc.get("description") or ""

    return {
        "source": source,
        "doc_type": doc_type,
        "title": title,
        "extra_meta": extra,
        "content": content,
    }


# ========== 主流程 ==========

def extract_one(repo_or_disc: Dict[str, Any]) -> List[Dict[str, Any]]:
    """单文档抽取。返回实体列表。"""
    parts = doc_to_prompt(repo_or_disc)
    user_msg = USER_TEMPLATE.format(
        source=parts["source"],
        doc_type=parts["doc_type"],
        title=parts["title"],
        extra_meta=parts["extra_meta"],
        content=parts["content"],
        max_entities=MAX_ENTITIES_PER_DOC,
    )
    try:
        resp = chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            temperature=0.1,
            max_tokens=800,
        )
        entities = extract_json(resp["content"])
        if not isinstance(entities, list):
            return []
        # 简单校验
        cleaned = []
        for e in entities:
            if not isinstance(e, dict):
                continue
            name = (e.get("name") or "").strip()
            t = (e.get("type") or "").strip().lower()
            if not name or t not in {"skill", "tool", "role", "concept", "framework"}:
                continue
            aliases = e.get("aliases") or []
            aliases = [a for a in aliases if isinstance(a, str) and a.strip()]
            try:
                confidence = float(e.get("confidence", 0.5))
            except (TypeError, ValueError):
                confidence = 0.5
            cleaned.append({
                "name": name,
                "type": t,
                "aliases": aliases,
                "confidence": max(0.0, min(1.0, confidence)),
            })
        return cleaned
    except DeepSeekError as e:
        log_err(f"抽取失败 {repo_or_disc.get('source_id', '')}: {e}")
        return []


def upsert_entities(db, mentions: List[Dict[str, Any]]):
    """把 mentions 聚合成 entities 集合。

    每个 mention: {entity_name, entity_type, aliases, confidence, source_ref, source_kind, hot_score, run_id}
    """
    if not mentions:
        return 0

    coll = db["analyzed_entities"]
    now = datetime.now(timezone.utc)
    ops = []
    for m in mentions:
        norm = normalize_name(m["entity_name"])
        # entity_id 用 type + normalized_name,避免歧义
        eid = f"{m['entity_type']}:{norm}"
        ops.append(UpdateOne(
            {"entity_id": eid},
            {
                "$setOnInsert": {
                    "entity_id": eid,
                    "name": m["entity_name"],
                    "type": m["entity_type"],
                    "first_seen": now,
                    "first_run_id": m["run_id"],
                },
                "$set": {
                    "last_seen": now,
                    "last_run_id": m["run_id"],
                },
                "$inc": {"mention_count": 1},
                "$max": {"max_confidence": m["confidence"], "hot_score": m.get("hot_score", 0.0)},
                "$addToSet": {
                    "aliases": {"$each": m.get("aliases", []) + [m["entity_name"]]},
                    "source_refs": m["source_ref"],
                },
            },
            upsert=True,
        ))
    if ops:
        result = coll.bulk_write(ops, ordered=False)
        return result.upserted_count + result.modified_count
    return 0


def insert_mentions(db, mentions: List[Dict[str, Any]]):
    """写入 mentions 集合(每条文档一个实体一次引用)。"""
    if not mentions:
        return
    coll = db["analyzed_mentions"]
    try:
        coll.insert_many(mentions, ordered=False)
    except Exception as e:
        log_err(f"mentions 写入失败(可能重复): {e}")


def mark_doc_status(db, source_collection: str, doc_id: Dict, status: str):
    """标记原始文档的分析状态。"""
    db[source_collection].update_one(doc_id, {"$set": {"analysis_status": status}})


def start_run(db) -> str:
    """开启一次抽取 run,写 extraction_runs。"""
    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    db["extraction_runs"].insert_one({
        "run_id": run_id,
        "started_at": datetime.now(timezone.utc),
        "status": "running",
    })
    return run_id


def finish_run(db, run_id: str, total: int, succeeded: int, failed: int, cost_tokens: int):
    db["extraction_runs"].update_one(
        {"run_id": run_id},
        {"$set": {
            "finished_at": datetime.now(timezone.utc),
            "total_docs": total,
            "succeeded": succeeded,
            "failed": failed,
            "cost_tokens": cost_tokens,
            "status": "completed",
        }},
    )


def run_batch(limit: int = BATCH_SIZE) -> Dict[str, Any]:
    """跑一批抽取。

    1. 从 xingtu_raw 拉所有 analysis_status=pending 的文档
    2. 逐个调用 DeepSeek
    3. 写 entities / mentions
    4. 标记源文档 status=analyzed / failed
    """
    client = get_mongo()
    raw_db = client["xingtu_raw"]
    ana_db = client[ANALYZED_DB]

    run_id = start_run(ana_db)
    log(f"=== Entity Extractor {run_id}, 批大小 {limit} ===")

    pending = []
    for coll_name in ("raw_github_repos", "raw_github_discussions"):
        cursor = raw_db[coll_name].find({"analysis_status": ANALYSIS_STATUS_PENDING}).limit(limit)
        for d in cursor:
            d["_src_collection"] = coll_name
            # 标记 kind(给 hot_score 用)
            d["source_kind"] = "repo" if coll_name == "raw_github_repos" else "discussion"
            pending.append(d)
        if len(pending) >= limit:
            break
    pending = pending[:limit]

    log(f"待抽取文档: {len(pending)}")
    succeeded = 0
    failed = 0
    all_mentions = []
    cost_tokens = 0

    for idx, doc in enumerate(pending, 1):
        entities = extract_one(doc)
        if entities:
            hot_score = compute_hot_score(doc)
            source_ref = {
                "source": doc.get("source"),
                "source_id": doc.get("source_id"),
                "url": doc.get("url"),
            }
            for e in entities:
                all_mentions.append({
                    "entity_name": e["name"],
                    "entity_type": e["type"],
                    "aliases": e["aliases"],
                    "confidence": e["confidence"],
                    "source_ref": source_ref,
                    "hot_score": hot_score,
                    "source_kind": doc["source_kind"],
                    "run_id": run_id,
                })
                # mentions 集合也写一条,带文档引用
                ana_db["analyzed_mentions"].insert_one({
                    "entity_name": e["name"],
                    "entity_type": e["type"],
                    "confidence": e["confidence"],
                    "source": doc.get("source"),
                    "source_id": doc.get("source_id"),
                    "source_url": doc.get("url"),
                    "source_kind": doc["source_kind"],
                    "run_id": run_id,
                    "created_at": datetime.now(timezone.utc),
                })
            mark_doc_status(raw_db, doc["_src_collection"],
                            {"source": doc["source"], "source_id": doc["source_id"]},
                            ANALYSIS_STATUS_ANALYZED)
            succeeded += 1
        else:
            mark_doc_status(raw_db, doc["_src_collection"],
                            {"source": doc["source"], "source_id": doc["source_id"]},
                            ANALYSIS_STATUS_FAILED)
            failed += 1

        if idx % 10 == 0:
            log(f"  [{idx}/{len(pending)}] 已处理,ok={succeeded}, fail={failed}")

        # 防止 DeepSeek 限流
        time.sleep(0.3)

    # 聚合 entities
    entities_updated = 0
    if all_mentions:
        # 按 entity_type+name 分组,合并 aliases
        from collections import defaultdict
        grouped = defaultdict(list)
        for m in all_mentions:
            key = (m["entity_type"], m["entity_name"].lower())
            grouped[key].append(m)
        merged = []
        for (etype, ename), ms in grouped.items():
            aliases = set()
            for m in ms:
                aliases.update(m["aliases"])
            aliases.add(ename)
            aliases.discard(ms[0]["entity_name"])  # name 单独保留
            merged.append({
                "entity_name": ms[0]["entity_name"],
                "entity_type": etype,
                "aliases": sorted(aliases),
                "confidence": max(m["confidence"] for m in ms),
                "hot_score": sum(m["hot_score"] for m in ms),
                "source_ref": ms[0]["source_ref"],
                "run_id": run_id,
            })
        entities_updated = upsert_entities(ana_db, merged)

    finish_run(ana_db, run_id, len(pending), succeeded, failed, cost_tokens)
    client.close()

    summary = {
        "run_id": run_id,
        "total_docs": len(pending),
        "succeeded": succeeded,
        "failed": failed,
        "mentions_count": len(all_mentions),
        "entities_updated": entities_updated,
    }
    log(f"=== 完成: {summary} ===")
    return summary


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=BATCH_SIZE)
    args = parser.parse_args()
    return run_batch(limit=args.limit)


if __name__ == "__main__":
    main()