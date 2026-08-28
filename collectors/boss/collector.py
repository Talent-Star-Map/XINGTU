"""
Boss Zhipin login initialization.

Open Boss website and keep login status.
"""

from playwright.sync_api import sync_playwright
import time


BOSS_URL = "https://www.zhipin.com/"


# Playwright专用Chrome用户目录
USER_DATA_DIR = "./browser_data/boss"



def main():

    print("==============================")
    print("启动 Boss 登录初始化")
    print("==============================")


    with sync_playwright() as p:


        print("启动浏览器...")


        context = p.chromium.launch_persistent_context(

            user_data_dir=USER_DATA_DIR,

            headless=False,


            viewport={
                "width":1280,
                "height":900
            },


            args=[

                "--disable-blink-features=AutomationControlled"

            ]

        )



        # 使用已有页面
        if context.pages:

            page = context.pages[0]

        else:

            page = context.new_page()



        print("==============================")
        print("打开 Boss 首页")
        print("==============================")


        try:


            page.goto(

                BOSS_URL,

                timeout=60000,

                wait_until="domcontentloaded"

            )


        except Exception as e:


            print("页面打开异常:")
            print(e)



        # 等待加载

        page.wait_for_timeout(5000)



        print("==============================")
        print("当前网址:")
        print(page.url)


        print("当前标题:")
        print(page.title())

        print("==============================")



        print(
            """
请在浏览器中完成：

1. 登录 Boss直聘
2. 完成人机验证（如果出现）
3. 确认进入正常首页


完成后回到控制台。

"""
        )


        input(
            "登录完成后按 Enter..."
        )



        print("==============================")
        print("检查登录状态...")
        print("==============================")


        page.wait_for_timeout(3000)



        print("当前网址:")
        print(page.url)


        print("当前标题:")
        print(page.title())



        print("==============================")



        print(
            """
登录状态初始化完成。

Cookie已经保存到：

browser_data/boss


以后Boss采集器会复用这个浏览器环境。
"""
        )


        input(
            "按 Enter 关闭浏览器..."
        )



        context.close()



if __name__ == "__main__":

    main()
