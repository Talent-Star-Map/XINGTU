"""岗位数据同步模块。

将本地 job_info 中未同步的记录同步到云服务器 jobs 表。
岗位数据的 data_type = 1，文章数据的 data_type = 2。
"""

import json
import os

import pymysql

from database.mysql import get_connection

SERVER_DB_HOST = os.environ.get("SERVER_DB_HOST", "180.76.227.159")
SERVER_DB_PORT = int(os.environ.get("SERVER_DB_PORT", "3308"))
SERVER_DB_NAME = os.environ.get("SERVER_DB_NAME", "xingtu")
SERVER_DB_USER = os.environ.get("SERVER_DB_USER", "root")
SERVER_DB_PASSWORD = os.environ.get("SERVER_DB_PASSWORD", "Xingtu123")


INSERT_COLUMNS = (
    "data_type",
    "source",
    "source_url",
    "title",
    "skill_tags",
    "technology_field",
    "author",
    "summary",
    "article_type",
    "content",
    "quality_score",
    "hot_score",
    "trend_score",
    "view_count",
    "like_count",
    "collect_count",
    "comment_count",
    "publish_time",
    "crawl_time",
    "update_time",
)


def get_server_connection():
    """连接云服务器 MySQL。"""
    return pymysql.connect(
        host=SERVER_DB_HOST,
        port=SERVER_DB_PORT,
        user=SERVER_DB_USER,
        password=SERVER_DB_PASSWORD,
        database=SERVER_DB_NAME,
        charset="utf8mb4",
    )


def get_unsynced_jobs():
    """查询 job_info 中 sync_status = 0 的记录，关联 job_raw 获取 source_url。"""
    connection = get_connection()
    cursor = connection.cursor(pymysql.cursors.DictCursor)
    try:
        sql = """
        SELECT
            j.id,
            j.raw_id,
            j.job_name,
            j.company_name,
            j.city,
            j.area,
            j.salary_min,
            j.salary_max,
            j.salary_months,
            j.education,
            j.experience,
            j.job_type,
            j.job_category,
            j.company_type,
            j.skills,
            j.job_description,
            j.publish_time,
            j.crawl_time,
            j.salary_unit,
            r.source_url
        FROM job_info j
        LEFT JOIN job_raw r ON j.raw_id = r.id
        WHERE j.sync_status = 0
        """
        cursor.execute(sql)
        return cursor.fetchall()
    finally:
        cursor.close()
        connection.close()


def check_job_exists(source_url):
    """检查云服务器 jobs 是否已存在该 source_url 的记录。"""
    if not source_url:
        return False
    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(
            "SELECT id FROM jobs WHERE source_url = %s LIMIT 1",
            (source_url,),
        )
        return cursor.fetchone() is not None
    finally:
        cursor.close()
        connection.close()


def job_to_dict(job):
    """将 job_info 记录映射为云服务器 jobs 表的字段。"""
    skills = job.get("skills")
    if isinstance(skills, str):
        try:
            skills = json.loads(skills)
        except (json.JSONDecodeError, TypeError):
            skills = []
    if not skills:
        skills = []

    description = job.get("job_description") or ""
    summary = description[:500] if description else ""

    return {
        "data_type": 1,
        "source": "智联招聘",
        "source_url": job.get("source_url") or "",
        "title": job.get("job_name") or "",
        "skill_tags": json.dumps(skills, ensure_ascii=False),
        "technology_field": job.get("job_category") or "",
        "author": job.get("company_name") or "",
        "summary": summary,
        "article_type": None,
        "content": description,
        "quality_score": None,
        "hot_score": None,
        "trend_score": None,
        "view_count": 0,
        "like_count": 0,
        "collect_count": 0,
        "comment_count": 0,
        "publish_time": job.get("publish_time"),
        "crawl_time": job.get("crawl_time"),
        "update_time": job.get("crawl_time"),
    }


def insert_job_to_cloud(job_dict):
    """将单条岗位数据插入云服务器 jobs 表。"""
    placeholders = ", ".join(["%s"] * len(INSERT_COLUMNS))
    sql = "INSERT INTO jobs ({columns}) VALUES ({placeholders})".format(
        columns=", ".join(INSERT_COLUMNS),
        placeholders=placeholders,
    )
    values = tuple(job_dict.get(col) for col in INSERT_COLUMNS)

    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(sql, values)
        connection.commit()
        return cursor.lastrowid
    except Exception as exc:
        connection.rollback()
        print("[ERROR] 岗位插入云服务器失败: %s" % exc)
        return None
    finally:
        cursor.close()
        connection.close()


def update_sync_status(job_ids):
    """将指定 job_info 记录的 sync_status 批量更新为 1。"""
    if not job_ids:
        return 0
    placeholders = ", ".join(["%s"] * len(job_ids))
    sql = "UPDATE job_info SET sync_status = 1 WHERE id IN ({})".format(placeholders)

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(sql, tuple(job_ids))
        connection.commit()
        return cursor.rowcount
    except Exception as exc:
        connection.rollback()
        print("[ERROR] 更新 job_info sync_status 失败: %s" % exc)
        return 0
    finally:
        cursor.close()
        connection.close()


def sync_jobs():
    """岗位数据同步入口。

    流程：
    1. 读取 job_info 中 sync_status = 0 的数据
    2. 通过 source_url 检查云服务器是否已存在
    3. 不存在则插入 jobs 表（data_type=1）
    4. 成功插入后更新 job_info.sync_status = 1
    """
    jobs = get_unsynced_jobs()
    print("待同步岗位数量: %d" % len(jobs))

    if not jobs:
        print("没有需要同步的岗位数据")
        return

    inserted_ids = []
    skipped = 0
    failed = 0

    for job in jobs:
        source_url = job.get("source_url")
        if check_job_exists(source_url):
            skipped += 1
            inserted_ids.append(job["id"])
            continue

        job_dict = job_to_dict(job)
        new_id = insert_job_to_cloud(job_dict)
        if new_id:
            inserted_ids.append(job["id"])
        else:
            failed += 1

    updated = update_sync_status(inserted_ids) if inserted_ids else 0

    print("岗位同步完成: 插入 %d 条, 跳过(已存在) %d 条, 失败 %d 条" % (
        len(inserted_ids) - skipped, skipped, failed
    ))
