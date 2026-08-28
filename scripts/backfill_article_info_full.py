"""一次性恢复脚本：article_raw 全量回填到 article_info。"""

import pymysql
from database.mysql import get_connection
from cleaners.article_cleaner import clean_article_basic
from dao.article_info_dao import ArticleInfoDAO


def main():
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute("SELECT * FROM article_raw")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    dao = ArticleInfoDAO()
    ok = exists = err = 0
    for row in rows:
        data = clean_article_basic(row)
        result = dao.insert(data)
        if result is True:
            ok += 1
        elif result == "exists":
            exists += 1
        else:
            err += 1

    print(f"完成: 插入 {ok}, 跳过 {exists}, 异常 {err}")


if __name__ == "__main__":
    main()
