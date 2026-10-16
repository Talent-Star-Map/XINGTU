#!/bin/bash
LOG_DIR=/xingtu-min/logs
mkdir -p "$LOG_DIR"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$LOG_DIR/github_collect_${TS}.log"

echo "[$(date)] GitHub 异构数据采集启动 → $LOG_FILE" >> "$LOG_FILE"
docker exec xingtu-collector python -u -m collectors.github.collector >> "$LOG_FILE" 2>&1
RC=$?
echo "[$(date)] GitHub 异构数据采集结束 rc=$RC" >> "$LOG_FILE"

# 保留最近 30 个日志
ls -t "$LOG_DIR"/github_collect_*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
exit $RC
