# 新服务器 Docker 部署

这套六服务配置对应 2026-10-19 已验收的新机部署：前端、API、MySQL 8.0.46、MongoDB 7.0.40、Neo4j 5.20.0 和独立采集服务。运行文件统一放在已挂载的数据盘 `/data/xingtu`，不修改仓库根目录的开发 Compose。

运行配置、账号密码、用户上传文件和数据库备份不在 Git 中。团队连接信息单独交付。数据库及网页都只绑定 `127.0.0.1`，远程访问通过 SSH 隧道。接口权限整改完成前不开放公网网页；外部 AI 密钥、邮箱授权码的实际轮换仍须由凭据所有者确认。

## 已验收的行为

- MySQL 两库、MongoDB 两库、Neo4j 原数据、向量、24 个索引及 12 个约束已复制至新机；旧服务器保持运行，迁移窗口后的旧机新增数据不会自动同步。
- 三角色登录、21 项接口和五种简历导出已通过；Docker 和整机重启后数据盘、六服务及定时器自动恢复，重启前后数据与索引一致。
- JD 和 GitHub 每日北京时间 14:30、23:10 采集；首轮完整自然定时周期成功，写入新机数据库。智联完整正文仍可能要求网站登录，不能把列表记录视作完整 JD。
- 每日北京时间 03:30 本机逻辑备份已配置且首次运行成功。本机备份不等于异地备份；在线多库导出也不是跨库统一冻结的快照。

## 首次准备空运行目录

以下只适用于已挂载 `/data` 的 Linux 新机空目录，不用于覆盖现有服务器。脚本不分区、不格式化、不导入数据库、不读取或生成真实凭据，也不会自动启用采集。

```bash
# 在最新 main 仓库中，拉取采集分支供 git archive 使用。
git fetch origin data_collection:refs/remotes/origin/data_collection
python3 deploy/newserver/stage_runtime.py
```

脚本从已提交的应用 HEAD 和采集分支导出源码，记录提交号；将已验证的采集 Dockerfile 及依赖约束放进采集构建目录。运行目录非空时直接拒绝，禁止把它用于更新当前已经部署的服务器。

数据盘挂载和 Docker/containerd 存储位置须提前单独配置并核验：Docker `data-root=/data/docker`，containerd `root=/data/containerd`；本目录的 `systemd/data-mount.conf` 是两项服务的挂载依赖示例。不要对已有数据库盘重复初始化，不要覆盖主机其他配置。

## 私有环境文件

在 `/data/xingtu/secrets` 内将五份 `*.env.example` 分别复制为 `mysql.env`、`mongo.env`、`neo4j.env`、`api.env`、`collector.env`，替换所有尖括号占位符并设为 `0600`，目录设为 `0700`。

- MySQL 三处密码相同：`mysql.env`、API 的 `DATABASE_URL`、采集的 `MYSQL_PASSWORD`/`SERVER_DB_PASSWORD`。URL 内密码须做百分号编码，独立字段使用原始密码。
- Mongo 初始化凭据与采集 `MONGO_USER`/`MONGO_PASSWORD` 一致；Neo4j 初始化密码与两个应用的 `NEO4J_PASSWORD` 一致。
- JWT 使用独立的随机密钥，至少 32 字符。不得沿用示例占位符。外部 API 和 SMTP 授权码只放私有环境文件，不提交 Git。
- MySQL 实际数据目录、MongoDB 用户和 Neo4j 账号一旦建立，修改初始化环境变量**不会**自动更改数据库中的密码。已有实例轮换密码必须先在数据库执行受控操作，再同步配置，不能删除数据目录。
- 私有配置变更后需要重新创建相应应用容器；单纯 `docker restart` 不会重新读取 Compose 的环境文件。

配置检查避免输出已展开的秘密：

```bash
cd /data/xingtu
docker compose --profile app --profile collection config --quiet
docker compose up -d mysql mongo neo4j
```

在启用 API 和采集前，按团队数据库规范恢复 `xingtu`、`talent_map`、`xingtu_raw`、`xingtu_analyzed` 和 Neo4j，并核对表、文档、图数据及索引。这里不自动建业务表，不运行全图重建脚本，不访问或变更旧服务器。

## 启动与访问

恢复、私有配置和新机连接验证完成后：

```bash
cd /data/xingtu
docker compose --profile app --profile collection build
docker compose --profile app up -d
# 确认 API 和采集都只连接新机内网数据库后再启用定时 JD 采集。
docker compose --profile collection up -d job-collector
docker compose --profile app --profile collection ps
```

API 通过 `python -m scripts.deployment_start` 等待 MySQL 和 Neo4j 就绪后启动；仅这个部署配置使用该入口。根目录开发 Compose 保持原行为。Nginx 允许 10MiB 请求体，关闭 API 响应缓冲并设置 300 秒超时；访问日志只记录 URL 路径，避免把查询参数中的 JWT 写入日志。

在队友电脑建立隧道，替换 `<NEW_SERVER_IP>` 后保持终端开启：

```bash
ssh -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -N -L 13000:127.0.0.1:3000 -L 13308:127.0.0.1:3308 -L 17474:127.0.0.1:7474 -L 17687:127.0.0.1:7687 -L 37017:127.0.0.1:27017 root@<NEW_SERVER_IP>
```

网页 `http://127.0.0.1:13000`；MySQL `127.0.0.1:13308`；MongoDB `127.0.0.1:37017`；Neo4j Browser `http://127.0.0.1:17474/browser/`。Browser 的数据库连接和 Desktop 的远程连接均使用 `bolt://127.0.0.1:17687`，账号密码从私下交付的配置取得。已验证 Browser HTTP 页面和 Bolt 登录查询；不把协议检查说成 Desktop 界面实测。

## 采集与备份定时

确认有界采集及落库后，在新机执行：

```bash
sudo python3 /data/xingtu/install_new_collection_timers.py
```

这会启用 GitHub 每日 14:30、23:10 的 systemd timer，准备但禁用每小时 :15 的 AI 抽取 timer，并限制 journald 占用。JD 调度由采集容器自身负责，不再添加同功能 cron。安装器只针对新机；不复制旧机已损坏的 AI cron。

先回到本仓库根目录，再从 `deploy/newserver/systemd` 安装备份服务、timer：

```bash
sudo install -m 0644 deploy/newserver/systemd/xingtu-backup.service /etc/systemd/system/xingtu-backup.service
sudo install -m 0644 deploy/newserver/systemd/xingtu-backup.timer /etc/systemd/system/xingtu-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now xingtu-backup.timer
sudo systemctl start xingtu-backup.service
```

备份脚本要求 `/data` 已挂载且可用空间至少 20GiB，输出到 `/data/backups/daily`，不自动删除旧备份。安排定期磁盘检查和异地备份；不要把“已启用 timer”当作“每次备份都成功”，须检查服务状态与最新备份 manifest。

AI 外部密钥确认轮换后，先更新私有配置并重新创建采集容器，执行有界抽取验证，再创建 `/data/xingtu/secrets/external_ai_rotation_confirmed` 标记并人工启用 `xingtu-analyzer.timer`。这个标记本身不验证密钥已撤销，责任人必须先核验供应商侧状态。

## 日常核验

```bash
cd /data/xingtu
docker compose --profile app --profile collection ps
docker logs --tail 50 xingtu-collector
systemctl list-timers --all 'xingtu-*'
systemctl status xingtu-backup.service
df -h / /data
```

服务版本和依赖约束来自本次实装环境，升级前须另做兼容性验证。部署完成不表示业务接口权限、第三方账号、来源网站登录限制、长时间压测或 AI 全流程已经通过。
