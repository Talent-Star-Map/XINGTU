import builtins
import logging
import os
import sys
import threading
import traceback
from datetime import datetime, timedelta
from pathlib import Path

import pymysql
from playwright.sync_api import sync_playwright

from database.mysql import get_connection

BASE_DIR = Path(__file__).resolve().parent.parent

from collectors.csdn.collector import collect_csdn
from collectors.juejin.collector import collect_juejin
from collectors.github.collector import collect_github
from collectors.zhilian.collector import ZhilianCollector
from cleaners.article_cleaner import clean_article_full
from dao.article_info_dao import ArticleInfoDAO
from dao.job_info_dao import JobInfoDAO
from dao.job_raw_dao import JobRawDAO
from pipeline.job_pipeline import JobPipeline
from sync.article_sync import sync_articles

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


TARGET_HOUR = 23
TARGET_MINUTE = 10
TARGET_SECOND = 0
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
    now = now or datetime.now()
    run_time = now.replace(
        hour=TARGET_HOUR,
        minute=TARGET_MINUTE,
        second=TARGET_SECOND,
        microsecond=0,
    )
    if run_time <= now:
        run_time += timedelta(days=1)
    return run_time


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

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=JOBS_USER_DATA_DIR,
            headless=False,
            args=[
                "--window-position=-2000,-2000",
            ],
        )
        try:
            raw_jobs = []
            for keyword in JOBS_KEYWORDS:
                collector = ZhilianCollector(
                    keyword=keyword,
                    max_jobs=5,
                )
                raw_jobs.extend(collector.start(context))
        finally:
            context.close()

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


def _fetch_unsynced_article_raw():
    """读取尚未进入 article_info 的 article_raw 记录。"""
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    try:
        cursor.execute(
            """
            SELECT r.*
            FROM article_raw r
            WHERE NOT EXISTS (
                SELECT 1
                FROM article_info i
                WHERE i.source = r.source
                  AND i.source_article_id = r.source_article_id
            )
            ORDER BY r.crawl_time ASC, r.id ASC
            """
        )
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


def _run_article_cleaning():
    """将 article_raw 中尚未入库的记录清洗后写入 article_info。"""
    rows = _fetch_unsynced_article_raw()
    article_logger.info("待清洗文章数量: %s", len(rows))

    dao = ArticleInfoDAO()
    inserted_count = 0
    filtered_count = 0
    for row in rows:
        cleaned = clean_article_full(row)
        if cleaned is None:
            filtered_count += 1
            continue
        result = dao.insert(cleaned)
        if result is True:
            inserted_count += 1
        elif result == "exists":
            continue
        else:
            filtered_count += 1

    article_logger.info("清洗入库数量: %s", inserted_count)
    print(f"文章清洗数量: {inserted_count}")
    print(f"文章过滤数量: {filtered_count}")
    return inserted_count


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
    print("开始执行每日采集任务（CSDN → 掘金 → GitHub）")

    log_file = None
    try:
        if is_once:
            log_path = log_dir / f"once_{start_time:%Y%m%d_%H%M%S}.log"
            log_file = open(log_path, "w", encoding="utf-8")
            print(f"日志文件: {log_path}", file=sys.stderr)
        else:
            log_file = None

    #    _run_step("智联采集", _run_job_collection, log_file, is_once)

        _run_step("CSDN采集", collect_csdn, log_file, is_once)
        _run_step("文章清洗入库", _run_article_cleaning, log_file, is_once)

        _run_step("掘金采集", collect_juejin, log_file, is_once)
        _run_step("文章清洗入库", _run_article_cleaning, log_file, is_once)

        _run_step("GitHub采集", collect_github, log_file, is_once)
        _run_step("文章清洗入库", _run_article_cleaning, log_file, is_once)

        _run_step("同步到云服务器", sync_articles, log_file, is_once)
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


def run_scheduler():
    next_run = _next_run_time()
    print("文章采集系统启动")
    print(f"下一次采集时间: {next_run:%Y-%m-%d %H:%M:%S}")

    _schedule_next_run()
    while not _stop_event.is_set():
        _stop_event.wait(timeout=1)


if __name__ == "__main__":
    run_scheduler()
