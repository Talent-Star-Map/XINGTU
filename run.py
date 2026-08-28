"""Project startup entrypoint."""

import sys
import traceback


def main():
    if "--once" in sys.argv:
        print("==============================")
        print("执行一次性采集任务")
        print("==============================")
        try:
            from scheduler.article_scheduler import _run_task
            _run_task(is_once=True)
        except Exception as exc:
            print("采集任务失败:")
            print(exc)
            traceback.print_exc()
            sys.exit(1)
    else:
        print("==============================")
        print("文章采集系统启动")
        print("==============================")
        try:
            from scheduler.article_scheduler import run_scheduler
            run_scheduler()
        except KeyboardInterrupt:
            print("收到退出信号，文章采集系统关闭")
            sys.exit(0)
        except Exception as exc:
            print("调度器启动失败:")
            print(exc)
            traceback.print_exc()
            sys.exit(1)


if __name__ == "__main__":
    main()
