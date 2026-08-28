"""Zhilian collector.

Collect job list data and extract detail page JSON fields.
"""
from playwright.sync_api import sync_playwright, TimeoutError
import re
import json
import sys
from pathlib import Path
from models.job_raw import JobRaw
from datetime import datetime, timedelta

KEYWORDS = [
    "Java",
    "Python",
    "Go",
    "前端",
    "后端",
    "全栈",
    "测试",
    "自动化测试",
    "数据分析",
    "数据开发",
    "算法",
    "NLP",
    "大模型",
    "AI",
    "运维",
    "网络安全",
    "渗透测试",
    "小程序",
    "分布式",
    "微服务"
]

MAX_JOBS_PER_KEYWORD = 5

def log_info(*parts):
    print("[INFO]", *parts)

def log_warning(*parts):
    print("[WARNING]", *parts)

def log_error(*parts):
    print("[ERROR]", *parts)

def log_success(*parts):
    print("[SUCCESS]", *parts)

class ZhilianCollector:

    def __init__(self, keyword,max_jobs):

        self.url = "https://www.zhaopin.com/"
        self.keyword = keyword
        self.max_jobs = max_jobs


    def extract_detail_json(self, html):

        """
        从详情页 HTML 中查找包含岗位数据的 JSON
        """

        scripts = re.findall(
            r'<script[^>]*>(.*?)</script>',
            html,
            re.S
        )

        for script in scripts:


            if "jobSummary" in script:


                log_info(
                    "找到详情JSON"
                )


                return script



        log_warning(
            "没有找到目标JSON"
        )


        return None




    def convert_publish_time(self, text):
        """
        转换智联招聘更新时间
        """

        if not text:
            return None

        now = datetime.now()

        text = text.strip()

        # 去掉前面的文字
        text = text.replace(
            "更新时间",
            ""
        ).strip()


        # 今天
        if "今天" in text:
            return datetime(
                now.year,
                now.month,
                now.day
            )


        # 昨天
        if "昨天" in text:
            return datetime(
                now.year,
                now.month,
                now.day
            ) - timedelta(days=1)


        # 例如：7月9日
        if "月" in text and "日" in text:

            try:

                month = int(
                    text.split("月")[0]
                )

                day = int(
                    text.split("月")[1]
                    .replace("日", "")
                )


                return datetime(
                    now.year,
                    month,
                    day
                )


            except Exception:

                return None


        # 例如：2026-07-09
        try:

            return datetime.strptime(
                text,
                "%Y-%m-%d"
            )

        except Exception:

            return None

    def parse_detail_data(self, json_text):

        """
        递归解析岗位详情数据
        """


        try:


            start = json_text.find("{")

            end = json_text.rfind("}")


            json_text = json_text[start:end+1]


            data = json.loads(
                json_text
            )



            result = {


                "jobSummary": None,


                "jobSkillTags": None

            }




            def search_json(obj):


                if isinstance(obj, dict):


                    for key, value in obj.items():



                        # 岗位描述

                        if key == "jobSummary":


                            result["jobSummary"] = value




                        # 技能标签
                        if key in [
                            "jobSkillTags",
                            "skillTags",
                            "skills"
                        ]:


                            result["jobSkillTags"] = value




                        search_json(value)




                elif isinstance(obj, list):


                    for item in obj:


                        search_json(item)





            search_json(data)



            return result



        except Exception as e:


            log_error(
                "JSON解析失败:",
                e
            )


            return {}





    def start(self, context):
            jobs = []
            random_module = __import__("random")
            def is_page_closed(target_page):
                if target_page is None:
                    return True

                try:
                    return target_page.is_closed()
                except Exception:
                    return True

            def perform_random_behavior(target_page):
                if is_page_closed(target_page):
                    return

                try:
                    target_page.mouse.move(
                        random_module.randint(120, 900),
                        random_module.randint(120, 700),
                        steps=random_module.randint(8, 20)
                    )
                except Exception:
                    pass

                try:
                    target_page.mouse.wheel(
                        0,
                        random_module.randint(150, 700)
                    )
                except Exception:
                    pass

                try:
                    target_page.wait_for_timeout(
                        int(random_module.uniform(1500, 3200))
                    )
                except Exception:
                    pass

            def check_login(target_page):

                login_url_keywords = [
                    "login",
                    "passport",
                    "signin",
                ]

                login_title_keywords = [
                    "欢迎来到智联招聘",
                    "验证码登录",
                    "立即登录",
                    "立即注册",
                ]

                login_visible_text = [
                    "欢迎来到智联招聘",
                    "立即登录",
                    "立即注册",
                ]


                if is_page_closed(target_page):
                    return False


                try:
                    page_url = target_page.url
                except Exception:
                    page_url = ""


                try:
                    page_title = target_page.title()
                except Exception:
                    page_title = ""


                need_login = False


                # URL判断
                url_lower = page_url.lower()

                if any(
                    keyword in url_lower
                    for keyword in login_url_keywords
                ):
                    need_login = True


                # 标题判断
                if not need_login:

                    if any(
                        keyword in page_title
                        for keyword in login_title_keywords
                    ):
                        need_login = True


                # 可见文字判断
                if not need_login:

                    for text in login_visible_text:

                        try:

                            locator = target_page.get_by_text(
                                text,
                                exact=False
                            )

                            if locator.count() > 0:

                                if locator.first.is_visible(timeout=1000):
                                    need_login = True
                                    break

                        except Exception:
                            continue


                return not need_login

            def check_security_verification(target_page):

                verify_url_keywords = [
                    "captcha",
                    "verify",
                    "security",
                ]


                verify_title_keywords = [
                    "安全验证",
                    "滑块验证",
                    "人机验证",
                    "验证码验证",
                ]


                verify_visible_text = [
                    "请完成安全验证",
                    "拖动滑块完成验证",
                    "请验证你是人类",
                ]


                if is_page_closed(target_page):
                    return False


                try:
                    page_url = target_page.url
                except Exception:
                    page_url = ""


                try:
                    page_title = target_page.title()
                except Exception:
                    page_title = ""



                need_verify = False



                # URL检测

                if any(
                    keyword in page_url.lower()
                    for keyword in verify_url_keywords
                ):
                    need_verify = True



                # 标题检测

                if not need_verify:

                    if any(
                        keyword in page_title
                            for keyword in verify_title_keywords
                    ):
                        need_verify = True



                # 可见文本检测

                if not need_verify:

                    for text in verify_visible_text:

                        try:

                            locator = target_page.get_by_text(
                            text,
                            exact=False
                        )


                            if locator.count() > 0:

                                if locator.first.is_visible(timeout=1000):
                                    need_verify = True
                                    break


                        except Exception:
                            continue


                return not need_verify

            def open_detail_page(job_name_element):
                try:
                    with page.expect_popup(timeout=15000) as popup_info:
                        job_name_element.click()
                except TimeoutError as e:
                    log_error("详情页弹窗捕获超时:", e)
                    return None
                except Exception as e:
                    log_error("详情页弹窗打开失败:", e)
                    return None

                try:
                    detail_page = popup_info.value
                except Exception as e:
                    log_error("获取详情页对象失败:", e)
                    return None

                if is_page_closed(detail_page):
                    log_error("详情页已关闭，跳过当前岗位")
                    return None

                try:
                    detail_page.wait_for_load_state(
                        "domcontentloaded",
                        timeout=60000
                    )
                    detail_page.wait_for_timeout(
                        random_module.randint(5000, 8000)
                    )
                except Exception as e:
                    log_warning("详情页加载等待异常:", e)

                return detail_page

            def recover_page():
                if context.is_closed():
                    log_error("浏览器上下文已关闭，无法恢复")
                    return None

                if context.pages:
                    recovered_page = context.pages[-1]
                else:
                    recovered_page = context.new_page()

                recovered_page.goto(
                    f"https://www.zhaopin.com/sou/?kw={self.keyword}",
                    timeout=60000
                )
                recovered_page.wait_for_load_state(
                    "domcontentloaded",
                    timeout=60000
                )
                recovered_page.wait_for_timeout(10000)

                return recovered_page

            if context.pages:
                page = context.pages[-1]
            else:
                page = context.new_page()

            log_info("打开智联招聘...")

            try:
                page.goto(
                    self.url,
                    timeout=60000
                )
                page.wait_for_timeout(
                    3000
                )
            except Exception as e:
                log_error("打开智联招聘失败:", e)
                return jobs

            if not check_login(page) or not check_security_verification(page):
                log_warning("未检测到登录状态或触发安全验证，跳过本次采集。")
                log_warning("请先登录: python -m collectors.zhilian.collector login")
                return jobs

            log_info(
                f"进入{self.keyword}搜索页..."
            )

            page.goto(
                f"https://www.zhaopin.com/sou/?kw={self.keyword}",
                timeout=60000
            )

            page.wait_for_timeout(
                10000
            )

            log_info(
                "当前网址:",
                page.url
            )

            log_info(
                "当前标题:",
                page.title()
            )

            job_count = page.locator(
                ".joblist-box__item"
            ).count()

            log_info(
                "本次采集数量:",
                min(job_count, self.max_jobs)
            )

            if job_count == 0:

                log_warning(
                    "没有找到岗位列表"
                )

                return jobs

            for i in range(min(job_count, self.max_jobs)):

                log_info(
                    f"正在处理第{i + 1}/{min(job_count, self.max_jobs)}个岗位"
                )

                detail_page = None

                try:

                    if is_page_closed(page):
                        log_warning("列表页已关闭，尝试恢复搜索页")
                        if context.pages:
                            page = context.pages[0]
                        else:
                            page = context.new_page()

                        page.goto(
                            f"https://www.zhaopin.com/sou/?kw={self.keyword}",
                            timeout=60000
                        )
                        page.wait_for_timeout(10000)

                    job_elements = page.locator(
                        ".joblist-box__item"
                    )

                    current_job = job_elements.nth(i)

                    job_name_element = current_job.locator(
                        ".jobinfo__name"
                    )

                    job_name = job_name_element.inner_text(
                        timeout=10000
                    )

                    job_url = job_name_element.get_attribute(
                        "href"
                    )

                    salary = current_job.locator(
                        ".jobinfo__salary"
                    ).inner_text(
                        timeout=10000
                    )

                    company = current_job.locator(
                        ".companyinfo__name"
                    ).inner_text(
                        timeout=10000
                    )

                    info_list = current_job.locator(
                        ".jobinfo__other-info-item"
                    ).all_inner_texts()

                    skills = current_job.locator(
                        ".jobinfo__tag .joblist-box__item-tag"
                    ).all_inner_texts()

                    log_info("====================")

                    log_info(
                        "岗位名称:",
                        job_name
                    )

                    log_info(
                        "公司名称:",
                        company
                    )

                    log_info(
                        "薪资:",
                        salary
                    )

                    log_info(
                        "职位详情URL:",
                        job_url
                    )

                    perform_random_behavior(page)

                    log_info(
                        "正在打开职位详情页..."
                    )

                    detail_page = open_detail_page(job_name_element)

                    if detail_page is None:
                        log_error(f"第{i + 1}个岗位采集失败")
                        continue


                    
                    # 获取岗位更新时间
                    publish_time = None

                    try:
                        update_time_element = detail_page.locator(
                        ".summary-planes__time"
                        )

                        if update_time_element.count() > 0:

                            publish_time_text = update_time_element.inner_text(
                            timeout=5000
                            )

                            log_info(
                            "原始更新时间:",
                            publish_time_text
                            )

                            publish_time = self.convert_publish_time(
                                publish_time_text
                            )

                            log_info(
                                "转换后更新时间:",
                                publish_time
                            )

                    except Exception as e:
                        log_warning(
                            "更新时间获取失败:",
                            e
                        )



                    # 获取岗位类型
                    raw_job_type = None

                    try:

                        info_items = detail_page.locator(
                            ".summary-planes__info li"
                        )

                        if info_items.count() >= 4:

                            raw_job_type = info_items.nth(3).inner_text()

                            log_info(
                            "岗位类型:",
                            raw_job_type
                            )

                    except Exception as e:

                        log_warning(
                        "岗位类型获取失败:",
                        e
                        )

                    # 获取公司简介
                    raw_company_info = None

                    try:
                        company_intro = detail_page.locator(
                            ".company-info__intro"
                        )

                        if company_intro.count() > 0:
                            raw_company_info = company_intro.inner_text(
                            timeout=5000
                            )

                            log_info(
                                "公司简介:",
                                raw_company_info
                            )

                    except Exception as e:
                        log_warning(
                            "公司信息获取失败:",
                            e
                        )

                    log_info(
                        "详情页标题:",
                        detail_page.title()
                    )

                    detail_html = detail_page.content()

                    log_info(
                        "是否存在岗位描述:",
                        "jobSummary" in detail_html
                    )

                    log_info(
                        "是否存在技能标签:",
                        "jobSkillTags" in detail_html
                    )

                    detail_json = self.extract_detail_json(
                        detail_html
                    )

                    if detail_json:

                        detail_data = self.parse_detail_data(
                            detail_json
                        )

                        source_job_id = None
                        if job_url:
                            match = re.search(r"/([^/?]+)\.html?", job_url)
                            if match:
                                source_job_id = match.group(1)

                        raw_city = None
                        raw_area = None
                        raw_experience = None
                        raw_education = None

                        if len(info_list) >= 1:
                            raw_area = info_list[0]
                            raw_city = info_list[0].split("·")[0]
                        if len(info_list) >= 2:
                            raw_experience = info_list[1]
                        if len(info_list) >= 3:
                            raw_education = info_list[2]

                        raw_skills = []
                        skill_tags = detail_data.get("jobSkillTags", [])
                        if isinstance(skill_tags, list):
                            for item in skill_tags:
                                if isinstance(item, dict) and item.get("name"):
                                    raw_skills.append(item.get("name"))

                        job = JobRaw(
                            source="智联招聘",
                            source_job_id=source_job_id,
                            source_url=job_url,
                            raw_job_name=job_name,
                            raw_company_name=company,
                            raw_salary=salary,
                            raw_city=raw_city,
                            raw_area=raw_area,
                            raw_education=raw_education,
                            raw_experience=raw_experience,
                            raw_job_type=raw_job_type,
                            raw_description=detail_data.get("jobSummary"),
                            raw_company_info=raw_company_info,
                            publish_time=publish_time,
                            raw_skills=raw_skills,
                            crawl_time=datetime.now(),
                            create_time=datetime.now(),
                        )

                        jobs.append(job)

                        log_success("job_raw保存到内存列表")

                        log_info("====================")

                        log_info(
                            "岗位描述:"
                        )

                        log_info(
                            detail_data.get(
                                "jobSummary"
                            )
                        )

                        log_info("====================")

                        log_info(
                            "详情技能:"
                        )

                        log_info(
                            detail_data.get(
                                "jobSkillTags"
                            )
                        )

                    else:

                        log_warning(
                            "没有解析到详情数据"
                        )

                    if len(info_list) >= 3:

                        log_info(
                            "地点:",
                            info_list[0]
                        )

                        log_info(
                            "经验:",
                            info_list[1]
                        )

                        log_info(
                            "学历:",
                            info_list[2]
                        )

                    log_info(
                        "列表页技能:",
                        skills
                    )
                    log_info("====================")
                except TimeoutError as e:
                    log_error(
                        f"第{i + 1}个岗位采集失败"
                    )
                    log_error("错误原因:",e)
                except Exception as e:
                    error_name = e.__class__.__name__
                    if error_name in ["TargetClosedError", "Error"] and "closed" in str(e).lower():
                        log_warning("页面已关闭，正在恢复列表页")
                        page = recover_page()
                    else:
                        log_error(
                            f"第{i + 1}个岗位采集失败"
                        )
                        log_error("错误原因:",e)
                finally:
                    if detail_page is not None and not is_page_closed(detail_page):
                        try:
                            detail_page.close()
                        except Exception:
                            pass
                    perform_random_behavior(page)
            return jobs


def login_zhilian():
    """打开浏览器让用户登录智联招聘，保存登录态后退出。"""
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(Path(__file__).resolve().parent.parent.parent / "browser_data" / "zhilian"),
            headless=False,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.new_page()
        page.goto("https://www.zhaopin.com", timeout=60000, wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        print("请在浏览器中登录智联招聘账号")
        print("登录后的登录态会自动保存到 browser_data/zhilian/ 目录")
        input("登录完成后按 Enter 保存登录状态并关闭浏览器...")
        context.close()


if __name__ == "__main__":

    if len(sys.argv) > 1 and sys.argv[1] == "login":
        login_zhilian()
    else:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(Path(__file__).resolve().parent.parent.parent / "browser_data" / "zhilian"),
                headless=False,
                args=[
                    "--window-position=-2000,-2000",
                ]
            )
            for keyword in KEYWORDS:
                log_info("开始采集:", keyword)
                collector = ZhilianCollector(
                    keyword=keyword,
                    max_jobs=MAX_JOBS_PER_KEYWORD
                )
                collector.start(context)
            context.close()