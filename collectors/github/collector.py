"""
GitHub Repository Collector

功能:
1. 从GitHub搜索页获取仓库
2. 进入仓库详情页
3. 提取仓库信息

"""

from playwright.sync_api import sync_playwright
from datetime import datetime
from urllib.parse import quote
import json
import sys
import re
import time
import os
import math
from bs4 import BeautifulSoup

from models.github_repository import GitHubRepository
from dao.github_repository_dao import GitHubRepositoryDAO

from random import sample, randint
import keyboard
from config.github_keywords import GITHUB_KEYWORD_GROUPS
from rules.github_rules.github_domain_filter import is_github_domain
from rules.github_rules.github_technical_filter import is_github_technical
from rules.github_rules.github_analysis_value_filter import has_analysis_value
USER_DATA_DIR = "./browser_data/github"

MAX_SEARCH_PAGE = 10

REPOSITORY_BATCH_LIMIT = 30
REPOSITORY_BATCH_REST_MIN = 20
REPOSITORY_BATCH_REST_MAX = 40
MIN_STAR_COUNT = 100

skip_keyword = False

def on_skip_key(event):
    global skip_keyword
    skip_keyword = True
    print("\n[提示] 按空格键跳过当前关键词")

class GithubCollector:

    def __init__(self):
        self.keyword_groups = GITHUB_KEYWORD_GROUPS
        self.keyword_count_per_group = 3
        self.repository_limit_per_keyword = 5
        self.collected_repository_ids = set()

    def build_search_url(self, keyword, page_num=1):
        return (
            "https://github.com/search"
            "?q=" + quote(keyword) + "&type=repositories" + "&p=" + str(page_num)
        )

    def check_login(self, page):
        for attempt in range(2):
            try:
                page.goto(
                    "https://github.com",
                    wait_until="domcontentloaded",
                    timeout=60000
                )
                page.wait_for_timeout(1500)
                avatar = page.locator("img.avatar")
                return avatar.count() > 0
            except Exception as e:
                print(f"GitHub访问失败，第 {attempt + 1} 次：{e}")
                if attempt == 0:
                    time.sleep(5)
        return False

    #关键词批次生成函数
    def get_batch_keywords(self):
        keywords = []
        for category, category_keywords in self.keyword_groups.items():
            selected_keywords = sample(
                category_keywords,
                min(
                    self.keyword_count_per_group,
                    len(category_keywords)
                )
            )
            keywords.extend(selected_keywords)
        return keywords


    def parse_count(self, text):

        """
        处理:
        66k
        21.2k
        2164

        转数字
        """
        if not text:
            return 0
        text = text.strip().lower()
        try:
            if "k" in text:
                return int(
                    float(
                        text.replace("k", "")
                    )
                    * 1000
                )
            return int(text)
        except:
            return 0

    def calculate_hot_score(
        self,
        star_count,
        search_update_time
    ):
        """
        GitHub搜索列表阶段 Hot Score
        仅用于搜索结果排序：
        - Star：50%
        - 更新时间：50%
        不进入 data
        不进入 model
        不入库
        """
    # ==============================
    # Star 热度分数
    # 使用对数压缩，避免 Star 数量过大直接碾压时效因素
    # ==============================
        star_score = math.log(
            star_count + 1
        )
    # ==============================
    # 更新时间分数
    # 更新时间越接近当前时间，分数越高
    # ==============================
        update_score = 0
        if search_update_time:
            try:
            # GitHub搜索列表中的时间格式：
            # 2026年7月6日 GMT+8 14:36
                match = re.search(
                    r"(\d{4})年(\d{1,2})月(\d{1,2})日.*?(\d{1,2}):(\d{2})",
                    search_update_time
                )
                if match:
                    year = int(match.group(1))
                    month = int(match.group(2))
                    day = int(match.group(3))
                    hour = int(match.group(4))
                    minute = int(match.group(5))

                    update_date = datetime(year,month,day,hour,minute)
                    now = datetime.now()
                    days = (now - update_date).days
                    if days < 0:
                        days = 0
                    update_score = 1 / math.log(
                        days + math.e
                    )
            except Exception:
                update_score = 0
    # ==============================
    # 综合 Hot Score
    #
    # Star        50%
    # 更新时间    50%
    # ==============================
        return (
            star_score * 0.5
            +
            update_score * 0.5
        )

    def is_duplicate(self, data):
        source_url = data.get("source_url", "")
        if not source_url:
            return False
        repo_id = source_url.replace("https://github.com/","").strip("/")
        if repo_id in self.collected_repository_ids:
            return True
        self.collected_repository_ids.add(repo_id)
        return False


    def get_repository_links(self, page, keyword, page_num=1):

        """
        搜索页获取仓库链接
        返回: [(url, repo_id, star_count, search_update_time), ...] 元组列表
        """

        search_url = self.build_search_url(keyword, page_num)

        page.goto(
            search_url,
            wait_until="domcontentloaded",
            timeout=60000
        )

        try:
            page.wait_for_selector(
                "div[data-testid='results-list']",
                timeout=10000
            )
        except:
            return []
        links = page.locator(
            "div[data-testid='results-list'] a"
        )
        result = []
        count = links.count()
        for i in range(count):
            href = links.nth(i).get_attribute("href")
            text = links.nth(i).inner_text().strip()
            if not href:
                continue
            if "/" not in text:
                continue
            parts = href.strip("/").split("/")
            if len(parts) != 2:
                continue
            url = (
                "https://github.com"
                + href
            )
            repo_id = f"{parts[0]}/{parts[1]}"
            star_count = 0
            try:
                result_container = links.nth(i).locator(
                    "xpath=ancestor::*[.//a[contains(@href, '/stargazers')]][1]"
                )
                star_element = result_container.locator(
                    "a[href*='/stargazers'][aria-label*='stars']"
                ).first
                if star_element.count() > 0:
                    star_text = star_element.get_attribute(
                        "aria-label"
                    )
                    if star_text:
                        star_text = (
                            star_text
                            .replace("stars", "")
                            .strip()
                        )
                        star_count = self.parse_count(
                            star_text
                        )
            except Exception:
                star_count = 0

            search_update_time = None
            try:
                result_container = links.nth(i).locator(
                    "xpath=ancestor::*[.//a[contains(@href, '/stargazers')]][1]"
                )
                update_element = result_container.locator(
                    "div[title*='GMT+'][data-inline='true']"
                ).first
                if update_element.count() > 0:
                    search_update_time = update_element.get_attribute("title")
            except Exception:
                search_update_time = None
            result.append((url, repo_id,star_count,search_update_time))
        # repo_id 去重
        unique_result = []
        seen_ids = set()
        for item in result:
            repo_id = item[1]
            if repo_id in seen_ids:
                continue
            seen_ids.add(repo_id)
            unique_result.append(item)
        return unique_result


    def extract_readme_content(self, page):
        """
        获取GitHub README内容
        支持: 标题、正文、列表、表格、代码块
        """
        try:
            html = page.locator(
                "article.markdown-body.entry-content"
            ).inner_html()
        except Exception:
            print("README获取失败")
            return ""

        soup = BeautifulSoup(html, "html.parser")
        contents = []
        for element in soup.find_all(
            [
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "p",
                "ul",
                "ol",
                "table",
                "pre"
            ]
        ):
            name = element.name
            # 标题: 只保留标题文字
            if name in ["h1", "h2", "h3", "h4", "h5", "h6"]:
                text = element.get_text(" ", strip=True)
                if text:
                    contents.append(text)
            # 正文
            elif name == "p":
                text = element.get_text("", strip=True)
                if text:
                    contents.append(text)
            # 列表
            elif name in ["ul", "ol"]:
                items = []
                for li in element.find_all(
                    "li",
                    recursive=False
                ):
                    text = li.get_text(" ", strip=True)
                    if text:
                        items.append("- " + text)
                if items:
                    contents.append("\n".join(items))
            # 表格
            elif name == "table":
                rows = []
                for tr in element.find_all("tr"):
                    cells = []
                    for cell in tr.find_all(
                        ["th", "td"]
                    ):
                        text = cell.get_text(" ", strip=True)
                        cells.append(text)
                    if cells:
                        rows.append(" | ".join(cells))
                if rows:
                    contents.append("\n".join(rows))
            # 代码块: 直接保存代码内容
            elif name == "pre":
                code = element.get_text("\n", strip=True)
                if code:
                    contents.append(code)
        return "\n\n".join(contents)

    def check_readme_valid(self, content, page):
        """
        过滤以下无价值仓库:
        1. 没有README
        2. README无权限访问
        3. private仓库
        4. GitHub默认空README提示
        5. README内容过短

        返回True表示有效，False表示无效
        """
        if not content:
            return False

        page_text = ""

        try:
            page_text = page.locator(
                "body"
            ).inner_text()
        except:
            pass

        check_text = content + page_text

        filter_keywords = [
            "This repository doesn't have a README yet",
            "Ask Copilot to learn how this project works",
            "You don't have access to this repository",
            "This repository is private",
            "This repository is empty.",
            "Care to check out the GitHub Channel on YouTube while you wait?",
            "404",
            "Not Found"
        ]

        for keyword in filter_keywords:
            if keyword in check_text:
                return False

        if len(content.strip()) < 200:
            return False

        return True

    def parse_repository_detail(self, page, url, star_count):

        page.goto(
            url,
            wait_until="commit",
            timeout=60000
        )
        page.wait_for_timeout(3000)

        try:
            page.wait_for_selector(
                "article.markdown-body.entry-content",
                timeout=8000
            )
        except:
            pass

        page.wait_for_timeout(500)

        # Repository ID
        repository_id = ""
        try:
            repository_id = page.locator(
                "meta[name='octolytics-dimension-repository_id']"
            ).get_attribute(
                "content"
            )
        except:
            pass

        # 仓库名称
        title = ""


        try:

            og_title = page.locator(
                "meta[property='og:title']"
            ).get_attribute(
                "content"
            )
            if og_title:
                title = (
                    og_title
                    .split(":")[0]
                    .split("/")[-1]
                    .strip()
                )
        except:
            pass



        # 作者
        author = ""
        try:
            author = (
                url
                .replace("https://github.com/","")
                .split("/")[0]
            )
        except:
            pass


        # 简介
        description = ""
        try:
            about = page.locator("h2",has_text="About")
            if about.count() > 0:
                description = about.locator(
                "xpath=following-sibling::p[1]"
            ).inner_text()
        except:
            pass


        # Topics
        tags = []
        try:
            tags = [
                tag.strip()
                for tag in page.locator(
                    "a[href^='/topics/']"
                ).all_inner_texts()
        ]
        except:
            pass

        # Language
        
        language = []
        try:
            language_items = page.locator(
                "span[data-component='ProgressBar.Item']"
            ).evaluate_all(
                """
                elements => elements.map(
                    element => element.getAttribute('aria-label')
                )
                """
            )
            if language_items:
                language = [
                    item.split(":")[0].strip()
                    for item in language_items
                    if item
                ]
                language = ",".join(language)
        except:
            pass

        # Repository created time

        publish_time = None
        try:
            repo_data = page.locator(
                "script"
            ).evaluate_all(
                """
                elements => {
                    for (const element of elements) {
                        if (element.textContent.includes('createdAt')) {
                            return element.textContent;
                        }
                    }
                    return null;
                }
                """
            )
            if repo_data:
                created_match = re.search(
                    r'"createdAt":"([^"]+)"',
                    repo_data
                )
                if created_match:
                    publish_time = created_match.group(1)
        except:
            pass

        # Latest commit time
        update_time = None

        try:
            update_element = page.locator(
                "[data-testid='latest-commit'] relative-time"
            )
            if update_element.count() > 0:
                update_time = update_element.get_attribute( "datetime")
        except:
            pass

        # Fork
        favorite_count = 0
        try:
            fork_text = page.locator(
                "a[href*='/forks'] "
                "span.text-bold"
            ).inner_text()
            favorite_count = self.parse_count(
                fork_text
            )
        except:
            pass

        # NULL字段
        read_count = None
        #try:
            #watch_element = page.locator(
            #    ".prc-ButtonLabel-CounterLabel-X-kRU"
            #)
            #if watch_element.count() > 0:
            #    read_count = self.parse_count(
            #        watch_element.inner_text()
            #    )
        #except:
        #    pass

        # README

        content = self.extract_readme_content(page)

        if not self.check_readme_valid(content, page):

            print(
                f"README无效，跳过:{url}"
            )

            return None

        return {
            "source":"GitHub",
            "source_article_id":repository_id,
            "title":title,
            "author":author,
            "tags":tags,
            "language":language,
            "publish_time":publish_time,
            "update_time": update_time,
            "read_count":read_count,
            "like_count":star_count,
            "favorite_count":favorite_count,
            "comment_count":None,
            "source_url":url,
            "summary":description,
            "content":content,
            "crawl_time":datetime.now(),
        }

    def print_repository_debug(self, data, layer_label):
        """单块展示仓库字段 + 过滤状态"""
        print("=" * 40)
        print(f"[名称] {data.get('title', '')}")
        print(f"[Tags] {data.get('tags') or []}")
        print(f"[语言] {data.get('language', '')}")
        print(f"[概要] {data.get('summary', '')}")
        print(f"[状态] {layer_label}")

        print(f"[创建时间] {data.get('publish_time')}")
        print(f"[更新时间] {data.get('update_time')}")
        print("-" * 40)
    def filter_repository(self, repository_data):
        """
        GitHub 五层过滤
        STAR:
        Star值过低仓库过滤（低于MIN_STAR_COUNT直接过滤，无需进入后续过滤）
        TIME:
        长期未更新仓库过滤
        L1:
        IT领域判断
        L2:
        工程真实性判断
        L3:
        分析价值判断
        """
        # STAR过滤：Star值过低直接过滤
        star_count = repository_data.get("like_count") or 0
        if star_count < MIN_STAR_COUNT:
            self.print_repository_debug(
                repository_data,
                "STAR过滤"
            )
            return False, "STAR"

        update_time = repository_data.get("update_time")

        if update_time:
            update_date = datetime.fromisoformat(
                update_time.replace("Z", "+00:00")
            )

            limit_date = datetime(
                2024,
                1,
                1
            )

            if update_date.replace(tzinfo=None) < limit_date:
                self.print_repository_debug(
                    repository_data,
                    "TIME过滤"
                )
                return False, "TIME"

        if not is_github_domain(repository_data):
            self.print_repository_debug(repository_data, "L1过滤")
            return False, "L1"
        if not is_github_technical(repository_data):
            self.print_repository_debug(repository_data, "L2过滤")
            return False, "L2"
        if not has_analysis_value(repository_data):
            self.print_repository_debug(repository_data, "L3过滤")
            return False, "L3"
        self.print_repository_debug(repository_data, "通过 STAR+TIME+L1+L2+L3")
        return True, None


    def check_batch_rest(self, request_count):
        """
        每采集 REPOSITORY_BATCH_LIMIT 个仓库
        暂停随机时间防止触发反爬
        """
        if (
            request_count > 0
            and request_count % REPOSITORY_BATCH_LIMIT == 0
        ):
            rest_time = randint(
                REPOSITORY_BATCH_REST_MIN,
                REPOSITORY_BATCH_REST_MAX
            )
            print(
                f"[BATCH] 连续采集{REPOSITORY_BATCH_LIMIT}个仓库"
                f", 暂停{rest_time}s"
            )
            time.sleep(rest_time)


    def run(self):
        dao = GitHubRepositoryDAO()
        total_keywords = 0
        total_repositories = 0
        total_saved = 0
        total_duplicate = 0
        total_failed = 0

        total_star_filtered = 0
        total_l1_filtered = 0
        total_l2_filtered = 0
        total_l3_filtered = 0
        total_time_filtered = 0

        with sync_playwright() as p:
            context = None
            page = None
            try:
                context = p.chromium.launch_persistent_context(
                    user_data_dir=USER_DATA_DIR,
                    headless=False
                )
                page = context.new_page()

                if not self.check_login(page):
                    print("GitHub登录状态失效，请重新登录")
                    context.close()
                    return

                self.collected_repository_ids = dao.load_collected_ids()
                print(f"已加载 {len(self.collected_repository_ids)} 个已采集的GitHub仓库ID")

                keyboard.on_press_key('space', on_skip_key)
                print("[提示] 按 空格键 可跳过当前关键词")

                keywords = self.get_batch_keywords()
                request_count = 0
                global skip_keyword
                for keyword in keywords:

                    if skip_keyword:
                        print(f"\n[跳过] 关键词: {keyword}")
                        skip_keyword = False
                        continue

                    total_keywords += 1

                    print("==============================")
                    print(f"正在搜索GitHub关键词:{keyword}")

                    keyword_saved = 0
                    keyword_duplicate = 0
                    keyword_failed = 0

                    keyword_star_filtered = 0
                    keyword_l1_filtered = 0
                    keyword_l2_filtered = 0
                    keyword_l3_filtered = 0
                    keyword_time_filtered = 0

                    page_num = 1
                    search_candidates = []

                    while page_num <= MAX_SEARCH_PAGE:
                        page_repositories = self.get_repository_links(
                            page,
                            keyword,
                            page_num
                        )

                        if not page_repositories:
                            break

                        new_repositories = [
                            (
                                url,
                                repo_id,
                                star_count,
                                search_update_time
                            )
                            for (
                                url,
                                repo_id,
                                star_count,
                                search_update_time
                            ) in page_repositories
                            if repo_id not in self.collected_repository_ids
                        ]

                        skipped = (
                            len(page_repositories)
                            - len(new_repositories)
                        )

                        if skipped > 0:
                            print(
                                f"跳过 {skipped} 个已采集仓库"
                            )

                        search_candidates.extend(
                            new_repositories
                        )

                        page_num += 1

                    if not search_candidates:
                        print("没有新的搜索候选仓库")
                        continue

                    total_repositories += len(search_candidates)

                    search_candidates.sort(
                        key=lambda x: self.calculate_hot_score(
                            x[2],
                            x[3]
                        ),
                        reverse=True
                    )

                    for (
                        url,
                        repo_id,
                        star_count,
                        search_update_time
                    ) in search_candidates:

                        if keyword_saved >= self.repository_limit_per_keyword:
                            break

                        try:
                            data = self.parse_repository_detail(
                                page,
                                url,
                                star_count
                            )

                            if not data:
                                continue

                            request_count += 1
                            self.check_batch_rest(
                                request_count
                            )

                            if self.is_duplicate(data):
                                keyword_duplicate += 1
                                total_duplicate += 1
                                print(
                                    f"重复仓库跳过:{data.get('title')}"
                                )
                                continue
                            self.collected_repository_ids.add(repo_id)
                            passed, reason = self.filter_repository(
                                data
                            )
                            if not passed:
                                if reason == "STAR":
                                    keyword_star_filtered += 1
                                    total_star_filtered += 1
                                elif reason == "TIME":
                                    keyword_time_filtered += 1
                                    total_time_filtered += 1
                                elif reason == "L1":
                                    keyword_l1_filtered += 1
                                    total_l1_filtered += 1
                                elif reason == "L2":
                                    keyword_l2_filtered += 1
                                    total_l2_filtered += 1
                                elif reason == "L3":
                                    keyword_l3_filtered += 1
                                    total_l3_filtered += 1
                                continue

                            repo = GitHubRepository(
                                **data
                            )

                            insert_result = dao.insert(
                                repo
                            )

                            if insert_result:

                                keyword_saved += 1
                                total_saved += 1

                                print(
                                    f"已保存:{repo.title}"
                                )

                            else:

                                keyword_duplicate += 1
                                total_duplicate += 1

                        except Exception as e:

                            keyword_failed += 1
                            total_failed += 1

                            print(
                                f"仓库处理失败:{url}"
                            )
                            print(e)

                    print(
                        f"""
关键词完成:
关键词: {keyword}
STAR过滤:{keyword_star_filtered}
TIME过滤:{keyword_time_filtered}
L1过滤:{keyword_l1_filtered}
L2过滤:{keyword_l2_filtered}
L3过滤:{keyword_l3_filtered}
有效保存数量:{keyword_saved}
重复:{keyword_duplicate}
失败:{keyword_failed}
"""
                    )

                print(
                    f"""
==============================
GitHub采集完成

关键词数量:{total_keywords}
发现仓库:{total_repositories}
STAR过滤:
{total_star_filtered}
TIME过滤:
{total_time_filtered}
L1过滤:
{total_l1_filtered}
L2过滤:
{total_l2_filtered}
L3过滤:
{total_l3_filtered}
新增保存:
{total_saved}
重复跳过:
{total_duplicate}
失败:
{total_failed}
==============================
"""
                )

            except KeyboardInterrupt:
                print()
                print("已收到 Ctrl+C，正在退出...")
                print("GitHub采集已中断")
                return
            finally:
                if context:
                    try:
                        context.close()
                    except Exception:
                        pass


def login_github():
    """打开浏览器让用户登录 GitHub，保存登录状态后退出。"""
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=USER_DATA_DIR,
            headless=False,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto("https://github.com", timeout=60000, wait_until="domcontentloaded")
        print("请在浏览器中登录 GitHub 账号")
        print("登录后的登录态会自动保存到 browser_data/github/ 目录")
        input("登录完成后按 Enter 保存登录状态并关闭浏览器...")
        context.close()


def collect_github():
    try:
        collector = GithubCollector()
        collector.run()
    except KeyboardInterrupt:
        print("\nGitHub采集已中断")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "login":
        try:
            login_github()
        except KeyboardInterrupt:
            print()
            print("已收到 Ctrl+C，正在退出...")
            sys.exit(0)
    else:
        try:
            collector = GithubCollector()
            collector.run()
        except KeyboardInterrupt:
            print()
            print("程序强制退出")
            sys.exit(0)