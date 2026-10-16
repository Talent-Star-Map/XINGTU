#!/bin/bash
# M2:DeepSeek 实体抽取 — 独立 cron 任务
# 跟 GitHub collector 解耦,各自管各自的节奏
# 用法:主机层 cron 调用,或在容器内直接 python -m

set -e

LOG_DIR="/opt/xingtu-min/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/analyzer_${TIMESTAMP}.log"

echo "[$(date '+%F %T')] DeepSeek 实体抽取启动 → $LOG_FILE" >> "$LOG_FILE"

# 容器内运行(继承 .env 里 DEEPSEEK_API_KEY)
docker exec xingtu-collector python -u -m analyzer.entity_extractor --limit 50 >> "$LOG_FILE" 2>&1
RC=$?

echo "[$(date '+%T')] DeepSeek 实体抽取结束 rc=$RC" >> "$LOG_FILE"

# 清理:只保留最近 30 个日志
ls -t "$LOG_DIR"/analyzer_*.log 2>/dev/null | tail -n +31 | xargs -r rm -f

exit $RC