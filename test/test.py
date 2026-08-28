from playwright.sync_api import sync_playwright
from collectors.github.collector import GithubCollector, USER_DATA_DIR

URL = "https://github.com/liyupi/yu-ai-code-mother"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=USER_DATA_DIR,
        headless=False
    )
    page = context.new_page()

    collector = GithubCollector()
    data = collector.parse_repository_detail(page, URL)

    print("=" * 60)
    print(f"标题: {data.get('title')}")
    print(f"作者: {data.get('author')}")
    print(f"描述: {data.get('description')}")

    #print("=" * 60)
    #print("--- README 内容 ---")
    #print(data.get("content", ""))
    #print("=" * 60)

    input("按 Enter 关闭浏览器...")
    context.close()