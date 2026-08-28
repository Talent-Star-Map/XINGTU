"""
Juejin Article Collector (Basic)

Collect:
- title
- url
- author
- publish_time
- read_count
- like_count
- favorite_count
- tags
- content
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


import json
import math
import re
import time
import random
from datetime import datetime, timedelta
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from models.juejin_article import JuejinArticle
from dao.juejin_article_dao import JuejinArticleDAO
from config.article_keywords import (
    AI_KEYWORDS,
    SOFTWARE_AI_KEYWORDS,
    FRONTEND_KEYWORDS,
    BACKEND_KEYWORDS,
    DATA_ENGINEERING_KEYWORDS,
    CLOUD_DEVOPS_KEYWORDS,
    TESTING_KEYWORDS,
    SECURITY_KEYWORDS,
    ARCHITECTURE_KEYWORDS
)
from rules.article_rules.domain_filter import is_it_domain
from rules.article_rules.technical_filter import is_technical_article
from rules.article_rules.analysis_value_filter import has_analysis_value
from config.config import PUBLISH_CUTOFF


TARGET_PER_KEYWORD = 5


USER_DATA_DIR = "./browser_data/juejin"

# 掘金风控/拦截特征词，实测后可按真实页面提示替换
BLOCK_KEYWORDS = [
    "访问异常",
    "操作过于频繁",
    "请稍后重试",
    "安全验证",
    "滑动验证",
    "登录后查看",
]

DETAIL_REQUEST_MIN_DELAY = 3
DETAIL_REQUEST_MAX_DELAY = 5
DETAIL_BATCH_LIMIT = 30
DETAIL_BATCH_REST_MIN = 20
DETAIL_BATCH_REST_MAX = 40
DETAIL_BLOCK_CHECK_INTERVAL = 10
DETAIL_TOP_LIMIT = 20

MAX_SEARCH_ROUNDS = 5

_detail_request_count = 0


def _parse_iso_dt(value):
    """解析 ISO 时间 2026-08-01T10:20:00.000Z 为 datetime，失败返回 None。"""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.000Z")
    except ValueError:
        return None


def convert_publish_time(value):
    dt = _parse_iso_dt(value)
    if not dt:
        return None
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def convert_unix_time(timestamp):
    """将 unix 秒级时间戳转换为 YYYY-MM-DD HH:MM:SS。"""
    if not timestamp:
        return None
    try:
        dt = datetime.fromtimestamp(int(timestamp))
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def calculate_days_ago(publish_time):
    """根据发布时间字符串计算天数差，解析失败或为空返回0。"""
    if not publish_time:
        return 0
    try:
        dt = datetime.strptime(publish_time, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return 0
    days = (datetime.now() - dt).days
    return max(days, 0)


def _hot_score_components(item, include_comment):
    """提取热度计算公共组件，早于截止日期返回 None，否则返回 (days_ago, 各项计数)。"""
    publish_time = item.get("publish_time") or ""
    if publish_time:
        try:
            pub_dt = datetime.strptime(publish_time, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            pub_dt = None
        if pub_dt and pub_dt < PUBLISH_CUTOFF:
            return None
    days_ago = calculate_days_ago(publish_time)
    read_count = int(item.get("read_count") or 0)
    like_count = int(item.get("like_count") or 0)
    favorite_count = int(item.get("favorite_count") or 0)
    comment_count = int(item.get("comment_count") or 0)
    if include_comment:
        return days_ago, read_count, like_count, favorite_count, comment_count
    return days_ago, read_count, like_count, favorite_count


def calculate_pre_hot_score(item):
    """搜索阶段粗排序热度。不包含评论数。"""
    components = _hot_score_components(item, include_comment=False)
    if not components:
        return 0
    days_ago, read_count, like_count, favorite_count = components
    return (
        read_count +
        like_count * 10 +
        favorite_count * 10
    ) / math.log(days_ago + math.e)


def calculate_hot_score(item):
    """详情阶段最终热度。评论数权重3。"""
    components = _hot_score_components(item, include_comment=True)
    if not components:
        return 0
    days_ago, read_count, like_count, favorite_count, comment_count = components
    return (
        read_count +
        like_count * 10 +
        favorite_count * 10 +
        comment_count * 3
    ) / math.log(days_ago + math.e)


def parse_relative_time(text):
    """将相对时间文本转换为 datetime 对象。"""
    if not text:
        return None
    now = datetime.now()
    text = str(text).strip()
    dt = _parse_iso_dt(text)
    if dt:
        return dt
    patterns = [
        (r"刚刚", 1, timedelta(0)),
        (r"(\d+)分钟前", 1, timedelta(minutes=1)),
        (r"(\d+)小时前", 1, timedelta(hours=1)),
        (r"(\d+)天前", 1, timedelta(days=1)),
        (r"(\d+)个月前", 1, timedelta(days=30)),
        (r"(\d+)年前", 1, timedelta(days=365)),
    ]
    for pattern, group_idx, unit in patterns:
        m = re.search(pattern, text)
        if m:
            try:
                val = int(m.group(group_idx))
            except (IndexError, ValueError):
                val = 1
            return now - val * unit
    return None


def clean_juejin_url(url):
    """清洗掘金文章URL，去除查询追踪参数。"""
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    except Exception:
        return url


def parse_search_results(body):
    """解析掘金搜索API返回，转换为文章候选列表。

    返回:
        [
            {
                "title", "source_url", "author", "publish_time",
                "read_count", "like_count", "favorite_count",
                "comment_count", "tags", "source_article_id"
            }
        ]
    """
    results = []
    if not body or not isinstance(body, dict):
        return results
    data = body.get("data", [])
    if not isinstance(data, list):
        return results

    for item in data:
        try:
            if item.get("result_type") != 2:
                continue
            model = item.get("result_model") or {}
            article_info = model.get("article_info") or {}
            author_info = model.get("author_user_info") or {}

            source_article_id = article_info.get("article_id") or ""
            title = (article_info.get("title") or "").strip()
            if not source_article_id or not title:
                continue

            link_url = article_info.get("link_url") or ""
            if link_url:
                source_url = clean_juejin_url(link_url)
            else:
                source_url = f"https://juejin.cn/post/{source_article_id}"

            tags = []
            for tag in (model.get("tags") or []):
                name = tag.get("tag_name")
                if name and name not in tags:
                    tags.append(name)

            results.append({
                "title": title,
                "source_url": source_url,
                "author": author_info.get("user_name") or "",
                "publish_time": convert_unix_time(article_info.get("ctime")),
                "read_count": int(article_info.get("view_count") or 0),
                "like_count": int(article_info.get("digg_count") or 0),
                "favorite_count": int(article_info.get("collect_count") or 0),
                "comment_count": int(article_info.get("comment_count") or 0),
                "tags": tags,
                "source_article_id": source_article_id,
            })
        except Exception as e:
            print(f"解析搜索结果失败: {e}")
            continue
    return results


def fetch_search_results(page, keyword, max_pages=3):
    """进入搜索页并监听页面自身发出的搜索API响应，收集候选文章。

    返回:
        candidates 候选文章列表
    """
    candidates = []
    seen_ids = set()

    search_url = f"https://juejin.cn/search?query={keyword}"

    captured = {}

    def on_search_response(response):
        if "search_api/v1/search" in response.url:
                try:
                    captured["body"] = response.json()
                except Exception:
                    pass

    page.on("response", on_search_response)

    try:
        try:
            page.goto(search_url, timeout=60000, wait_until="domcontentloaded")
            page.wait_for_timeout(5000)
        except Exception as e:
            print(f"搜索页导航失败: {e}")
            return candidates

        body = captured.get("body")
        if body:
            for c in parse_search_results(body):
                if c["source_article_id"] not in seen_ids:
                    seen_ids.add(c["source_article_id"])
                    candidates.append(c)
        else:
            print("未捕获到搜索API响应")

        print(f"搜索API解析到 {len(candidates)} 条候选")

        if len(candidates) < TARGET_PER_KEYWORD:
            try:
                for _ in range(1, max_pages):
                    captured.pop("body", None)
                    page.mouse.wheel(0, 8000)
                    page.wait_for_timeout(3000)
                    body = captured.get("body")
                    if body is None:
                        break
                    added = 0
                    for c in parse_search_results(body):
                        if c["source_article_id"] not in seen_ids:
                            seen_ids.add(c["source_article_id"])
                            candidates.append(c)
                            added += 1
                    if added == 0:
                        break
                    if len(candidates) >= TARGET_PER_KEYWORD:
                        break
            except Exception as e:
                print(f"搜索翻页失败: {e}")
    finally:
        page.remove_listener("response", on_search_response)

    cutoff = PUBLISH_CUTOFF
    filtered = []
    for c in candidates:
        publish_time = c.get("publish_time") or ""
        if publish_time:
            try:
                pub_dt = datetime.strptime(publish_time, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                pub_dt = None
            if pub_dt and pub_dt < cutoff:
                continue
        c["pre_hot_score"] = calculate_pre_hot_score(c)
        filtered.append(c)

    candidates = filtered
    candidates.sort(key=lambda x: x["pre_hot_score"], reverse=True)

    return candidates


def _pre_request_delay():
    time.sleep(random.uniform(DETAIL_REQUEST_MIN_DELAY, DETAIL_REQUEST_MAX_DELAY))


def _check_batch_rest():
    global _detail_request_count
    if _detail_request_count > 0 and _detail_request_count % DETAIL_BATCH_LIMIT == 0:
        rest_time = random.randint(DETAIL_BATCH_REST_MIN, DETAIL_BATCH_REST_MAX)
        print(f"[BATCH] 连续采集{DETAIL_BATCH_LIMIT}篇, 暂停{rest_time}s")
        time.sleep(rest_time)


def _detect_block(text):
    if not text:
        return False
    for kw in BLOCK_KEYWORDS:
        if kw in text:
            return True
    return False


def fetch_article_detail(context, source_url):
    global _detail_request_count
    _detail_request_count += 1
    _pre_request_delay()
    _check_batch_rest()

    detail_page = context.new_page()

    _comment_api_data = {}

    def _on_comment_response(response):
        url = response.url.lower()
        if any(
            keyword in url
            for keyword in [
                "comment",
                "comments",
                "reply",
                "interact"
            ]
        ):
            try:
                body = response.json()
                _comment_api_data["body"] = body
                print("评论接口捕获成功")

            except Exception:
                pass

    detail_page.on(
        "response",
        _on_comment_response
    )

    try:
        try:
            detail_page.goto(
                source_url,
                timeout=60000,
                wait_until="domcontentloaded"
            )
        except Exception as e:
            print(f"详情页访问失败:{e}")
            return {"status": "failed"}
        detail_page.wait_for_timeout(3000)

        detail_page.mouse.wheel(0, 5000)
        detail_page.wait_for_timeout(3000)

        if _detail_request_count % DETAIL_BLOCK_CHECK_INTERVAL == 0:
            html = detail_page.content()
            if _detect_block(html):
                print("疑似触发掘金风控，拦截页面片段:", html[:500])
                try:
                    detail_page.goto("about:blank", timeout=10000)
                    time.sleep(random.uniform(30, 60))
                    detail_page.goto(
                        source_url,
                        timeout=60000,
                        wait_until="domcontentloaded"
                    )
                    detail_page.wait_for_timeout(3000)
                except Exception as e:
                    print(f"拦截重试失败:{e}")
                    return {"status": "failed"}
                html = detail_page.content()
                if _detect_block(html):
                    print("重试仍然被拦截")
                    return {"status": "failed"}

        match = re.search(r"/post/(\d+)", source_url)
        source_article_id = match.group(1) if match else ""

        try:
            detail_title = detail_page.locator("h1.article-title").inner_text(timeout=5000)
        except Exception:
            detail_title = ""

        try:
            author = detail_page.locator(".author-name .name").inner_text(timeout=5000)
        except Exception:
            author = ""

        try:
            publish_time = detail_page.locator(".meta-box time").get_attribute("datetime", timeout=5000)
            if not publish_time:
                publish_time = detail_page.locator(".meta-box time").inner_text(timeout=5000)
        except Exception:
            try:
                publish_time = detail_page.locator("time.time").inner_text(timeout=5000)
            except Exception:
                publish_time = ""

        try:
            content = detail_page.locator("#article-root .markdown-body").inner_text(timeout=10000)
        except Exception:
            try:
                content = detail_page.locator("article").inner_text(timeout=10000)
            except Exception:
                content = ""

        content = "\n".join(
            line.strip()
            for line in content.splitlines()
            if line.strip()
        )

        if content:
            print(f"正文采集成功: {len(content)} 字符")

        comment_count = 0

        if _comment_api_data.get("body"):

            body = _comment_api_data["body"]


            def find_comment_count(obj):

                if isinstance(obj, dict):

                    for key in [
                        "comment_count",
                        "commentCount",
                        "commentsCount",
                        "comments_count",
                        "totalComments",
                        "total",
                        "count"
                    ]:

                        value = obj.get(key)

                        if isinstance(value, int):
                            return value


                        if isinstance(value, str) and value.isdigit():
                            return int(value)


                    for value in obj.values():

                        result = find_comment_count(value)

                        if result is not None:
                            return result


                elif isinstance(obj, list):

                    for item in obj:

                        result = find_comment_count(item)

                        if result is not None:
                            return result


                return None



            api_comment_count = find_comment_count(body)


            if api_comment_count is not None:

                comment_count = api_comment_count

        if comment_count == 0:
            try:
                html = detail_page.content()
                for pattern in [
                    r'"commentCount"\s*:\s*(\d+)',
                    r'"comment_count"\s*:\s*(\d+)',
                    r'"commentsCount"\s*:\s*(\d+)',
                    r'"comments_count"\s*:\s*(\d+)',
                    r'"totalComments"\s*:\s*(\d+)',
                ]:
                    m = re.search(pattern, html)
                    if m:
                        comment_count = int(m.group(1))
                        break
            except Exception:
                pass

        if comment_count == 0:
            try:
                comment_el = detail_page.locator(
                    ".comment-count, "
                    ".comment-list-header .count, "
                    ".comment-title .count, "
                    ".comment-num, "
                    "[class*=comment]"
                ).first
                comment_text = comment_el.inner_text(timeout=3000)
                match = re.search(r"\d+", comment_text or "")
                comment_count = int(match.group()) if match else 0
            except Exception:
                comment_count = 0

        return {
            "status": "success",
            "source_article_id": source_article_id,
            "detail_title": detail_title,
            "author": author,
            "publish_time": publish_time,
            "content": content,
            "comment_count": comment_count,
        }
    except Exception as e:
        print("详情页获取失败:", e)
        return {"status": "failed"}
    finally:
        try:
            detail_page.remove_listener("response", _on_comment_response)
        except Exception:
            pass
        detail_page.close()


def collect_keyword(keyword, page, context, target=TARGET_PER_KEYWORD, processed_ids=None):
    """采集单个关键词的文章。"""
    dao = JuejinArticleDAO()
    keyword_count = 0
    cutoff = PUBLISH_CUTOFF
    search_round = 0
    if processed_ids is None:
        processed_ids = set()

    search_url = f"https://juejin.cn/search?query={keyword}"

    print("==============================")
    print(f"当前关键词: {keyword}")
    print(f"目标采集: {target}篇")
    print("==============================")
    print()
    print(f"当前网址: {search_url}")
    print()

    while keyword_count < target and search_round < MAX_SEARCH_ROUNDS:
        search_round += 1
        candidates = fetch_search_results(page, keyword)

        if not candidates:
            print("未获取到搜索结果，当前页面URL:", page.url)
            break

        for i, item in enumerate(candidates[:DETAIL_TOP_LIMIT]):

            if keyword_count >= target:
                print(f"{keyword} 已达到目标数量 {target}，停止采集")
                break

            if item["source_article_id"] in processed_ids:
                continue
            processed_ids.add(item["source_article_id"])

            print()
            print("------------------------------")
            print(f"第{i+1}篇文章")
            print("------------------------------")

            title = item["title"]
            source_url = item["source_url"]
            source_article_id = item["source_article_id"]

            if dao.exists(source_article_id):
                print(f"重复文章跳过: {source_article_id}")
                time.sleep(random.uniform(0.5, 1.5))
                continue

            pre_dict = {"title": title, "tags": [], "content": title}
            if not is_it_domain(pre_dict):
                print("L1预检过滤: 非IT领域, 跳过")
                continue

            print(f"掘金详情访问: {source_article_id}")

            detail = fetch_article_detail(context, source_url)
            if detail["status"] == "failed":
                print(f"掘金详情获取失败，不入库:{source_url}")
                continue

            detail_title = detail["detail_title"] or item["title"]
            author = detail["author"] or item["author"]
            publish_time = detail["publish_time"]
            content = detail["content"]

            read_count = item["read_count"]
            like_count = item["like_count"]
            favorite_count = item["favorite_count"]
            comment_count = detail.get("comment_count", 0)
            tags = item["tags"]

            read_count = int(read_count or 0)
            like_count = int(like_count or 0)
            favorite_count = int(favorite_count or 0)
            comment_count = int(comment_count or 0)

            item["comment_count"] = comment_count
            item["hot_score"] = calculate_hot_score(item)

            raw_publish_time = item["publish_time"] or detail["publish_time"]
            publish_time = None
            if raw_publish_time:
                try:
                    datetime.strptime(raw_publish_time, "%Y-%m-%d %H:%M:%S")
                    publish_time = raw_publish_time
                except ValueError:
                    publish_time = convert_publish_time(raw_publish_time)
                    if not publish_time:
                        rel_dt = parse_relative_time(raw_publish_time)
                        if rel_dt:
                            publish_time = rel_dt.strftime("%Y-%m-%d %H:%M:%S")
            if not publish_time:
                print("发布时间解析失败:", detail_title)
            else:
                try:
                    pub_dt = datetime.strptime(publish_time, "%Y-%m-%d %H:%M:%S")
                    if pub_dt < cutoff:
                        print(f"时效过滤: 早于{cutoff.date()}, 跳过: {detail_title}")
                        continue
                except ValueError:
                    print("发布时间解析失败:", detail_title)

            filter_dict = {
                "title": detail_title,
                "tags": tags,
                "content": content,
            }
            if not content:
                continue
            if len(content) < 100:
                print("内容过短, 跳过")
                continue
            if not is_it_domain(filter_dict):
                print("L1过滤: 非IT领域, 跳过")
                continue
            if not is_technical_article(filter_dict):
                print("L2过滤: 非技术文章, 跳过")
                continue
            if not has_analysis_value(filter_dict):
                print("L3过滤: 无分析价值, 跳过")
                continue


            article = JuejinArticle(
                source="稀土掘金",
                source_article_id=source_article_id,
                title=detail_title,
                author=author,
                tags=tags,
                publish_time=publish_time,
                read_count=read_count,
                like_count=like_count,
                favorite_count=favorite_count,
                comment_count=comment_count,
                source_url=source_url,
                content=content,
                crawl_time=datetime.now()
            )

            print(article)

            result = dao.insert(article)

            if result:
                keyword_count += 1
                print(f"数据库新增成功 {keyword_count}/{target}: {article.source_article_id}")
            else:
                print(f"入库失败: {article.source_article_id}")
            time.sleep(random.uniform(0.5, 1.5))

    print(f"{keyword} 新增 {keyword_count} 篇")
    print()
    return keyword_count


def collect_juejin():

    with sync_playwright() as p:

        context = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            viewport={
                "width": 1280,
                "height": 900
            },
args=[
                    "--disable-blink-features=AutomationControlled",
                    "--window-position=-2000,-2000"
                ]
        )

        context.route(
            "**/*",
            lambda route:
            route.abort()
            if route.request.resource_type in [
                "image",
                "media"
            ]
            else route.continue_()
        )

        if context.pages:
            page = context.pages[0]
        else:
            page = context.new_page()

        total_count = 0
        processed_ids = set()

        phases = [
            ("AI与大模型", AI_KEYWORDS),
            ("软件工程智能化", SOFTWARE_AI_KEYWORDS),
            ("前端技术", FRONTEND_KEYWORDS),
            ("后端开发", BACKEND_KEYWORDS),
            ("数据工程", DATA_ENGINEERING_KEYWORDS),
            ("云原生与DevOps", CLOUD_DEVOPS_KEYWORDS),
            ("测试与质量工程", TESTING_KEYWORDS),
            ("安全技术", SECURITY_KEYWORDS),
            ("技术生态与架构演进", ARCHITECTURE_KEYWORDS),
        ]

        for phase_name, group in phases:
            print()
            print(f"=== {phase_name}（随机{min(2, len(group))}个关键词）===")
            for keyword in random.sample(group, min(2, len(group))):
                total_count += collect_keyword(
                    keyword,
                    page,
                    context,
                    target=TARGET_PER_KEYWORD,
                    processed_ids=processed_ids
                )

        print()
        print("==============================")
        print("掘金采集完成")
        print(f"总成功采集数量: {total_count}")
        print("==============================")

        page.wait_for_timeout(1000)
        context.close()


def login_juejin():
    """打开浏览器让用户登录掘金，保存登录状态后退出。"""
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://juejin.cn", timeout=60000, wait_until="domcontentloaded")
        print("请在浏览器中登录掘金账号")
        print("请点击右上角「登录 / 注册」，选择扫码登录（用掘金 App 扫码）")
        print("注意: 不要使用短信验证码登录，会触发滑块人机验证导致页面卡死")
        print("登录后的登录态会自动保存到 browser_data/juejin/ 目录")
        input("登录完成后按 Enter 保存登录状态并关闭浏览器...")
        context.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        try:
            login_juejin()
        except KeyboardInterrupt:
            print()
            print("已收到 Ctrl+C，正在退出...")
            sys.exit(0)
    else:
        try:
            collect_juejin()
        except KeyboardInterrupt:
            print()
            print("已收到 Ctrl+C，正在退出...")
            print("掘金采集已中断")
            sys.exit(0)
        except Exception as e:
            print(f"采集过程异常终止: {e}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
