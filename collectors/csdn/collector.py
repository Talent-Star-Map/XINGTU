"""
CSDN Article Collector

Collect:
- title
- url
- author
- publish_time
- read_count
- like_count
- favorite_count
- tags

No database
"""

import sys
import json


import random
import time
import requests
from urllib.parse import quote, urlparse
from playwright.sync_api import sync_playwright
import re
from datetime import datetime, timedelta
from math import log, e
from bs4 import BeautifulSoup
from models.csdn_article import CsdnArticle
from dao.csdn_article_dao import CsdnArticleDAO
from rules.article_rules.domain_filter import is_it_domain
from rules.article_rules.technical_filter import is_technical_article
from rules.article_rules.analysis_value_filter import has_analysis_value
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
from config.config import PUBLISH_CUTOFF


PRECISE_TARGET = 5

ARTICLE_REQUEST_MIN_DELAY = 3
ARTICLE_REQUEST_MAX_DELAY = 5
ARTICLE_BATCH_LIMIT = 30
ARTICLE_BATCH_REST_MIN = 20
ARTICLE_BATCH_REST_MAX = 40
ARTICLE_BLOCK_CHECK_INTERVAL = 10


USER_DATA_DIR = "./browser_data/csdn"
WAF_KEYWORDS = ["403 Forbidden", "WAF", "安全验证", "访问异常"]
BLOCK_KEYWORDS = ["滑动验证", "验证身份", "请登录"]



def extract_article_id(url):
    if not url:
        return ""
    match = re.search(
        r"/article/details/(\d+)",
        url
    )
    if match:
        return match.group(1)
    return ""

def clean_csdn_url(url):
    """
    清洗CSDN文章URL
    去除搜索追踪参数
    """
    if not url:
        return ""
    try:
        parsed = urlparse(url)
        clean_url = (
            f"{parsed.scheme}://"
            f"{parsed.netloc}"
            f"{parsed.path}"
        )
        return clean_url
    except Exception:
        return url

def convert_publish_time(text):
    if not text:
        return None
    text = text.strip()
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
        "%Y年%m月%d日"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue

    return None

def parse_relative_time(text):
    """将搜索结果页的相对时间转换为 datetime 对象。"""
    if not text:
        return None
    now = datetime.now()
    text = text.strip()
    dt = convert_publish_time(text)
    if dt:
        return datetime.strptime(dt, "%Y-%m-%d %H:%M:%S")
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

def convert_number(text):
    if not text:
        return 0
    text = text.strip().lower().rstrip("+")
    if "万" in text:
        return int(float(text.replace("万", "")) * 10000)
    if "w" in text:
        return int(float(text.replace("w", "")) * 10000)
    if "k" in text:
        return int(float(text.replace("k", "")) * 1000)
    try:
        return int(text)
    except ValueError:
        return 0

def clean_html_text(text):
    if not text:
        return ""

    text = re.sub(
        r"<[^>]+>",
        "",
        text
    )

    return text.strip()

_article_request_count = 0
_browser_ua = None

def _pre_request_delay():
    time.sleep(random.uniform(ARTICLE_REQUEST_MIN_DELAY, ARTICLE_REQUEST_MAX_DELAY))

def _check_batch_rest():
    global _article_request_count
    if _article_request_count > 0 and _article_request_count % ARTICLE_BATCH_LIMIT == 0:
        rest_time = random.randint(ARTICLE_BATCH_REST_MIN, ARTICLE_BATCH_REST_MAX)
        print(f"[BATCH] 连续采集{ARTICLE_BATCH_LIMIT}篇, 暂停{rest_time}s")
        time.sleep(rest_time)

def _detect_block(html):
    for kw in WAF_KEYWORDS + BLOCK_KEYWORDS:
        if kw in html:
            return True
    return False

def handle_route(route):
    try:
        if route.request.resource_type in [
            "image",
            "media"
        ]:
            route.abort()
        else:
            route.continue_()
    except Exception:
        pass

def fetch_article_detail(url, page):
    global _article_request_count
    _article_request_count += 1
    _pre_request_delay()
    _check_batch_rest()

    try:
        page.goto(
            url,
            timeout=60000,
            wait_until="domcontentloaded"
        )
    except Exception as e:
        print(f"详情页访问失败:{e}")
        return {"status": "failed"}

    try:
        page.wait_for_selector("#content_views", timeout=3000)
    except Exception:
        pass

    try:
        html = page.content()
    except Exception as e:
        print(f"详情页获取HTML失败:{e}")
        return {"status": "failed"}

    is_waf = any(kw in html for kw in WAF_KEYWORDS)
    if is_waf:
        print("CSDN详情页被WAF拦截，离开后重试")
        time.sleep(random.uniform(5, 10))
        try:
            page.goto("about:blank", timeout=10000)
            time.sleep(random.uniform(30, 60))
            page.goto(url, timeout=60000, wait_until="domcontentloaded")
            time.sleep(random.uniform(5, 10))
            html = page.content()
            if any(kw in html for kw in WAF_KEYWORDS):
                print("重试仍然被WAF拦截")
                return {"status": "failed"}
        except Exception as e:
            print(f"重试失败:{e}")
            return {"status": "failed"}

    if _article_request_count % ARTICLE_BLOCK_CHECK_INTERVAL == 0:
        if _detect_block(html):
            print("\n==============================")
            print("CSDN触发反爬机制，采集终止")
            print("==============================\n")
            raise RuntimeError("CSDN触发反爬机制，采集终止")
        print("[ANTI BOT] 未发现异常")

    soup = BeautifulSoup(html, "html.parser")

    content = extract_content(html, soup)
    tags = extract_tags(html, soup)
    if detect_restricted_article(content, soup):
        print("限制文章原因检测成功，跳过入库")
        return {"status": "restricted"}
    publish_time = ""
    comment_count = extract_comment_count(html, soup)

    return {
        "status": "success",
        "content": content,
        "tags": tags,
        "publish_time": publish_time,
        "comment_count": comment_count,
    }

def extract_comment_count(html, soup):
    state = extract_csdn_state(html)
    for key in ("commentCount", "commentsCount", "comment_count"):
        val = state.get(key)
        if val is not None:
            try:
                return int(val)
            except (ValueError, TypeError):
                pass
    elem = soup.select_one("span.comment-count, .comment_num, .count")
    if elem:
        text = elem.get_text(strip=True)
        try:
            return int(text)
        except ValueError:
            pass
    return 0

def extract_csdn_state(html):
    try:
        match = re.search(
            r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
            html,
            re.DOTALL
        )
        if match:
            return json.loads(match.group(1))
    except Exception:
        pass
    return {}

def extract_publish_time(html, soup):
    time_elem = soup.select_one("span.time")
    if time_elem:
        text = time_elem.get_text(strip=True)
        match = re.search(
            r"\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}",
            text
        )
        if match:
            return match.group()

    state = extract_csdn_state(html)
    state_text = json.dumps(state, ensure_ascii=False)

    patterns = [
        r'"publishTime"\s*:\s*"(.*?)"',
        r'"publish_time"\s*:\s*"(.*?)"',
        r'"ctime"\s*:\s*"(.*?)"',
        r'"createTime"\s*:\s*"(.*?)"',
        r'"created_at"\s*:\s*"(.*?)"'
    ]
    for pattern in patterns:
        match = re.search(pattern, state_text)
        if match:
            return match.group(1)

    for meta in [
        soup.find("meta", {"name": "article:published_time"}),
        soup.find("meta", {"property": "article:published_time"})
    ]:
        if meta and meta.get("content"):
            return meta["content"]

    return ""

def extract_tags(html, soup):
    tags = []

    state = extract_csdn_state(html)
    state_text = json.dumps(state, ensure_ascii=False)
    matches = re.findall(r'"(?:tagName|name)"\s*:\s*"([^"]+)"', state_text)
    for tag in matches:
        if tag not in tags:
            tags.append(tag)

    search_tag_matches = re.findall(r'"search_tag"\s*:\s*\[(.*?)\]', state_text)
    for arr in search_tag_matches:
        inner = re.findall(r'"([^"]+)"', arr)
        for tag in inner:
            if tag not in tags:
                tags.append(tag)

    if not tags:
        for elem in soup.select("a.tag-link-new"):
            tag = elem.get_text(strip=True).lstrip("#")
            if tag and tag not in tags:
                tags.append(tag)

    if not tags:
        for selector in [".article-tags a", ".tags a"]:
            for elem in soup.select(selector):
                tag = elem.get_text(strip=True)
                if tag and tag not in tags:
                    tags.append(tag)

    return tags

def detect_restricted_article(content, soup):
    """
    判断文章是否无法完整获取正文

    包括:
    1. VIP付费文章
    2. 登录限制文章
    3. 关注作者阅读全文
    4. 隐藏正文区域
    """

    content_text = content.lower()
    soup_text = soup.get_text(
        "\n",
        strip=True
    ).lower()

    keywords = [
        "vip专享",
        "会员专享",
        "付费阅读",
        "购买后查看",
        "开通会员",
        "登录后查看",
        "登录后继续阅读",
        "查看完整内容",
        "解锁全文",
        "解锁文章",
        "关注博主",
        "关注博主即可阅读全文",
        "关注后阅读全文",
        "关注作者后查看",
        "剩余内容"
        "订阅专栏"
        "了解本专栏"
    ]

    check_text = content_text + soup_text

    for keyword in keywords:
        if keyword.lower() in check_text:
            return True


    lock_nodes = soup.select(
        ".hide-article-box,"
        ".article-lock,"
        ".vip-box"
    )

    if lock_nodes:
        return True

    if "pan.baidu.com" in check_text and "提取码" in check_text:
        print("网盘资源分享文章，跳过入库")
        return True

    return False

def extract_content(html, soup):
    for selector in [
        "#content_views", ".article_content", ".article-content",
        ".markdown_views", ".markdown-body"
    ]:
        elem = soup.select_one(selector)
        if elem:
            text = elem.get_text("\n", strip=True)
            if len(text) > 100:
                return text
    print("未找到CSDN正文节点")
    return ""

def get_search_article_ids(page):
    """
    获取当前搜索结果页文章ID列表，用于判断分页是否真正刷新
    """
    ids = []

    try:
        articles = page.locator("div.list-item")
        count = articles.count()

        for i in range(count):
            try:
                url = articles.nth(i).locator("h3.title a").get_attribute("href")
                article_id = extract_article_id(url)

                if article_id:
                    ids.append(article_id)

            except Exception:
                continue

    except Exception:
        pass

    return ids

def fetch_search_results(keyword, page_number, page):
    """
    调用CSDN搜索API获取指定页文章
    输入:
        keyword:
            搜索关键词
        page_number:
            页码
        page:
            playwright页面对象，用于获取cookie
    输出:
        [
            {
                title,
                url,
                author,
                publish_time,
                read_count,
                like_count,
                article_id
            }
        ]
    """
    api_url = "https://so.csdn.net/api/v3/search"
    params = {
        "q": keyword,
        "t": "all",
        "p": page_number,
        "s": 0,
        "tm": 0,
        "lv": -1,
        "ft": 0,
        "l": "",
        "u": "",
        "ct": -1,
        "pnt": -1,
        "ry": -1,
        "ss": -1,
        "dct": -1,
        "vco": -1,
        "cc": -1,
        "sc": -1,
        "akt": -1,
        "art": -1,
        "ca": -1,
        "prs": "",
        "pre": "",
        "ecc": -1,
        "ebc": -1,
        "ia": 1,
        "dId": "",
        "cl": -1,
        "scl": -1,
        "tcl": -1,
        "platform": "pc",
        "ab_test_code_overlap": "",
        "ab_test_random_code": ""
    }
    # 获取浏览器cookie
    cookies = {}
    try:
        browser_cookies = page.context.cookies()
        for c in browser_cookies:
            cookies[c["name"]] = c["value"]
    except Exception as e:
        print(
            "获取cookie失败:",
            e
        )
    headers = {
        "accept":
            "application/json, text/plain, */*",
        "accept-language":
            "zh-CN,zh;q=0.9,en;q=0.8",
        "accept-encoding":
            "gzip, deflate, br, zstd",
        "connection":
            "keep-alive",
        "referer":
            f"https://so.csdn.net/so/search?q={quote(keyword)}&t=all&p={page_number}",
        "user-agent":
            _browser_ua
    }
    response = requests.get(
        api_url,
        params=params,
        headers=headers,
        cookies=cookies,
        timeout=30
    )
    if response.status_code != 200:
        print(
            "搜索接口失败:",
            response.status_code
        )
        return []
    data = response.json()

    results = []
    try:
        items = data.get("result_vos", [])
    except Exception:
        print("JSON结构变化:", data)
        return []
    for item in items:
        try:
            url = item.get("url", "")
            if not url:
                url_info = item.get("url_info", {})
                if isinstance(url_info, dict):
                    url = url_info.get("url", "")
            article_id = extract_article_id(url)
            if not article_id:
                print("跳过无文章ID:", item.get("title", "")[:50])
                continue
            title = clean_html_text(
                item.get("title",""))

            results.append(
                {
                    "title": title,
                    "url": url,
                    "author":item.get("nickname",""),
                    "publish_time":item.get("created_at","") or item.get("create_time_str","") or item.get("ctime","") or item.get("date",""),
                    "read_count": item.get("view", 0) or item.get("view_num", 0),
                    "like_count": item.get("digg", 0),
                    "favorite_count": item.get("collections", 0),
                    "comment_count": item.get("comment", 0) or 0,
                    "article_id":article_id
                }
            )
        except Exception as e:
            print("解析文章失败:",e)
    return results


def collect_keyword(keyword, page, target=5):
    """采集单个关键词的文章"""
    print("==============================")
    print(f"当前关键词: {keyword}")
    print(f"目标采集: {target}篇")
    print("==============================")

    dao = CsdnArticleDAO()
    valid_count = 0
    page_number = 1
    max_pages = 10
    processed_ids = set()
    

    while valid_count < target and page_number <= max_pages:
        results = fetch_search_results(
            keyword,
            page_number,
            page
        )

        if not results:
            print("没有搜索结果")
            break

        # ── 时效优先 + 热度排序 ──
        heat_data = []
        _converted = {}
        for i, item in enumerate(results):
            publish_text = item.get("publish_time", "")
            pub_dt = parse_relative_time(publish_text)
            if pub_dt and pub_dt < PUBLISH_CUTOFF:
                continue
            like_text = item.get(
                "like_count",
                "0"
            )
            read_text = item.get(
                "read_count",
                "0"
            )
            days_ago = (datetime.now() - (pub_dt or datetime.now())).days
            like_val = convert_number(like_text)
            read_val = convert_number(read_text)
            fav_val = convert_number(item.get("favorite_count", 0))
            comment_val = convert_number(item.get("comment_count", 0))
            _converted[i] = (like_val, read_val, fav_val)
            hot_score = (
                read_val +
                like_val * 10 +
                fav_val * 10 +
                comment_val * 3
            ) / log(days_ago + e)
            heat_data.append((i, hot_score))
        heat_data.sort(key=lambda x: x[1], reverse=True)
        indexes = [h[0] for h in heat_data[:10]]
        page_ids = []
        for idx in indexes:
            try:
                article_id = results[idx].get(
                    "article_id",
                    ""
                )
                if article_id:
                    page_ids.append(article_id)
            except Exception:
                continue

        if len(page_ids) > 0 and set(page_ids).issubset(processed_ids):
            print("当前页全部重复，进入下一页")
            page_number += 1
            continue

        for i in indexes:
            if valid_count >= target:
                break

            print()
            print("------------------------------")
            print(f"第{i+1}篇文章")
            print("------------------------------")
            item = results[i]
            try:
                title = item.get("title","")
            except:
                title = ""
            try:
                url = item.get("url","")
            except:
                url = ""

            if not url:
                continue
            if "download.csdn.net" in url or "edu.csdn.net" in url or "so.csdn.net" in url:
                print("跳过非博客页面:", url)
                continue
            try:
                author = item.get("author","")
            except:
                author = ""
            try:
                publish_time = item.get("publish_time","")
            except:
                publish_time = ""
            try:
                read_count = item.get("read_count","0")
            except:
                read_count = "0"
            try:
                like_count = item.get("like_count","0")
            except:
                like_count = "0"

            source = "csdn"
            source_url = clean_csdn_url(url)
            source_article_id = extract_article_id(url)
            if source_article_id in processed_ids:
                print(f"本次关键词已处理过，跳过:{source_article_id}")
                continue

            processed_ids.add(source_article_id)

            if not source_article_id:
                print("跳过文章, source_article_id 为空:", url)
                continue

            if dao.exists(source_article_id):
                print(f"重复文章跳过: {source_article_id}")
                time.sleep(random.uniform(0.5, 1.5))
                continue

            # L1 pre-check before detail fetch
            pre_dict = {"title": title, "tags": [], "content": title}
            if not is_it_domain(pre_dict):
                print("L1过滤: 非IT领域, 跳过")
                continue

            favorite_count = item.get("favorite_count", 0)
            detail = fetch_article_detail(source_url, page)
            if detail["status"] == "restricted":
                print(f"CSDN限制文章过滤，不入库:{source_article_id}")
                continue
            if detail["status"] == "failed":
                print(f"CSDN详情获取失败，不入库:{source_article_id}")
                continue
            content = detail["content"]
            tags = detail["tags"]
            comment_count = detail.get("comment_count", 0)

            print(f"CSDN详情访问:{source_article_id}")
            if not all([source, source_article_id, title, author, source_url]):
                print("数据字段缺失，跳过:")
                print("标题:", title.strip() if title else "")
                continue

            publish_time = convert_publish_time(publish_time)
            if not publish_time:
                print("发布时间解析失败:", title)
                publish_time = None

            like_val, read_val, fav_val = _converted[i]
            article = CsdnArticle(
                source="csdn",
                source_article_id=source_article_id,
                title=title,
                author=author,
                tags=tags,
                publish_time=publish_time,
                read_count=read_val,
                like_count=like_val,
                favorite_count=fav_val,
                comment_count=comment_count,
                source_url=source_url,
                content=content,
                crawl_time=datetime.now()
            )
            article_dict = {
                "title": title,
                "tags": tags,
                "content": content if content else title,
            }
            if not is_it_domain(article_dict):
                print("L1过滤: 非IT领域, 跳过")
                continue
            if not is_technical_article(article_dict):
                print("L2过滤: 非技术文章, 跳过")
                continue
            if not has_analysis_value(article_dict):
                print("L3过滤: 无分析价值, 跳过")
                continue
            print(article)
            result = dao.insert(article)
            if result:
                valid_count += 1
                print(f"数据库新增成功 {valid_count}/{target}: {source_article_id}")
            else:
                print(f"入库失败: {source_article_id}")
            time.sleep(random.uniform(0.5, 1.5))
        page_number += 1
        if valid_count < target:
            time.sleep(random.uniform(1, 2))
    print(f"{keyword}采集完成: {valid_count}篇")
    return valid_count

def collect_csdn():
    context = None
    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False,
                viewport={
                    "width":1280,
                    "height":900
                },
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--start-maximized",
                    "--window-position=-2000,-2000"
                ]
            )
            
            context.route(
                "**/*",
                handle_route
            )
            if context.pages:
                page = context.pages[0]
            else:
                page = context.new_page()
            page.add_init_script("""
Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined
});
""")
            global _browser_ua
            _browser_ua = page.evaluate("navigator.userAgent")
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
                print(f"=== {phase_name}（随机2个关键词）===")
                for keyword in random.sample(group,min(2,len(group))):
                    collect_keyword(
                        keyword,
                        page,
                        target=5
                    )
            print()
            print("==============================")
            print("CSDN采集测试完成")
            print("==============================")
            input("按 Enter 关闭浏览器...")
    except Exception as e:
        print(f"\n采集异常:{e}")
    finally:
        if context:
            try:
                context.close()
            except Exception:
                pass

def login_csdn():
    """打开浏览器让用户登录 CSDN，保存 cookie 后退出。"""
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto("https://www.csdn.net", timeout=60000, wait_until="domcontentloaded")
        time.sleep(random.uniform(2,4))
        print("请在浏览器中登录 CSDN 账号")
        print("登录后的 cookie 会自动保存到 browser_data/csdn/ 目录")
        input("登录完成后按 Enter 保存登录状态并关闭浏览器...")
        context.close()

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "login":
            login_csdn()
        else:
            collect_csdn()
    except KeyboardInterrupt:
        print("\n用户主动停止采集")
    except Exception as e:
        print(f"程序异常退出:{e}")