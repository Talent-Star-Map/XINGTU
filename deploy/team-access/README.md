# 团队便捷连接

使用新服务器的 SSH/22 加密通道；数据库端口不向公网开放。不需要 VPN 账号或手动保持终端窗口。日常账号 `xingtu-connect` 仅支持六个指定回环端口的转发，没有 shell、SFTP、远端监听或任意地址转发权限；SSH 管理仍使用原管理员账号。

## 队友首次使用（Windows 10/11）

1. 更新仓库，双击本目录 `Setup.cmd`。首次按提示输入新机管理员密码进行设备登记，密码不保存；每台电脑单独生成密钥，不共享私钥。需要 Windows OpenSSH 客户端。
2. 完成后桌面出现 `XINGTU Web`、`XINGTU Graph`、`XINGTU Connect`、`XINGTU Stop`、`XINGTU Backend`。双击网页/图谱入口会自动连接，后台运行，断线自动重连；重复点击不会启动第二条通道。
3. 如需登录 Windows 后自动连接，在 PowerShell 执行下面的命令一次。关闭当前连接不会停止服务器采集或 Docker 服务。

```powershell
& "$env:USERPROFILE\.xingtu-access\XingtuAccess.ps1" -Action AutoStart
# 取消自动连接：相同命令改为 -Action NoAutoStart
```

不愿在队友电脑输入管理员密码时，可先运行 `Setup -PrepareOnly`，仅把生成的 `id_ed25519.pub` 发给管理员。管理员通过 SSH 执行服务端 `enroll <设备名>`，将标准输入设为该公钥，私下交付其返回的连接配置文件；队友再使用 `-Action Setup -EnrollmentFile <私下收到的文件路径> -Repo <仓库路径>`。连接配置包含数据库密码，不能贴到聊天群、日志或 Git。此路径已在本机实测。

## 常用地址（设置后无需修改客户端操作习惯）

| 用途 | 地址 | 账号配置 |
|---|---|---|
| 新机网页 | http://127.0.0.1:13000 | 项目登录账号 |
| 新机 API | http://127.0.0.1:18081 | 项目 token；与本地开发 8081 分开 |
| MySQL / Navicat | 127.0.0.1:13308 | 私下交付的数据库账号；库 xingtu、talent_map |
| Neo4j Browser | http://127.0.0.1:17474/browser/ | 连接地址填下一行 |
| Neo4j Browser / Desktop 数据连接 | bolt://127.0.0.1:17687 | 私下交付的 Neo4j 账号 |
| MongoDB / Compass | 127.0.0.1:37017 | 私下交付的账号，认证库 admin |

连接后也可以继续使用 Navicat 自带 SSH 功能；两种方式选择其一，避免重复占用相同本地端口。若已有手动隧道，先关闭它。本工具遇到端口冲突会报告错误，不杀其他进程、不自动换端口。

## 本地改代码

前端仍在自己的电脑运行 `npm run dev`（5173），代理本地后端 8081。后端连接新机数据库，仍可热重载；浏览新机已部署版本用 13000。

本机需要 Python 3.12+。首次点击 Backend 会自动准备隔离环境；也可以提前安装项目后端依赖：

```powershell
# 在仓库根目录运行一次；依赖隔离到用户主目录 .xingtu-access，不覆盖原 .env。
powershell -NoProfile -ExecutionPolicy Bypass -File deploy/team-access/XingtuAccess.ps1 -Action PrepareBackend -Repo (Get-Location).Path
```

之后双击仓库中的 `Backend.cmd`（推荐，会使用该仓库的最新代码），或者桌面的 `XINGTU Backend`（使用最近设置的仓库路径）。它会先自动连接，再使用私有 `backend.env` 启动 uvicorn，监听 `127.0.0.1:8081`，保留热重载。切换仓库时重新运行 Setup 或 PrepareBackend 更新路径；依赖文件变更时会重新准备环境。

`backend.env` 只包含新机数据库连接及本地独立 JWT；不导出服务器 JWT、AI API 密钥或邮箱授权码，不修改原 `backend/.env`。本地原有 `.env` 中的外部服务设置仍可被项目读取，须自行确认有效且已轮换。项目本身启动时的 `init_db` 行为保持原样；共享库建表/改表仍遵守团队手动 SQL 规范。

## 服务端安装与撤销设备

仅在已经部署好的**新机**执行，不操作旧机：

```bash
sudo install -m 0700 deploy/team-access/server.py /usr/local/sbin/xingtu-team-access.py
sudo python3 /usr/local/sbin/xingtu-team-access.py install
# 公钥经 stdin 提交；enroll 返回私密 JSON，必须写入受保护文件，不能打印到共享日志。
# 撤销指定设备，下次认证即拒绝；已经建立的 SSH 连接需要另行断开。
sudo python3 /usr/local/sbin/xingtu-team-access.py revoke <设备名>
```

安装器只添加专用账号及 SSH Match 配置，语法验证成功才 reload，不更改 root 登录和其他服务。公钥列表为 root 所有，每台设备用名字标记，可独立替换或撤销。首次设置需管理员授权，日常连接无需管理员密码。默认私钥无口令以支持自动连接，限制到当前 Windows 用户 ACL，账号只可端口转发；电脑丢失时应撤销对应公钥，数据库密码仍由原私下配置管理。

私钥、连接密码、日志、状态均在 `%USERPROFILE%\.xingtu-access`，不放仓库。服务器指纹固定在 `server-public.json`；主机重装换钥必须由管理员核验后更新，不能关闭指纹校验绕过。状态诊断运行 `-Action Status`，详细 SSH 错误见该目录 `ssh-error.log`。

验证：Linux 上 `python3 deploy/team-access/test_access.py` 检查恶意输入拒绝；真实验收还需六端口只读访问、错误目标/会话/远端转发拒绝、重复启动、端口冲突、停止和自动重连。协议连通不代表已测试所有 GUI 客户端。公网网页发布仍受业务权限整改与外部凭据轮换约束。

依据：[OpenSSH 转发与权限设置](https://man.openbsd.org/sshd_config)、[Microsoft SSH 密钥管理](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement)。
