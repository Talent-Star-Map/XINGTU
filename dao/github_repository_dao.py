"""Data access object for the ``article_raw`` table (GitHub repositories)."""

from database.mysql import get_connection


class GitHubRepositoryDAO:

    def load_collected_ids(self):
        """从数据库加载已采集的GitHub仓库 owner/repo ID"""
        connection = None
        cursor = None
        try:
            connection = get_connection()
            cursor = connection.cursor()
            sql = "SELECT source_url FROM article_raw WHERE source = 'GitHub'"
            cursor.execute(sql)
            rows = cursor.fetchall()
            ids = set()
            for (url,) in rows:
                if not url:
                    continue
                parts = url.replace("https://github.com/", "").strip("/").split("/")
                if len(parts) >= 2:
                    ids.add(f"{parts[0]}/{parts[1]}")
            return ids
        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()

    def insert(self, repo):
        connection = None
        cursor = None

        try:
            connection = get_connection()
            cursor = connection.cursor()

            check_sql = """
            SELECT id FROM article_raw
            WHERE source = %s 
            AND source_article_id = %s
            LIMIT 1
            """

            cursor.execute(check_sql,(repo.source,repo.source_article_id))
            exists = cursor.fetchone()
            if exists:
                return False
            insert_sql = """
            INSERT INTO article_raw (
                source,
                source_article_id,
                title,
                author,
                tags,
                language,
                publish_time,
                update_time,
                read_count,
                like_count,
                favorite_count,
                comment_count,
                source_url,
                summary,
                content,
                crawl_time
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            """

            tags = None
            if repo.tags is not None:
                import json
                tags = json.dumps(repo.tags, ensure_ascii=False)

            params = (
                repo.source,
                repo.source_article_id,
                repo.title,
                repo.author,
                tags,
                repo.language,
                repo.publish_time,
                repo.update_time,
                repo.read_count,
                repo.like_count,
                repo.favorite_count,
                repo.comment_count,
                repo.source_url,
                repo.summary,
                repo.content,
                repo.crawl_time
            )
            cursor.execute(insert_sql,params)
            connection.commit()
            return True

        finally:
            if cursor:
                cursor.close()
            if connection:
                connection.close()