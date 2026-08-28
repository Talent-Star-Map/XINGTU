"""Phase 5 test: basic fields + content cleaning + technology_field + article_type."""

import json
import pymysql
from database.mysql import get_connection
from cleaners.article_cleaner import (
    clean_article_basic,
    get_technology_field,
    get_article_type,
    calc_hot_score,
    calculate_quality_score,
    calculate_trend_score,
    generate_summary,
)
from cleaners.github_repository_cleaner import clean_github_full
from dao.article_info_dao import ArticleInfoDAO
from utils.content_cleaner import clean_content
from utils.skill_tags_cleaner import clean_skill_tags


def main():
    conn = get_connection()
    cursor = conn.cursor(pymysql.cursors.DictCursor)
    cursor.execute("""
        SELECT r.* FROM article_raw r
        WHERE NOT EXISTS (
            SELECT 1 FROM article_info i
            WHERE i.source = r.source AND i.source_article_id = r.source_article_id
        )
        LIMIT 100
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    dao = ArticleInfoDAO()
    ok = exists = err = 0

    for row in rows:
        if row.get("source") == "GitHub":
            update_time = row.get("update_time")
            data = clean_github_full(row, update_time)

            if data.get("quality_score", 0) < 45:
                continue

            if not data.get("summary"):
                continue

            result = dao.insert(data)
            if result is True:
                ok += 1
            elif result == "exists":
                exists += 1
            else:
                err += 1

            continue

        title = row.get("title") or ""
        raw_tags = row.get("tags")
        if raw_tags and not isinstance(raw_tags, list):
            try:
                raw_tags = json.loads(raw_tags)
            except (json.JSONDecodeError, TypeError):
                raw_tags = []
        cleaned = clean_content(row.get("content") or "")
        content_length = len(cleaned)

        if content_length < 100:
            continue

        article_input = {"title": title, "tags": raw_tags, "content": cleaned}
        tech_field = get_technology_field(article_input)
        article_input["technology_field"] = tech_field
        art_type = get_article_type(article_input)

        read_count = row.get("read_count") or 0
        like_count = row.get("like_count") or 0
        fav_count = row.get("favorite_count") or 0
        comment_count = row.get("comment_count") or 0
        hot_score = calc_hot_score(read_count, like_count, fav_count, comment_count)

        data = clean_article_basic(row)
        data["content"] = cleaned
        data["content_length"] = content_length
        data["technology_field"] = tech_field
        data["article_type"] = art_type
        data["hot_score"] = hot_score
        data["skill_tags"] = json.dumps(
            clean_skill_tags(raw_tags, title=title), ensure_ascii=False
        )

        quality_input = {
            "title": title,
            "tags": raw_tags,
            "content": cleaned,
            "content_length": content_length,
            "article_type": art_type,
        }
        quality_score = calculate_quality_score(quality_input)

        if quality_score < 45:
            continue

        data["quality_score"] = quality_score

        publish_time = row.get("publish_time")
        trend_input = {
            "publish_time": publish_time,
            "hot_score": hot_score,
            "technology_field": tech_field,
            "title": title,
            "tags": raw_tags,
            "content": cleaned,
        }
        trend_score = calculate_trend_score(trend_input)
        data["trend_score"] = trend_score

        summary = generate_summary(cleaned)
        if not summary:
            continue
        data["summary"] = summary

        result = dao.insert(data)
        if result is True:
            ok += 1
        elif result == "exists":
            exists += 1
        else:
            err += 1

    if ok > 0 or exists > 0 or err > 0:
        print(f"成功清洗{ok}条数据")


if __name__ == "__main__":
    main()
