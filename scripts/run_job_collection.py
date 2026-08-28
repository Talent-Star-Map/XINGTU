"""Run a full job collection workflow."""

import logging
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)
LOG_FILE = LOG_DIR / "job_collection.log"

logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    encoding="utf-8",
)
logger = logging.getLogger(__name__)

from collectors.zhilian.collector import ZhilianCollector
from dao.job_info_dao import JobInfoDAO
from dao.job_raw_dao import JobRawDAO
from pipeline.job_pipeline import JobPipeline


def main() -> None:
    """Run collect -> clean -> store workflow."""
    logger.info("开始执行岗位采集")
    keywords = [
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
    pipeline = JobPipeline()
    dao = JobInfoDAO()
    raw_dao = JobRawDAO()

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(BASE_DIR / "browser_data" / "zhilian"),
            headless=False,
            args=[
                "--window-position=-2000,-2000",
            ],
        )
        try:
            raw_jobs = []
            for keyword in keywords:
                collector = ZhilianCollector(
                    keyword=keyword,
                    max_jobs=5,
                )
                raw_jobs.extend(collector.start(context))
        finally:
            context.close()

    logger.info("采集数量: %s", len(raw_jobs))

    raw_success_count = 0
    for raw_job in raw_jobs:
        if raw_dao.insert_job_raw(raw_job):
            raw_success_count += 1

    logger.info("原始入库数量: %s", raw_success_count)

    job_infos = pipeline.process(raw_jobs)
    logger.info("清洗数量: %s", len(job_infos))

    success_count = 0
    for job in job_infos:
        if dao.insert_job_info(job):
            success_count += 1

    logger.info("成功入库数量: %s", success_count)

    print(f"采集数量: {len(raw_jobs)}")
    print(f"原始入库数量: {raw_success_count}")
    print(f"清洗数量: {len(job_infos)}")
    print(f"成功入库数量: {success_count}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("岗位采集任务异常")
        raise
