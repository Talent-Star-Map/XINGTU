import builtins
import logging
import os
import random
import re
import sys
import threading
import time
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pymysql
from playwright.sync_api import sync_playwright

try:
    from playwright_stealth import Stealth
    _STEALTH = Stealth()
except Exception:  # noqa: BLE001
    _STEALTH = None

from database.mysql import get_connection

BASE_DIR = Path(__file__).resolve().parent.parent

from collectors.zhilian.collector import ZhilianCollector
from collectors.github.collector import main as github_collect
from dao.job_info_dao import JobInfoDAO
from dao.job_raw_dao import JobRawDAO
from pipeline.job_pipeline import JobPipeline
from sync.job_sync import sync_jobs

log_dir = BASE_DIR / "logs"
log_dir.mkdir(exist_ok=True)
logging.basicConfig(
    filename=log_dir / "job_collection.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    encoding="utf-8",
)
job_logger = logging.getLogger("unified.job")
article_logger = logging.getLogger("unified.article")


# 每天两次调度:14:30 和 23:10
TARGET_SCHEDULES = [(14, 30, 0), (23, 10, 0)]
_stop_event = threading.Event()

_saved_stdout = None
_saved_stderr = None
_saved_stdout_buffer = None
_saved_stderr_buffer = None


def _save_streams():
    global _saved_stdout, _saved_stderr, _saved_stdout_buffer, _saved_stderr_buffer
    _saved_stdout = sys.stdout
    _saved_stderr = sys.stderr
    _saved_stdout_buffer = sys.stdout.buffer
    _saved_stderr_buffer = sys.stderr.buffer


def _restore_streams():
    global _saved_stdout, _saved_stderr, _saved_stdout_buffer, _saved_stderr_buffer
    sys.stdout = _saved_stdout
    sys.stderr = _saved_stderr
    _saved_stdout = None
    _saved_stderr = None
    _saved_stdout_buffer = None
    _saved_stderr_buffer = None


def _next_run_time(now=None):
    """从 TARGET_SCHEDULES 中找出下一个最近的时刻(支持一天多次)。"""
    now = now or datetime.now()
    candidates = []
    for h, m, s in TARGET_SCHEDULES:
        run_time = now.replace(hour=h, minute=m, second=s, microsecond=0)
        if run_time > now:
            candidates.append(run_time)
    if candidates:
        return min(candidates)
    # 当天全部已过,顺延到第二天最早一次
    first_h, first_m, first_s = TARGET_SCHEDULES[0]
    next_day = (now + timedelta(days=1)).replace(
        hour=first_h, minute=first_m, second=first_s, microsecond=0
    )
    return next_day


def _schedule_next_run():
    if _stop_event.is_set():
        return

    now = datetime.now()
    run_time = _next_run_time(now)
    delay = max((run_time - now).total_seconds(), 0)

    timer = threading.Timer(delay, _run_task)
    timer.daemon = True
    timer.start()


JOBS_KEYWORDS = [
    "Java",
    "Python",
    "Go",
    "C++",
    "前端",
    "Vue",
    "React",
    "人工智能",
    "测试工程师",
    "大数据",
]

JOBS_USER_DATA_DIR = str(BASE_DIR / "browser_data" / "zhilian")

_UA_POOL = [
    # Chrome 130+ Windows(2024-2025 主流)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    # Chrome macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    # Edge
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
]


class _PatchedInput:
    def __init__(self, return_value=""):
        self.original_input = builtins.input
        self.return_value = return_value

    def __enter__(self):
        builtins.input = lambda prompt="": self.return_value
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        builtins.input = self.original_input
        return False


def patched_input(return_value=""):
    return _PatchedInput(return_value)


def _run_job_collection():
    job_logger.info("开始执行智联岗位采集")
    pipeline = JobPipeline()
    dao = JobInfoDAO()
    raw_dao = JobRawDAO()

    # 关键词少一些,跑得稳;最大 max_jobs 提到 8
    raw_jobs = []
    with sync_playwright() as playwright:
        for kw_idx, keyword in enumerate(JOBS_KEYWORDS):
            ua = random.choice(_UA_POOL)
            user_data_dir = f"{JOBS_USER_DATA_DIR}_{kw_idx}"
            os.makedirs(user_data_dir, exist_ok=True)
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=user_data_dir,
                headless=True,
                user_agent=ua,
                viewport={"width": 1366, "height": 768},
                locale="zh-CN",
                timezone_id="Asia/Shanghai",
                args=[
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                ],
            )
            # playwright-stealth: 给每个 page 抹掉 webdriver / 自动化痕迹
            if _STEALTH is not None:
                try:
                    _STEALTH.apply_stealth_sync(context)
                except Exception as e:  # noqa: BLE001
                    job_logger.warning("注入 stealth 失败(%s),继续", e)
            try:
                collector = ZhilianCollector(
                    keyword=keyword,
                    max_jobs=8,
                )
                # 检测 Security Verification,被拦的关键词直接跳过,避免拖时间
                page = context.pages[0] if context.pages else context.new_page()
                try:
                    page.goto("https://www.zhaopin.com/", wait_until="domcontentloaded", timeout=30000)
                    time.sleep(random.uniform(2.5, 4.5))
                    if "Security Verification" in page.content():
                        job_logger.warning("[%s] 首页触发验证码,跳过本关键词", keyword)
                        continue
                except Exception as e:  # noqa: BLE001
                    job_logger.warning("[%s] 首页访问异常: %s", keyword, e)

                got = collector.start(context)
                # 过滤掉被 Security Verification 挡掉的(详情页还是验证码)
                got = [j for j in got if j and "Security Verification" not in str(getattr(j, "raw_description", ""))]
                raw_jobs.extend(got)
                job_logger.info("[%s] 采集 %d 条", keyword, len(got))
                # 关键词间隔,避免频次风控
                time.sleep(random.uniform(6, 12))
            finally:
                try:
                    context.close()
                except Exception:  # noqa: BLE001
                    pass

    job_logger.info("采集数量: %s", len(raw_jobs))

    raw_success_count = 0
    for raw_job in raw_jobs:
        if raw_dao.insert_job_raw(raw_job):
            raw_success_count += 1
    job_logger.info("原始入库数量: %s", raw_success_count)

    job_infos = pipeline.process(raw_jobs)
    job_logger.info("清洗数量: %s", len(job_infos))

    success_count = 0
    for job in job_infos:
        if dao.insert_job_info(job):
            success_count += 1
    job_logger.info("成功入库数量: %s", success_count)

    print(f"采集数量: {len(raw_jobs)}")
    print(f"原始入库数量: {raw_success_count}")
    print(f"清洗数量: {len(job_infos)}")
    print(f"成功入库数量: {success_count}")


def _run_step(step_name, fn, log_file, is_once=False):
    """执行单个采集/清洗步骤，捕获异常避免中断整轮任务。"""
    saved_stdout = sys.stdout
    saved_stderr = sys.stderr
    print(f"[{step_name}] 开始")
    try:
        with patched_input():
            if is_once and log_file:
                sys.stdout = log_file
                sys.stderr = log_file
            else:
                sys.stdout = open(os.devnull, "w", encoding="utf-8")
                sys.stderr = open(os.devnull, "w", encoding="utf-8")
            fn()
    except Exception as e:
        sys.stdout = saved_stdout
        sys.stderr = saved_stderr
        print(f"[{step_name}] 失败: {e}")
        traceback.print_exc()
        return False
    sys.stdout = saved_stdout
    sys.stderr = saved_stderr
    print(f"[{step_name}] 完成")
    return True


def _run_task(is_once=False):
    start_time = datetime.now()
    print("开始执行每日采集任务（智联 JD → 同步云库 xingtu.jobs）")

    log_file = None
    try:
        if is_once:
            log_path = log_dir / f"once_{start_time:%Y%m%d_%H%M%S}.log"
            log_file = open(log_path, "w", encoding="utf-8")
            print(f"日志文件: {log_path}", file=sys.stderr)
        else:
            log_file = None

        # === 任务清单 ===
        # 智联 + 同步:在 scheduler 内跑
        # GitHub:独立 cron 跑(跟 scheduler 解耦,避免互相阻塞)
        _run_step("智联采集", _run_job_collection, log_file, is_once)
        _run_step("岗位同步到云服务器", sync_jobs, log_file, is_once)
    except Exception as e:
        print("每日采集任务失败")
        print(e)
        traceback.print_exc()
    else:
        print("每日采集任务完成")
    finally:
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        record_path = log_dir / "run_records.log"
        with open(record_path, "a", encoding="utf-8") as f:
            f.write(f"[{start_time:%Y-%m-%d %H:%M:%S}] 开始 | "
                    f"[{end_time:%Y-%m-%d %H:%M:%S}] 结束 | "
                    f"耗时: {duration:.0f}秒\n")
        if log_file:
            log_file.close()
        if not is_once:
            _schedule_next_run()


def _run_github_collection():
    """GitHub 异构数据采集:trending repos + discussions → MongoDB xingtu_raw。"""
    job_logger.info("开始执行 GitHub 异构数据采集")
    print("开始执行 GitHub 异构数据采集(GitHub API → MongoDB)")

    saved_stdout = sys.stdout
    saved_stderr = sys.stderr
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
    sys.stderr = open(os.devnull, "w", encoding="utf-8")
    try:
        github_collect()
        print("GitHub 异构数据采集完成")
    except Exception as e:
        sys.stdout = saved_stdout
        sys.stderr = saved_stderr
        print(f"GitHub 异构数据采集失败: {e}")
        traceback.print_exc()
        job_logger.error("GitHub 异构数据采集失败: %s", e)
        return False
    finally:
        sys.stdout = saved_stdout
        sys.stderr = saved_stderr
    job_logger.info("GitHub 异构数据采集完成")
    return True


def run_scheduler():
    next_run = _next_run_time()
    print("智联 JD 采集系统启动")
    print(f"今日两次调度: 14:30 与 23:10")
    print(f"下一次采集时间: {next_run:%Y-%m-%d %H:%M:%S}")

    _schedule_next_run()
    while not _stop_event.is_set():
        _stop_event.wait(timeout=1)


if __name__ == "__main__":
    run_scheduler()
