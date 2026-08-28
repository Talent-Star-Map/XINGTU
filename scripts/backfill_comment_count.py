"""
一次性回填脚本：遍历 article_raw 中 comment_count = 0 的行，用 requests 拉取详情页，
调用 extract_comment_count 提取评论数并 UPDATE。
"""

import sys
import time
import random

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from database.mysql import get_connection

from collectors.csdn.collector import extract_comment_count

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Referer": "https://blog.csdn.net/",
}


def fetch_with_playwright(url: str):
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto(url, timeout=30000, wait_until="domcontentloaded")
            time.sleep(random.uniform(3, 5))
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        print(f"Playwright获取失败: {e}")
        return None


def main():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT source_url, source_article_id FROM article_raw WHERE comment_count = 0"
    )
    rows = cursor.fetchall()
    cursor.close()
    print(f"共 {len(rows)} 条待回填")

    ok = fail = 0
    for url, aid in rows:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 521:
                print(f"WAF拦截 {aid}，改用Playwright")
                html = fetch_with_playwright(url)
                if html is None:
                    fail += 1
                    continue
                soup = BeautifulSoup(html, "html.parser")
                cc = extract_comment_count(html, soup)
            elif resp.status_code != 200:
                print(f"HTTP {resp.status_code} SKIP {aid}")
                fail += 1
                continue
            else:
                soup = BeautifulSoup(resp.text, "html.parser")
                cc = extract_comment_count(resp.text, soup)
            cur = conn.cursor()
            cur.execute(
                "UPDATE article_raw SET comment_count = %s WHERE source_article_id = %s",
                (cc, aid),
            )
            cur.close()
            conn.commit()
            ok += 1
            print(f"OK [{ok}] {aid}: comment_count={cc}")
        except Exception as e:
            print(f"FAIL [{fail + 1}] {aid}: {e}")
            fail += 1
        time.sleep(random.uniform(3, 5))

    print(f"\n完成: 成功 {ok}, 失败 {fail}")
    conn.close()


if __name__ == "__main__":
    main()
