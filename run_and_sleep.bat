@echo off
cd /d D:\Xingtu\job_data_collector
echo [%date% %time%] 开始采集 >> logs\task_run.log
python run.py --once >> logs\task_run.log 2>&1
if %errorlevel% equ 0 (
    echo [%date% %time%] 采集成功 >> logs\task_run.log
) else (
    echo [%date% %time%] 采集失败，错误码: %errorlevel% >> logs\task_run.log
)
echo [%date% %time%] 准备休眠 >> logs\task_run.log
shutdown /h /f
