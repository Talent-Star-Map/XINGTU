"""
GitHub update_time 补采脚本

功能：
1. 从 article_raw 获取已经采集的 GitHub 仓库
2. 根据 source_url 重新访问 GitHub 仓库
3. 获取当前 GitHub 最新 commit 的时间
4. 只更新 article_raw.update_time
5. 不修改其他任何字段

运行：
python test/update_github_update_time.py
"""

from playwright.sync_api import sync_playwright
from datetime import datetime, timezone, timedelta

import time

from database.mysql import get_connection


USER_DATA_DIR = "./browser_data/github"

# 每处理多少个仓库后休息
BATCH_LIMIT = 30
BATCH_REST_MIN = 20
BATCH_REST_MAX = 40


def get_github_repositories():
    """
    获取数据库中已经存在的 GitHub 仓库。

    只获取：
    id
    source_url

    不读取、不修改其他字段。
    """
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        sql = """
        SELECT id, source_url
        FROM article_raw
        WHERE source = 'GitHub'
          AND source_url IS NOT NULL
          AND source_url != ''
          AND update_time IS NULL
        ORDER BY id
        """

        cursor.execute(sql)

        return cursor.fetchall()

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


def update_repository_update_time(record_id, update_time):
    """
    只更新 article_raw.update_time。

    不修改其他字段。
    """
    connection = None
    cursor = None

    try:
        connection = get_connection()
        cursor = connection.cursor()

        sql = """
        UPDATE article_raw
        SET update_time = %s
        WHERE id = %s
        """

        cursor.execute(
            sql,
            (
                update_time,
                record_id
            )
        )

        connection.commit()

    finally:
        if cursor:
            cursor.close()

        if connection:
            connection.close()


def get_update_time(page, url):
    """
    打开 GitHub 仓库页面，获取最新 commit 时间。

    返回：
    GitHub relative-time 的 datetime 属性。

    例如：
    2026-08-25T10:30:00Z
    """

    try:
        page.goto(
            url,
            wait_until="commit",
            timeout=60000
        )

        page.wait_for_timeout(3000)

        update_element = page.locator(
            "[data-testid='latest-commit'] relative-time"
        ).first

        if update_element.count() > 0:
            update_time = update_element.get_attribute(
                "datetime"
            )

            if update_time:
                return update_time

    except Exception as e:
        print(f"获取 update_time 失败: {e}")

    return None

def normalize_update_time(update_time):
    if not update_time:
        return None

    try:
        dt = datetime.fromisoformat(
            update_time.replace("Z", "+00:00")
        )

        beijing_time = dt.astimezone(
            timezone(timedelta(hours=8))
        )

        return beijing_time.strftime(
            "%Y-%m-%d %H:%M:%S"
        )

    except Exception:
        return None


def main():

    print("=" * 60)
    print("GitHub update_time 补采程序")
    print("=" * 60)

    repositories = get_github_repositories()

    print(
        f"数据库中发现 {len(repositories)} 条 GitHub 仓库数据"
    )

    if not repositories:
        print("没有找到 GitHub 数据")
        return

    success_count = 0
    failed_count = 0

    with sync_playwright() as p:

        context = None

        try:

            context = p.chromium.launch_persistent_context(
                user_data_dir=USER_DATA_DIR,
                headless=False,
                viewport={
                    "width": 1280,
                    "height": 900
                },
                args=[
                    "--disable-blink-features=AutomationControlled"
                ]
            )

            page = context.new_page()

            print()
            print("开始获取 GitHub update_time...")
            print()

            for index, (record_id, url) in enumerate(
                repositories,
                start=1
            ):

                print(
                    f"[{index}/{len(repositories)}] "
                    f"正在处理: {url}"
                )

                update_time = get_update_time(
                    page,
                    url
                )

                if update_time:

                    normalized_update_time = normalize_update_time(update_time)
                    if normalized_update_time:
                        update_repository_update_time(
                            record_id,
                            normalized_update_time
                        )

                    success_count += 1

                    print(
                        f"  ✓ update_time: {update_time}"
                    )

                else:

                    failed_count += 1

                    print(
                        "  ✗ 未获取到 update_time"
                    )

                # 批次休息
                if (
                    index % BATCH_LIMIT == 0
                    and index < len(repositories)
                ):

                    import random

                    rest_time = random.randint(
                        BATCH_REST_MIN,
                        BATCH_REST_MAX
                    )

                    print()
                    print(
                        f"[BATCH] 已处理 {index} 个仓库，"
                        f"休息 {rest_time} 秒"
                    )
                    print()

                    time.sleep(rest_time)

        except KeyboardInterrupt:

            print()
            print("已收到 Ctrl+C")
            print("程序中断")

        finally:

            if context:

                try:
                    context.close()
                except Exception:
                    pass

    print()
    print("=" * 60)
    print("update_time 补采完成")
    print("=" * 60)
    print(f"总数据: {len(repositories)}")
    print(f"成功更新: {success_count}")
    print(f"获取失败: {failed_count}")
    print("=" * 60)


if __name__ == "__main__":
    main()