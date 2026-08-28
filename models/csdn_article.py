"""
CSDN Article Model

Used for storing raw collected article data.
"""

from datetime import datetime


class CsdnArticle:

    def __init__(
        self,
        source,
        source_article_id,
        title,
        author,
        tags,
        publish_time,
        read_count,
        like_count,
        favorite_count,
        source_url,
        content,
        crawl_time,
        comment_count=0,
    ):
        self.source = source
        self.source_article_id = source_article_id
        self.title = title
        self.author = author
        self.tags = tags
        self.publish_time = publish_time
        self.read_count = read_count
        self.like_count = like_count
        self.favorite_count = favorite_count
        self.comment_count = comment_count
        self.source_url = source_url
        self.content = content
        self.crawl_time = crawl_time

    def __str__(self):
        return f"""
CSDN Article:

source:
{self.source}

source_article_id:
{self.source_article_id}

title:
{self.title}

author:
{self.author}

tags:
{self.tags}

publish_time:
{self.publish_time}

read_count:
{self.read_count}

like_count:
{self.like_count}

favorite_count:
{self.favorite_count}

comment_count:
{self.comment_count}

source_url:
{self.source_url}
"""
