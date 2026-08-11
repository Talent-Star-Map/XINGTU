# ✦ 星图 —— 岗位能力图谱动态演化与分析系统

基于多源异构数据 + 大模型 + 知识图谱，新一代信息技术领域岗位能力分析平台。

---

## 快速开始

### 方式一：Docker 一键启动（推荐）

```bash
git clone https://github.com/Talent-Star-Map/XINGTU.git
cd XINGTU
docker compose up -d
```

浏览器打开 http://localhost:3000

### 方式二：本地开发（改代码用）

```bash
# 1. 启动数据库（云服务器已部署可跳过此步，本地后端直连云库）
docker compose up -d mysql    # MySQL on localhost:3307

# 2. 启动后端
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload

# 3. 启动前端
cd frontend && npm install
npm run dev

# 4.（可选）初始化种子数据
#    在 Navicat 中依次执行以下 SQL 文件（连接 xingtu 库后运行）：
#    - backend/sql/seed_users.sql   # 求职者 Xing + 企业端 Tu 测试账号
#    - backend/sql/seed_admin.sql   # 默认管理员 admin@xingtu.com
#    - backend/sql/seed.sql         # 企业端测试数据（10 求职者 + 10 岗位 + 10 匹配记录）
#    - backend/sql/seed_jobs.sql    # 爬虫主表 15 条种子岗位数据
```

浏览器打开 http://localhost:5173

---

## 测试账号

| 角色 | 邮箱 | 密码 | 用户名 |
|---|---|---|---|
| 求职者 | xing@test.com | Xing123 | Xing |
| 企业 | tu@test.com | Tu123 | Tu |
| 管理员 | admin@xingtu.com | Admin1234 | 系统管理员 |

> 管理员端入口在角色选择页底部"管理员入口"按钮。质检功能（数据质量报告、准确率测试等）已集中到管理员端，求职端/企业端不再展示。
> 账号通过 `backend/sql/seed_users.sql` 和 `backend/sql/seed_admin.sql` 初始化，幂等可重复执行。

---

## 服务地址

| 服务 | 本地 | 服务器 |
|---|---|---|
| 前端 | http://localhost:3000 | http://180.76.227.159:3000 |
| 后端 API | http://localhost:8081 | http://180.76.227.159:8081 |
| MySQL | localhost:3307 | 180.76.227.159:3308（Navicat 直连） |

> **数据库连接说明**：
> - 云服务器 MySQL 已映射到宿主机 3308 端口（容器内 3306）
> - 本地后端默认通过 `backend/.env` 的 `DATABASE_URL` 直连云库 `180.76.227.159:3308`
> - Navicat 连接：主机 `180.76.227.159`，端口 `3308`，用户 `root`，密码 `Xingtu123`，库 `xingtu`
> - 云安全组需放行 3308 端口（建议限制源 IP 为本机公网 IP）

---

## 数据库表结构

| 表名 | 用途 | ORM 模型 |
|---|---|---|
| `jobs` | 爬虫整合主表（31 列，求职者端浏览市场岗位/文章） | `database.py::CrawledJob` |
| `enterprise_jobs` | 企业端发布岗位表（14 列，企业端 TalentSearch/JobManage/Dashboard） | `database.py::Job` |
| `jobseekers` | 求职者账号表 | `database.py::Jobseeker` |
| `enterprises` | 企业端账号表 | `database.py::Enterprise` |
| `admins` | 管理员账号表 | `database.py::Admin` |
| `match_records` | 人岗匹配记录表 | `database.py::MatchRecord` |
| `verify_codes` | 验证码表 | `database.py::VerifyCode` |
| `user_skills` | 用户已掌握技能（按岗位区分） | SQL 直接操作 |
| `diagnosis_history` | 诊断历史记录（含完整技能数据） | SQL 直接操作 |
| `learning_progress` | 学习进度（按用户+岗位+技能） | SQL 直接操作 |
| `skill_resources` | 技能学习资源（管理员后台维护，33 技能 88 条） | `database.py::SkillResource` |

> ⚠️ **注意 `jobs` 和 `enterprise_jobs` 是两张不同的表**：
> - `jobs` = 爬虫采集的真实市场岗位（求职者端浏览）
> - `enterprise_jobs` = 企业自己发布的岗位（企业端管理）
> - 命名刻意区分以避免冲突，前后端引用时务必看准

---

## 种子数据 SQL 脚本

所有种子脚本位于 `backend/sql/`，在 Navicat 中打开执行即可（幂等，可重复运行）：

| 脚本 | 作用 |
|---|---|
| `seed_users.sql` | 求职者 Xing/Xing123 + 企业端 Tu/Tu123 测试账号 |
| `seed_admin.sql` | 默认管理员 admin@xingtu.com / Admin1234 |
| `seed.sql` | 企业端测试数据：10 求职者 + 10 岗位(enterprise_jobs) + 10 匹配记录 |
| `seed_jobs.sql` | 爬虫主表(jobs) 15 条种子岗位数据 |

密码哈希说明：脚本中的密码用 `bcrypt(salt_rounds=12)` 预计算，后端 `auth.py` 用 `bcrypt.checkpw` 校验，完全兼容。

重置密码命令：
```bash
python -c "import bcrypt; print(bcrypt.hashpw('新密码'.encode(), bcrypt.gensalt()).decode())"
```

---

## ⚠️ 不要提交依赖到仓库

已通过 `.gitignore` 排除 `node_modules/`、`dist/`、`*.db`，各自本地安装即可。

---

## 技术栈

React + Vite + TypeScript + FastAPI + SQLAlchemy + MySQL + Docker
