"""GitHub 采集器 — 拉 trending repos + topics + README + discussions。

设计:
- 纯 requests,不依赖 Playwright
- 走 GitHub REST API,无 token 60 次/h,有 token 5000 次/h
- 增量:pushed_at > last_crawl
- 数据进 MongoDB(xingtu_raw.raw_github_*)
"""
import os
import sys
import time
import base64
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import requests
from pymongo import MongoClient, UpdateOne

# ============== 配置 ==============

GITHUB_API = "https://api.github.com"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")  # 可选
MONGO_HOST = os.environ.get("MONGO_HOST", "127.0.0.1")
MONGO_PORT = int(os.environ.get("MONGO_PORT", "27017"))
MONGO_USER = os.environ.get("MONGO_USER", "admin")
MONGO_PASSWORD = os.environ.get("MONGO_PASSWORD", "")
MONGO_AUTH_DB = os.environ.get("MONGO_AUTH_DB", "admin")
MONGO_DB = "xingtu_raw"

# trending 关键词(技术演化监测点)
# 注意:GitHub search qualifier 之间必须用 **空格** 分隔(用 + 会 422)
TRENDING_QUERIES = [
    "stars:>1000 pushed:>{since}",
    "stars:>500 language:python pushed:>{since}",
    "stars:>500 language:javascript pushed:>{since}",
    "stars:>500 language:typescript pushed:>{since}",
    "stars:>500 language:rust pushed:>{since}",
    "stars:>500 language:go pushed:>{since}",
    "stars:>300 topic:llm pushed:>{since}",
    "stars:>300 topic:rag pushed:>{since}",
    "stars:>300 topic:agent pushed:>{since}",
    "stars:>300 topic:vector-database pushed:>{since}",
    "stars:>300 topic:prompt-engineering pushed:>{since}",
    "stars:>200 topic:openai pushed:>{since}",
    "stars:>200 topic:gpt pushed:>{since}",
    "stars:>200 topic:huggingface pushed:>{since}",
    "stars:>300 language:cpp pushed:>{since}",
    "stars:>300 language:java pushed:>{since}",
    "stars:>300 topic:kubernetes pushed:>{since}",
    "stars:>200 topic:devops pushed:>{since}",
    "stars:>300 topic:mcp-server pushed:>{since}",
]

# 头部活跃 repo(discussions 拉这些)
DISCUSSION_REPOS = [
    "langchain-ai/langchain",
    "langchain-ai/langgraph",
    "run-llama/llama_index",
    "microsoft/autogen",
    "crewAIInc/crewAI",
    "ollama/ollama",
    "huggingface/transformers",
    "vllm-project/vllm",
    "facebook/react",
    "vercel/next.js",
    "vuejs/core",
    "denoland/deno",
    "microsoft/TypeScript",
    "rust-lang/rust",
    "tokio-rs/tokio",
    "kubernetes/kubernetes",
    "istio/istio",
]

# 无 token 时的降级 query(避免 rate limit,2 个 query × 1 页 ≈ 2 calls)
LIGHT_QUERIES = [
    "stars:>1000 pushed:>{since}",
    "stars:>300 topic:llm pushed:>{since}",
]

PAGE_SIZE = 30
MAX_PAGES = 3
DISCUSSION_PER_REPO = 15
README_MAX_BYTES = 10 * 1024

# 环境变量覆盖
LIGHT_MODE = os.environ.get("GITHUB_LIGHT_MODE", "").lower() in ("1", "true", "yes")
FETCH_READMES = os.environ.get("GITHUB_FETCH_READMES", "").lower() in ("1", "true", "yes")
FETCH_DISCUSSIONS = os.environ.get("GITHUB_FETCH_DISCUSSIONS", "").lower() in ("1", "true", "yes")


# ============== 工具 ==============

def log_info(*a):
    print("[INFO]", *a, flush=True)


def log_warn(*a):
    print("[WARNING]", *a, flush=True)


def log_error(*a):
    print("[ERROR]", *a, flush=True)


def log_success(*a):
    print("[SUCCESS]", *a, flush=True)


def get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "xingtu-collector/1.0",
    })
    if GITHUB_TOKEN:
        s.headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    return s


def safe_request(session: requests.Session, url: str, params: Dict = None, timeout: int = 30) -> Optional[requests.Response]:
    """带重试 + 限流的请求。"""
    for attempt in range(3):
        try:
            r = session.get(url, params=params, timeout=timeout)
            if r.status_code == 403 and "rate limit" in r.text.lower():
                reset = int(r.headers.get("X-RateLimit-Reset", time.time() + 60))
                wait = max(reset - time.time(), 5)
                log_warn(f"rate limited, 等 {wait:.0f}s")
                time.sleep(wait + 2)
                continue
            if r.status_code == 404:
                return None
            if r.status_code == 410:
                # Discussions 没启用,跳过
                return None
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            log_warn(f"请求失败 attempt={attempt}: {e}")
            time.sleep(2 ** attempt)
    return None


def get_mongo() -> MongoClient:
    uri = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/?authSource={MONGO_AUTH_DB}"
    return MongoClient(uri, serverSelectionTimeoutMS=5000)


# ============== 采集 ==============

def fetch_trending_repos(session: requests.Session, since_date: str, run_id: str) -> List[Dict[str, Any]]:
    """拉 trending repos,每条带 README(可选)。"""
    queries = LIGHT_QUERIES if LIGHT_MODE else TRENDING_QUERIES
    pages_limit = 1 if LIGHT_MODE else MAX_PAGES
    repos = []
    for q_idx, q_template in enumerate(queries):
        q = q_template.format(since=since_date)
        log_info(f"query[{q_idx+1}/{len(queries)}]: {q}")
        for page in range(1, pages_limit + 1):
            r = safe_request(session, f"{GITHUB_API}/search/repositories",
                             params={"q": q, "sort": "stars", "order": "desc", "per_page": PAGE_SIZE, "page": page})
            if not r:
                break
            data = r.json()
            items = data.get("items", [])
            if not items:
                break
            log_info(f"  page {page}: {len(items)} repos")
            for it in items:
                repo = parse_repo(it, run_id)
                if FETCH_READMES:
                    readme = fetch_readme(session, it["full_name"])
                    if readme:
                        repo["readme"] = readme
                repos.append(repo)
                time.sleep(0.2)
            if len(items) < PAGE_SIZE:
                break
            time.sleep(1)
    return repos


def parse_repo(it: Dict[str, Any], run_id: str) -> Dict[str, Any]:
    return {
        "source": "github",
        "source_id": it["full_name"],
        "url": it["html_url"],
        "name": it["name"],
        "owner": it["owner"]["login"],
        "description": it.get("description"),
        "primary_language": it.get("language"),
        "languages_url": it.get("languages_url"),
        "stars": it.get("stargazers_count", 0),
        "forks": it.get("forks_count", 0),
        "watchers": it.get("watchers_count", 0),
        "open_issues": it.get("open_issues_count", 0),
        "topics": it.get("topics", []),
        "license": (it.get("license") or {}).get("spdx_id"),
        "pushed_at": parse_dt(it.get("pushed_at")),
        "created_at": parse_dt(it.get("created_at")),
        "updated_at": parse_dt(it.get("updated_at")),
        "homepage": it.get("homepage"),
        "crawled_at": datetime.now(timezone.utc),
        "analysis_status": "pending",
        "analysis_run_id": run_id,
    }


def fetch_readme(session: requests.Session, full_name: str) -> Optional[str]:
    r = safe_request(session, f"{GITHUB_API}/repos/{full_name}/readme")
    if not r:
        return None
    try:
        content_b64 = r.json().get("content", "")
        decoded = base64.b64decode(content_b64).decode("utf-8", errors="ignore")
        return decoded[:README_MAX_BYTES]
    except Exception as e:
        log_warn(f"readme 解析失败 {full_name}: {e}")
        return None


def fetch_discussions(session: requests.Session, run_id: str) -> List[Dict[str, Any]]:
    """拉头部活跃 repo 的 discussions。"""
    discussions = []
    repos_to_fetch = DISCUSSION_REPOS[:3] if LIGHT_MODE else DISCUSSION_REPOS  # 轻量模式只拉 3 个
    for repo in repos_to_fetch:
        log_info(f"discussions: {repo}")
        r = safe_request(session, f"{GITHUB_API}/repos/{repo}/discussions",
                         params={"per_page": DISCUSSION_PER_REPO, "sort": "updated", "direction": "desc"})
        if not r:
            continue
        items = r.json() if isinstance(r.json(), list) else []
        for d in items:
            user = d.get("user") or {}
            discussions.append({
                "source": "github",
                "source_id": f"{repo}#{d['number']}",
                "source_repo": repo,
                "url": d.get("html_url"),
                "title": d.get("title"),
                "body": (d.get("body") or "")[:8192],
                "author": user.get("login"),
                "category": (d.get("category") or {}).get("name"),
                "comments": d.get("comments", 0),
                "reactions_plus1": (d.get("reactions") or {}).get("+1", 0),
                "created_at": parse_dt(d.get("created_at")),
                "updated_at": parse_dt(d.get("updated_at")),
                "crawled_at": datetime.now(timezone.utc),
                "analysis_status": "pending",
                "analysis_run_id": run_id,
            })
        log_info(f"  → {len(items)} discussions")
        time.sleep(0.5)
    return discussions


# ============== 写入 ==============

def upsert_repos(db, repos: List[Dict[str, Any]]) -> tuple:
    if not repos:
        return 0, 0
    coll = db["raw_github_repos"]
    seen = set()
    unique = []
    for r in repos:
        if r["source_id"] in seen:
            continue
        seen.add(r["source_id"])
        unique.append(r)
    ops = [UpdateOne(
        {"source": r["source"], "source_id": r["source_id"]},
        {"$set": r, "$setOnInsert": {"first_seen": datetime.now(timezone.utc)}},
        upsert=True,
    ) for r in unique]
    result = coll.bulk_write(ops, ordered=False)
    return result.upserted_count, result.modified_count


def upsert_discussions(db, discussions: List[Dict[str, Any]]) -> tuple:
    if not discussions:
        return 0, 0
    coll = db["raw_github_discussions"]
    ops = [UpdateOne(
        {"source": d["source"], "source_id": d["source_id"]},
        {"$set": d, "$setOnInsert": {"first_seen": datetime.now(timezone.utc)}},
        upsert=True,
    ) for d in discussions]
    result = coll.bulk_write(ops, ordered=False)
    return result.upserted_count, result.modified_count


# ============== utils ==============

def parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def since_date(days: int = 30) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return d.strftime("%Y-%m-%d")


# ============== main ==============

def main():
    run_id = f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    since = since_date(30)
    log_info(f"=== GitHub collector 启动 {run_id},since={since} ===")

    log_info(f"MongoDB: {MONGO_HOST}:{MONGO_PORT}/{MONGO_DB}")
    log_info(f"GitHub Token: {'有' if GITHUB_TOKEN else '无(限流 60/h)'}")
    log_info(f"模式: {'LIGHT(2 queries × 1 page)' if LIGHT_MODE else 'FULL(18 queries × 3 pages)'}, "
             f"readme={'开' if FETCH_READMES else '关'}, discussions={'开' if FETCH_DISCUSSIONS else '关'}")

    session = get_session()
    client = get_mongo()
    db = client[MONGO_DB]

    # 限流检查
    r = safe_request(session, f"{GITHUB_API}/rate_limit")
    if r:
        rl = r.json().get("rate", {})
        log_info(f"限流: remaining={rl.get('remaining')}/{rl.get('limit')}, reset={rl.get('reset')}")

    # 阶段 1:trending repos
    log_info("\n[阶段 1] 抓 trending repos")
    repos = fetch_trending_repos(session, since, run_id)
    log_success(f"  共抓 {len(repos)} 条 repo(去重前)")
    if repos:
        ins, upd = upsert_repos(db, repos)
        log_success(f"  Mongo upsert: 新增 {ins}, 更新 {upd}")

    # 阶段 2:discussions(可选)
    if FETCH_DISCUSSIONS:
        log_info("\n[阶段 2] 抓头部 repo discussions")
        discussions = fetch_discussions(session, run_id)
        log_success(f"  共抓 {len(discussions)} 条 discussion")
        if discussions:
            ins, upd = upsert_discussions(db, discussions)
            log_success(f"  Mongo upsert: 新增 {ins}, 更新 {upd}")
    else:
        log_info("\n[阶段 2] 跳过 discussions(关闭)")

    # 总览
    total_repos = db["raw_github_repos"].count_documents({})
    total_disc = db["raw_github_discussions"].count_documents({})
    log_success(f"\n=== 库内总量 ===")
    log_success(f"  raw_github_repos: {total_repos}")
    log_success(f"  raw_github_discussions: {total_disc}")

    client.close()
    log_info("=== GitHub collector 完成 ===")


if __name__ == "__main__":
    main()
