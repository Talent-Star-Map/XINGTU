# 公网 HTTPS 配置快照

实际入口：[星图公网网页](https://47.120.76.16/)。这是 2026-10-23 发布后从服务器读取的配置快照，非首次安装脚本。当前验收及限制见 [本轮记录](../operations/records/20261023_public_https.md)。

| 文件 | 服务器位置 |
| --- | --- |
| nginx-public.conf | `/etc/nginx/sites-available/xingtu-public.conf`（由 sites-enabled 链接） |
| xingtu-ip-certificate-renew.service | `/etc/systemd/system/` |
| xingtu-ip-certificate-renew.timer | `/etc/systemd/system/` |
| reload-public-tls.sh | `/data/xingtu/tools/`（0700） |

Nginx 配置在 HTTP 上下文的 sites-enabled 中载入；它定义日志格式、限流区及 upstream，不要重复载入。此快照只去掉旧注释，活动指令与现场一致。证书、私钥、ACME 账号及业务凭据不在 Git 中。

80 端口保留 ACME HTTP-01 验证，其余请求 308 跳转到固定 HTTPS IP。443 只转发到本机前端 3000，由前端容器转发 API。数据库、直接 API 和直接前端端口保持本机绑定。公网 `/docs`、`/redoc`、`/openapi.json` 被拒绝；应用自身鉴权继续负责 API、角色及附件归属。

外层访问日志的请求 URL 使用 `$uri`，不记录该请求的 `$args`；日志格式仍含 Referer，其他服务及错误日志也未作全链路令牌脱敏保证。运行日志属于私有运维材料，不对外发布，不直接复制进 Git。

IP 证书使用 Let’s Encrypt 短期证书，需持续续签。Certbot 运行文件在 `/data/xingtu/tools/certbot-5.4.0/`；配置与私钥在 `/data/xingtu/secrets/letsencrypt/`；工作目录在 `/data/xingtu/tools/acme-work/`；日志在 `/data/xingtu/operations/public_access/acme-logs/`。Timer 每日 00:00、12:00 加最多 20 分钟随机延迟检查，成功续签后先验证 Nginx 配置再 reload。已通过 staging 续签演练，未来是否成功仍需检查日志与实际到期时间。

## 维护核查

通过 SSH 查看 `systemctl status xingtu-ip-certificate-renew.timer`、`journalctl -u xingtu-ip-certificate-renew.service`、证书到期时间及公网受信任 TLS 连接；检查 80 的验证路径未被删掉，443 返回正常网页。需再次演练时使用同一 Certbot 的 `renew --dry-run --no-random-sleep-on-renew`，带上 service 中相同的 config/work/log 目录；不要清空或重建现有 ACME 配置。

修改前保存当前配置和时间；修改后 `nginx -t` 成功才 reload。续签 unit 修改后需要 daemon-reload；禁止因此重建数据库或重置账号。维护异常要记录具体失败和是否影响访问，不把 timer active 等同于成功续签。

## 退出公网业务

需要临时维护时，可使用服务器 `/data/xingtu/operations/public_access/nginx.paused-at-resume.conf` 暂停业务并保留证书验证路径和 HTTPS。恢复使用同目录 `nginx.https-candidate.conf`。两者均先 `nginx -t` 再 reload；不要恢复旧 HTTP 明文登录入口。现有 SSH 隧道独立保留。回滚公网入口不执行 SQL、种子或密码恢复。
