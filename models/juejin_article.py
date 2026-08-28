from datetime import datetime


class JuejinArticle:

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
        tags_str = ", ".join(self.tags) if self.tags else ""
        return (
            f"\nJuejin Article:\n"
            f"\nsource:\n{self.source}\n"
            f"\nsource_article_id:\n{self.source_article_id}\n"
            f"\ntitle:\n{self.title}\n"
            f"\nauthor:\n{self.author}\n"
            f"\ntags:\n{tags_str}\n"
            f"\npublish_time:\n{self.publish_time}\n"
            f"\nread_count:\n{self.read_count}\n"
            f"\nlike_count:\n{self.like_count}\n"
            f"\nfavorite_count:\n{self.favorite_count}\n"
            f"\ncomment_count:\n{self.comment_count}\n"
            f"\nsource_url:\n{self.source_url}\n"
        )
