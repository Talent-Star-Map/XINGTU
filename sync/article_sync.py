"""文章数据增量同步模块。

第一阶段：读取本地 article_info 未同步数据（sync_status = 0）。
第二阶段：测试云服务器 MySQL 连接。
第三阶段：单条 article_info 数据插入云服务器 jobs 表测试。
第四阶段：正式批量增量同步逻辑。
"""

import os

import pymysql

from database.mysql import get_connection


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


SERVER_DB_HOST = os.environ.get("SERVER_DB_HOST", "180.76.227.159")
SERVER_DB_PORT = int(os.environ.get("SERVER_DB_PORT", "3308"))
SERVER_DB_NAME = os.environ.get("SERVER_DB_NAME", "xingtu")
SERVER_DB_USER = os.environ.get("SERVER_DB_USER","root")
SERVER_DB_PASSWORD = os.environ.get("SERVER_DB_PASSWORD","Xingtu123")


def get_server_connection():
    """连接云服务器 MySQL，返回 connection 对象。"""
    if not SERVER_DB_USER or not SERVER_DB_PASSWORD:
        raise ValueError(
            "缺少云服务器连接凭据，请设置环境变量 SERVER_DB_USER 和 SERVER_DB_PASSWORD"
        )
    return pymysql.connect(
        host=SERVER_DB_HOST,
        port=SERVER_DB_PORT,
        user=SERVER_DB_USER,
        password=SERVER_DB_PASSWORD,
        database=SERVER_DB_NAME,
        charset="utf8mb4",
    )


def test_server_connection():
    """测试云服务器连接，并查询 jobs 表当前数据量。"""
    print("开始测试云服务器连接...")
    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM jobs")
        count = cursor.fetchone()[0]
        print("云服务器 jobs 当前数据量:%d" % count)
        print("云服务器连接成功")
        return count
    finally:
        cursor.close()
        connection.close()


def insert_article_to_jobs(article):
    """将单条 article_info 数据映射字段后插入云服务器 jobs 表。

    article_info.id 不插入，jobs.id 为 AUTO_INCREMENT。
    成功返回新增 jobs id，失败打印异常并返回 None。
    """
    placeholders = ", ".join(["%s"] * len(INSERT_COLUMNS))
    sql = "INSERT INTO jobs ({columns}) VALUES ({placeholders})".format(
        columns=", ".join(INSERT_COLUMNS),
        placeholders=placeholders,
    )
    values = tuple(article.get(column) for column in INSERT_COLUMNS)

    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(sql, values)
        connection.commit()
        return cursor.lastrowid
    except Exception as exc:
        connection.rollback()
        print("插入云服务器 jobs 失败: %s" % exc)
        return None
    finally:
        cursor.close()
        connection.close()


CLOUD_MAX_RECORDS = 2000
CLEANUP_BATCH_SIZE = 300


def get_cloud_article_count():
    """查询云服务器 jobs 表当前数据量。"""
    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT COUNT(*) FROM jobs")
        return cursor.fetchone()[0]
    finally:
        cursor.close()
        connection.close()


def cleanup_cloud_articles():
    """清理云服务器低价值文章，为新数据腾出空间。

    触发条件：云服务器数据量 >= CLOUD_MAX_RECORDS（2000）时才执行清理。
    清理条件（评分卡机制，满足 2/3 即删除）：
        - trend_score < 45（时效性差）得 1 分
        - quality_score < 60（质量低）得 1 分
        - hot_score < 50（热度低）得 1 分
        - 总分 >= 2 的文章判定为低价值
        - 以上字段为 NULL 或 0 时不计分（保护非同类数据）
    删除顺序：按三个分数总和升序（总分最低的先删），最多删除 CLEANUP_BATCH_SIZE（300）条。

    返回：实际删除的条数。
    """
    count = get_cloud_article_count()
    print("云服务器当前数据量: %d" % count)

    if count < CLOUD_MAX_RECORDS:
        print("数据量未达到 %d，无需清理" % CLOUD_MAX_RECORDS)
        return 0

    print("数据量已达到 %d，开始清理低价值数据..." % CLOUD_MAX_RECORDS)

    score_calc = """
        (CASE WHEN trend_score IS NOT NULL AND trend_score != 0 AND trend_score < 45 THEN 1 ELSE 0 END)
      + (CASE WHEN quality_score IS NOT NULL AND quality_score != 0 AND quality_score < 60 THEN 1 ELSE 0 END)
      + (CASE WHEN hot_score IS NOT NULL AND hot_score != 0 AND hot_score < 50 THEN 1 ELSE 0 END)
    """

    connection = get_server_connection()
    cursor = connection.cursor()
    try:
        count_sql = "SELECT COUNT(*) FROM jobs WHERE (%s) >= 2" % score_calc
        cursor.execute(count_sql)
        deletable_count = cursor.fetchone()[0]
        print("符合清理条件的数据量: %d" % deletable_count)

        if deletable_count == 0:
            print("没有符合条件的低价值数据需要清理")
            return 0

        actual_delete = min(deletable_count, CLEANUP_BATCH_SIZE)
        print("本次将清理: %d 条" % actual_delete)

        delete_sql = """
        DELETE FROM jobs
        WHERE (%s) >= 2
        ORDER BY (COALESCE(trend_score,0) + COALESCE(quality_score,0) + COALESCE(hot_score,0)) ASC
        LIMIT %%s
        """ % score_calc
        cursor.execute(delete_sql, (actual_delete,))
        connection.commit()
        deleted = cursor.rowcount
        print("成功清理 %d 条低价值数据" % deleted)
        return deleted
    except Exception as exc:
        connection.rollback()
        print("清理云服务器数据失败: %s" % exc)
        return 0
    finally:
        cursor.close()
        connection.close()


def check_article_exists(source_url):
    """检查云服务器 jobs 是否已存在该 source_url 的文章，存在返回 True。"""
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


def insert_articles_to_jobs(articles):
    """批量插入文章到云服务器 jobs 表。

    循环调用 insert_article_to_jobs 逐条插入（复用已有单条逻辑），
    单条失败不影响其他数据，异常由单条逻辑 rollback。

    返回 (成功插入文章列表, 失败文章列表)。
    """
    inserted = []
    failed = []
    for article in articles:
        new_id = insert_article_to_jobs(article)
        if new_id:
            inserted.append(article)
        else:
            failed.append(article)
    return inserted, failed


def update_sync_status(article_ids):
    """将指定 article_info 记录的 sync_status 批量更新为 1。"""
    if not article_ids:
        return 0
    placeholders = ", ".join(["%s"] * len(article_ids))
    sql = "UPDATE article_info SET sync_status = 1 WHERE id IN ({})".format(placeholders)

    connection = get_connection()
    cursor = connection.cursor()
    try:
        cursor.execute(sql, tuple(article_ids))
        connection.commit()
        return cursor.rowcount
    except Exception as exc:
        connection.rollback()
        print("更新 sync_status 失败: %s" % exc)
        return 0
    finally:
        cursor.close()
        connection.close()


def sync_articles():
    """正式批量同步入口。

    流程：
    1. 检查云服务器数据量，必要时清理低价值文章
    2. 读取 article_info 中 sync_status = 0 的数据
    3. 逐条检查 jobs 是否已存在（source_url）
    4. 不存在则插入 jobs，存在则跳过
    5. 仅对成功插入的数据更新 article_info.sync_status = 1
    6. 输出同步结果

    说明：jobs 在云服务器、article_info 在本地 MySQL，
    两侧各自使用独立事务。插入与状态更新之间即使出现异常，
    下次运行也会通过 source_url 去重实现幂等修复。
    """
    cleanup_cloud_articles()

    articles = get_unsynced_articles()
    print("待同步文章数量: %d" % len(articles))

    if not articles:
        print("没有需要同步的数据")
        return

    to_insert = []
    skipped = 0
    for article in articles:
        if check_article_exists(article.get("source_url")):
            skipped += 1
        else:
            to_insert.append(article)

    inserted, failed = insert_articles_to_jobs(to_insert)

    inserted_ids = [article["id"] for article in inserted]
    updated = update_sync_status(inserted_ids) if inserted_ids else 0

    print("已同步 %d 条数据" % len(inserted))


def get_unsynced_articles():
    """查询 article_info 中 sync_status = 0 的文章，返回 list[dict]。"""
    connection = get_connection()
    cursor = connection.cursor(pymysql.cursors.DictCursor)
    try:
        sql = """
        SELECT
            id,
            data_type,
            source,
            source_url,
            title,
            skill_tags,
            technology_field,
            author,
            summary,
            article_type,
            content,
            content_length,
            quality_score,
            hot_score,
            trend_score,
            view_count,
            like_count,
            collect_count,
            comment_count,
            publish_time,
            crawl_time,
            update_time
        FROM article_info
        WHERE sync_status = 0
        """
        cursor.execute(sql)
        return cursor.fetchall()
    finally:
        cursor.close()
        connection.close()


def main():
    print("开始读取未同步文章数据...")

    articles = get_unsynced_articles()

    print("未同步文章数量: %d" % len(articles))

    print()

    test_server_connection()

    print()

    sync_articles()


if __name__ == "__main__":
    main()
