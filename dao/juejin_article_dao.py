import json
from database.mysql import get_connection


class JuejinArticleDAO:

    def exists(self, source_article_id):
        connection = get_connection()
        cursor = connection.cursor()
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM article_raw WHERE source_article_id = %s",
                (source_article_id,)
            )
            count = cursor.fetchone()[0]
            return count > 0
        finally:
            cursor.close()
            connection.close()

    def insert(self, article):
        connection = get_connection()
        cursor = connection.cursor()

        sql = """
        INSERT INTO article_raw (
            source,
            source_article_id,
            title,
            author,
            tags,
            publish_time,
            read_count,
            like_count,
            favorite_count,
            comment_count,
            source_url,
            content,
            crawl_time
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
        )
        """

        tags = None
        if article.tags is not None:
            tags = json.dumps(article.tags, ensure_ascii=False)

        params = (
            article.source,
            article.source_article_id,
            article.title,
            article.author,
            tags,
            article.publish_time,
            article.read_count,
            article.like_count,
            article.favorite_count,
            article.comment_count,
            article.source_url,
            article.content,
            article.crawl_time,
        )

        try:
            cursor.execute(sql, params)
            connection.commit()
            return True
        except Exception:
            connection.rollback()
            return False
        finally:
            cursor.close()
            connection.close()
