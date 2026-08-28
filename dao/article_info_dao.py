"""Data access object for the ``article_info`` table."""

from database.mysql import get_connection


class ArticleInfoDAO:

    def exists(self, source, source_article_id):
        connection = get_connection()
        cursor = connection.cursor()
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM article_info WHERE source = %s AND source_article_id = %s",
                (source, source_article_id),
            )
            count = cursor.fetchone()[0]
            return count > 0
        finally:
            cursor.close()
            connection.close()

    def insert(self, data):
        if self.exists(data["source"], data["source_article_id"]):
            return "exists"

        connection = get_connection()
        cursor = connection.cursor()

        sql = """
        INSERT INTO article_info (
            data_type,
            source,
            source_article_id,
            source_url,
            title,
            author,
            content,
            content_length,
            technology_field,
            article_type,
            hot_score,
            quality_score,
            trend_score,
            publish_time,
            crawl_time,
            update_time,
            skill_tags,
            summary,
            view_count,
            like_count,
            collect_count,
            comment_count
        ) VALUES (
            %(data_type)s,
            %(source)s,
            %(source_article_id)s,
            %(source_url)s,
            %(title)s,
            %(author)s,
            %(content)s,
            %(content_length)s,
            %(technology_field)s,
            %(article_type)s,
            %(hot_score)s,
            %(quality_score)s,
            %(trend_score)s,
            %(publish_time)s,
            %(crawl_time)s,
            %(update_time)s,
            %(skill_tags)s,
            %(summary)s,
            %(view_count)s,
            %(like_count)s,
            %(collect_count)s,
            %(comment_count)s
        )
        """

        try:
            cursor.execute(sql, data)
            connection.commit()
            return True
        except Exception:
            connection.rollback()
            return False
        finally:
            cursor.close()
            connection.close()
