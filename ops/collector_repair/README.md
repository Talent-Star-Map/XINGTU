# 双来源岗位采集维护

服务器采集目录为 `/xingtu-min`，容器为 `xingtu-collector`。
`repair_pipeline.scheduler` 每天北京时间 14:30、23:10 调用 runner。
runner 默认执行腾讯与智联两个独立来源，随后执行 SQL 同步和图谱投影。

## 智联当前页面适配

- 使用 `/jobs/?jl=489&kw=...` 的公开岗位卡片，不再依赖旧版 `.joblist-box__item`。
- 所有关键词复用 `/app/browser_data/zhilian`，普通 Chromium 在 Xvfb 中运行。
- 从页面 JSON 只读取岗位身份与原始链接，再与可见卡片标题、企业核对。
- 仅采集公开可见字段。隐藏薪资保留为空，登录限制的正文不读取或绕过；
  结果中的 `details_login_required` 明确记录这些岗位数量。
- 更新时保留已有完整正文；公开列表刷新不清空历史正文或技能。
- 默认 10 个技术关键词，每关键词最多 5 条，每轮最多 50 条。
  页面操作间隔 3 秒。验证、登录跳转或 HTTP 401/403/429 会终止当前来源。

腾讯保留每轮最多 500 条的原有配置，并对临时 5xx 错误增加有限重试。
两个来源分别在子进程运行，默认每个来源最多 20 分钟；一个失败仍执行另一个。
全局进程锁阻止重复运行。阶段失败、受阻或空产出不会记为整轮成功。

## 检查运行结果

```bash
docker logs --tail 50 xingtu-collector
cat /xingtu-min/logs/pipeline_latest.json
cat /xingtu-min/logs/zhilian_latest.json
```

完整批次记录在 `logs/pipeline_runs.jsonl`。
证据按来源分开保存在 `logs/source_evidence/tencent` 和 `logs/source_evidence/zhilian`。
日志不包含连接密码或浏览器 Cookie。

## 有界验证

在服务器已授权开展采集时，可执行以下小批量验证，避免直接运行完整批次：

```bash
docker exec -e ZHILIAN_KEYWORDS=Python xingtu-collector \
  python -u -m repair_pipeline.runner --sources zhilian,tencent \
  --zhilian-max-details 3 --max-details 2 --max-pages 1 --source-timeout 240
```

该命令会真实更新采集库、同步业务库并执行已有图谱投影。

## 离线验证

```bash
python ops/collector_repair/test_repair.py
```

`test_source_execution.py` 需 Linux，验证子进程超时退出、错误状态和失败后恢复，
使用临时模拟进程，不连接数据库或外部网站。

## 2026 年 10 月 15 日部署

变更前代码备份位于服务器
`/root/xingtu-repair-20261015/collector-code-before.tar.gz`。
这次仅替换 runner、source_worker、腾讯/智联适配器与 SQL 同步模块。
原调度器继续运行；后续每次调度会加载新 runner 默认的两个来源。

首轮小批量验证：智联新增 3 条、腾讯更新 2 条，SQL 新增 3 条、更新 2 条、失败 0；
图谱投影成功。这 3 条智联岗位的完整正文均需站点登录，证据中已明确标记。

第二轮 Python、Java 验证：新增 8 条、更新 2 条、失败 0，SQL 同步和图谱投影成功。
两轮共新增 11 条；这 11 条均已进入业务库，清洗记录均已标记同步成功。
采集库按来源和岗位编号检查的重复组数为 0。容器随后重启以验证调度恢复。

临时远程浏览器服务和本地 SSH 转发已关闭。服务器因磁盘接近满载，
此次保留近期系统日志，清理了约 1.2 GB 较早的归档 journal；另清理 apt 下载缓存。
临时浏览器查看工具及其本次新增的 64 个软件包已按安装记录移除，
随后通过无网络的 Chromium 启动检查确认采集运行环境仍正常。
## GitHub 每日榜单留存（2026-10-23）

服务器新增独立的 `xingtu-github-daily.timer`，每天北京时间 09:00 运行
`github_daily.py`，采集 GitHub 官方 Trending 的 daily 榜单并补充仓库语言、Topics、
总 Stars 和当日新增 Stars。它与原有 GitHub、招聘采集任务并行，使用独立文件锁。

每日结果保存在 MongoDB `xingtu_raw.github_daily_snapshots`，以北京时间日期作为唯一 ID。
同一天重跑不会覆盖已保存的榜单；失败或页面结构异常不会写入空快照，也不会补造历史。
当前仓库信息同时更新至 `raw_github_repos`。主题标签计数每个仓库只算一次，不能当成招聘技能需求。

首轮成功保存 9 个榜单仓库，9 个均完成 API 信息补充。求职者端在至少留存两个真实时间窗口后
显示 GitHub 主题河流；招聘主题河流另读岗位观察记录，不混用 GitHub 数据。

运维检查：`systemctl status xingtu-github-daily.timer`；执行日志：
`journalctl -u xingtu-github-daily.service`。首次安装脚本是 `install_github_daily.py`，
需要先将采集脚本放到服务器及采集容器内；定时任务依赖 Docker、采集容器和 `/data` 挂载可用。
