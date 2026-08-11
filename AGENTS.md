# AGENTS.md — 星图 (XINGTU)

## What is this

A job-capability knowledge graph platform (岗位能力图谱动态演化与分析系统). Three user roles: **jobseeker**, **enterprise**, **admin**. Built with React + Vite + TypeScript (frontend) and FastAPI + SQLAlchemy + MySQL (backend). Docker Compose for deployment.

## Quick start

**Docker (production-like):**
```bash
docker compose up -d          # MySQL + API + Frontend
```

**Local dev (3 terminals):**
```bash
# 1. Database
docker compose up -d mysql    # MySQL on localhost:3307

# 2. Backend (Python 3.12)
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload

# 3. Frontend
cd frontend && npm install && npm run dev  # Vite on localhost:5173
```

## Gotchas — read before changing code

**Vite proxy 配置.** `vite.config.ts` 中 `/api` 代理到 `127.0.0.1:8081`（必须用 127.0.0.1，不能用 localhost，防 IPv6 `::1` 连不上后端）。`server.host` 设为 `127.0.0.1`，确保浏览器通过 IPv4 访问。

**Database URL differs by environment.** Docker: `mysql:3306`. Local dev: `localhost:3307`. The default in `database.py` is `localhost:3307` — this is correct for local dev, not Docker.

**No test framework.** There are no unit/integration tests, no test runner configured, no pytest.ini, no vitest config. The "tests" are API endpoints (`/api/quality/*-test`) that run in-process against seed data. Don't look for `npm test` or `pytest` — they don't exist.

**No linting or formatting.** No eslint, prettier, ruff, or black config. Code style is informal.

**SMTP credentials are hardcoded.** `backend/auth.py:9` has QQ SMTP credentials in plaintext. Don't commit new secrets — follow this pattern only for dev, and flag it in reviews.

**Jobs data is seeded in code.** `backend/jobs.py` has `SEED_JOBS` — a hardcoded list of 15 jobs (read-only seed for the quality/jobs endpoints). The quality API can optionally load from `backend/test_data/expanded_jobs.json` if it exists. Note: `SEED_JOBS` is **not** the same as the `jobs` DB table — the DB `jobs` table (see `database.py::CrawledJob`) holds crawler-aggregated market jobs/articles (爬虫整合主表), and `enterprise_jobs` (see `database.py::Job`) holds enterprise-published positions for the enterprise-side TalentSearch/JobManage/Dashboard flows, seeded by `backend/sql/seed.sql`.

**Two jobs tables — DO NOT confuse.** `database.py` has TWO job-related models:
- `CrawledJob` (`__tablename__='jobs'`) — 爬虫整合主表，31 列，按 `docs/字段汇总.md` 设计。求职者端浏览市场岗位/文章用，由同事部署的爬虫服务写入，本地通过 `seed_jobs.sql` 灌 15 条种子数据。
- `Job` (`__tablename__='enterprise_jobs'`) — 企业端发布岗位表，14 列。企业端 TalentSearch/JobManage/Dashboard 用，由 `seed.sql` 灌 10 条测试数据。
- 命名上刻意区分（`jobs` vs `enterprise_jobs`）避免表名冲突，前端/后端引用时务必看准是哪个表。

**DB models for enterprise talent search.** `database.py` defines `Job` (enterprise_id, title, salary_min/max, skills_required, status...) and `MatchRecord` (job_id, jobseeker_id, match_score, skill_match, exp_match, salary_match, status...). `match_score` and the three dimension scores are `nullable=True` — they are populated by `match_engine.run_match_batch()`; until then they stay NULL and the frontend must render "暂无匹配数据". Do NOT mock fake scores in seed data.

**Matching engine.** `backend/match_engine.py` computes 3-dimensional scores (skill coverage 0.6 / experience range 0.25 / salary overlap 0.15) and upserts to `match_records`. Triggered by `POST /api/enterprise/run-match` (button on TalentSearch top-right). **Skill-gate filter**: pairs with no skill overlap are skipped (no match_records row created). Each batch run deletes `status='pending'` records first (preserving accepted/rejected), then recomputes — so re-running is safe.

**Admin model & quality API auth.** `database.py` defines `Admin` (email, username, password). Seed a default admin by running `backend/sql/seed_admin.sql` in Navicat (default `admin@xingtu.com / Admin1234`, idempotent via `ON DUPLICATE KEY UPDATE`). Admin login is `POST /api/auth/admin/login` — separate from jobseeker/enterprise login, no verification code, no registration. **All `/api/quality/*` endpoints require admin JWT** (`?token=...` with role=admin); frontend `QualityDashboard.tsx` injects token via `withToken()` helper. Quality feature lives in admin端 only — removed from JobseekerShell and EnterpriseShell.

**Test users (jobseeker + enterprise).** Seed test users by running `backend/sql/seed_users.sql` in Navicat (idempotent):
- 求职者：`xing@test.com / Xing123`（用户名 `Xing`）
- 企业端：`tu@test.com / Tu123`（用户名 `Tu`，关联"星图科技有限公司"）
- 密码用 bcrypt(salt_rounds=12) 预计算后写入 SQL，后端 `auth.py` 用 `bcrypt.checkpw` 校验，完全兼容
- 重置密码命令：`python -c "import bcrypt; print(bcrypt.hashpw('新密码'.encode(), bcrypt.gensalt()).decode())"`

**AdminShell frontend.** `components/AdminShell.tsx` mirrors the EnterpriseShell/JobseekerShell state-driven pattern (not react-router Route). Login entry is a low-key button at the bottom of `RoleSelect.tsx`. Admin theme color is green (vs jobseeker cyan / enterprise purple).

**Resume parsing depends on external APIs.** `backend/resume_parser.py` and `backend/quality_checker.py` likely call external LLM services. They won't work without network access or proper API keys.

**Env file.** `backend/.env` 包含 `DATABASE_URL`、`JWT_SECRET`、`LONGCAT_API_KEY` 等运行配置，已提交供团队共享。`database.py` 通过 `python-dotenv` 读取（`load_dotenv()` 在 `main.py` 顶部调用）。

**图图 AI 问答.** `chat_api.py` 调用 DeepSeek API（OpenAI Chat Completions 格式）。需配置 `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` / `DEEPSEEK_BASE_URL`。API 不可用时自动回退到本地关键词知识库。`/api/chat/resources` 端点根据技能返回真实学习链接（`learning_path.py`）。**注意：`/api/chat/debug` 和 `/api/chat/raw` 已移除（安全原因）。**

**学习数据存储.** `learning_api.py` 提供 6 个 API 端点（技能掌握/诊断历史/学习进度），数据存储在 MySQL 3 张新表：`user_skills`、`diagnosis_history`、`learning_progress`。前端通过 `LearningContext.tsx` 全局状态管理读写，不再依赖 localStorage。

**SMTP 密码已移至 .env.** `backend/.env` 中配置 `SMTP_PASSWORD`，代码中通过 `os.getenv('SMTP_PASSWORD')` 读取，不再硬编码。

**缓存自动清理.** `match_api.py` 启动时自动清理超过 1 小时的匹配缓存文件。

**学习资源数据库化.** 学习资源已从 `learning_path.py` 硬编码迁移到 `skill_resources` 数据库表（33 技能 88 条资源）。`learning_path.py` 通过 `_fetch_all_resources()` 从 DB 读取，保留原有模糊匹配 + fallback 逻辑。管理员通过 `/api/admin/resources` CRUD 接口维护资源，前端管理页面 `AdminResourceManage.tsx`。

## Architecture

```
XINGTU/
├── backend/                   # FastAPI app (Python 3.12)
│   ├── main.py                # App entrypoint, mounts routers + /uploads static mount
│   ├── database.py            # SQLAlchemy models: Jobseeker, Enterprise, Admin, VerifyCode, Job, MatchRecord + JWT helpers
│   ├── routers/               # FastAPI 路由层（8 个 router 模块）
│   │   ├── auth.py            # /api/auth — register, login, profile, resume CRUD; /api/auth/admin/login
│   │   ├── jobs.py            # /api/jobs — seeded job data + stats (SEED_JOBS, 15 hardcoded)
│   │   ├── company.py         # /api/company — public enterprise profiles
│   │   ├── enterprise.py      # /api/enterprise — talent search, job CRUD, dashboard, run-match
│   │   ├── match_api.py       # /api/match — 人岗匹配分析接口
│   │   ├── quality_api.py     # /api/quality — data quality reports + accuracy tests (admin-only, require_admin dep)
│   │   ├── chat_api.py        # /api/chat — 图图 AI 问答（DeepSeek API, OpenAI 格式）+ 学习资源
│   │   └── learning_api.py    # /api/learning — 技能掌握/诊断历史/学习进度（数据库存储）
│   ├── services/              # 业务逻辑层（无 router，被 routers 调用）
│   │   ├── match_engine.py    # 3-dimensional matching engine (skill/exp/salary) → match_records
│   │   ├── match_analyzer.py  # 多维度匹配算法：技能50%/经验20%/学历15%/薪资15%
│   │   ├── skill_synonyms.py  # 技能同义词映射表
│   │   ├── resume_parser.py   # 简历解析：PDF/Word → 技能提取 + 同义词归一化
│   │   ├── quality_checker.py # Data quality analysis (plagiarism, inflation, cross-validation)
│   │   └── learning_path.py   # 技能→学习资源链接映射（含视频教程）
│   ├── scripts/               # 独立运行的 CLI 脚本（不被业务代码 import）
│   │   ├── jd_scraper.py      # JD scraping from Boss/拉勾 (requests-based CLI tool)
│   │   └── selenium_scraper.py # JD scraping via Selenium headless Chrome (alt to jd_scraper)
│   ├── tests/                 # 测试文件
│   │   ├── test_api_contract.py # API Contract Tests for /api/match/analyze
│   │   └── test_match.py      # 人岗匹配准确率测试（train/dev/test split）
│   ├── sql/                   # SQL 种子脚本（在 Navicat 中执行，幂等）
│   │   ├── seed_users.sql     # 测试用户：求职者 Xing/Xing123 + 企业端 Tu/Tu123
│   │   ├── seed_admin.sql     # 默认管理员 admin@xingtu.com / Admin1234
│   │   ├── seed.sql           # 企业端测试数据：10 求职者 + 10 岗位(enterprise_jobs) + 10 匹配记录
│   │   └── seed_jobs.sql      # 爬虫主表(jobs) 15 条种子岗位数据
│   ├── .env                   # 运行配置（数据库+API Key），已提交供团队共享
│   ├── test_data/             # Seed test data for quality endpoints
│   └── uploads/               # 用户上传文件（运行时生成，.gitignore 已忽略）
├── frontend/          # React 19 + Vite 5 + TypeScript
│   ├── src/
│   │   ├── App.tsx    # Router: role-based shell (JobseekerShell / EnterpriseShell / AdminShell)
│   │   ├── pages/
│   │   │   ├── jobseeker/  # Dashboard, Jobs, SkillGraph, MySkillGraphPage, Resume, Match, LearningPath, Trend, ProfileHome, ProfileEdit
│   │   │   ├── enterprise/ # Dashboard, JobManage, TalentSearch, MarketInsight, IndustryReport, CompanyProfile, QualityDashboard (QualityDashboard reused by AdminShell)
│   │   │   └── (root)      # Login (supports 3 roles), RoleSelect
│   │   ├── components/
│   │   │   ├── JobseekerShell.tsx   # Jobseeker layout + nav (no quality entry)
│   │   │   ├── EnterpriseShell.tsx  # Enterprise layout + nav (no quality entry)
│   │   │   ├── AdminShell.tsx       # Admin layout + nav (only quality entry)
│   │   │   ├── ThemeProvider.tsx   # Light/dark theme context
│   │   │   ├── PageContainer.tsx   # Shared page wrapper
│   │   │   ├── ProfileSidebar.tsx  # User profile side nav
│   │   │   ├── CompanyCard.tsx     # Enterprise company display card
│   │   │   ├── Graph3D.tsx         # Three.js 3D graph visualization
│   │   │   └── ui/          # Reusable animation/effect components (aurora, particles, tilt cards, glare, star border, etc.)
│   │   ├── lib/              # NavContext, LearningContext, utils
│   │   └── types/index.ts    # Shared TypeScript interfaces
│   └── nginx.conf     # Production: SPA fallback + /api/ reverse proxy
├── docs/              # Competition briefs, architecture docs (Chinese)
└── docker-compose.yml # mysql + api + frontend services
```

### backend 目录结构说明（2026-07-25 重构）

- **routers/** — FastAPI 路由层，每个文件定义一个 `router = APIRouter(...)`，被 `main.py` 通过 `from routers.xxx import router` 引入
- **services/** — 业务逻辑层，无 router，被 routers 跨目录引用（`from services.xxx import ...`）
- **scripts/** — 独立 CLI 脚本（爬虫），不被业务代码 import，单独运行
- **tests/** — 测试文件，`sys.path` 在文件内自动指向 `backend/` 根
- **根目录只保留** `main.py` + `database.py`（被所有人 import）+ 配置文件

每个 py 文件顶部 docstring 里有 `@owner` 注释标明负责人（基于 [docs/00-分工基本信息.md](docs/00-分工基本信息.md)）。

## Key commands

| Task | Command |
|---|---|
| Start everything (Docker) | `docker compose up -d` |
| Start MySQL only | `docker compose up -d mysql` |
| Start backend (dev) | `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload` |
| Start frontend (dev) | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |
| Seed test users (Xing/Tu) | 在 Navicat 运行 `backend/sql/seed_users.sql` |
| Seed default admin account | 在 Navicat 运行 `backend/sql/seed_admin.sql` |
| Seed enterprise test data (jobseekers/jobs/matches) | 在 Navicat 运行 `backend/sql/seed.sql` |
| Seed crawled jobs (15 条爬虫主表数据) | 在 Navicat 运行 `backend/sql/seed_jobs.sql` |
| Run JD scraper (requests) | `cd backend && python -m scripts.jd_scraper boss` |
| Run JD scraper (Selenium) | `cd backend && python -m scripts.selenium_scraper` |

## Conventions

- **Language:** UI and most comments are in Chinese. API responses use Chinese error messages.
- **Auth:** JWT tokens passed as query parameter (`?token=...`), not in headers.
- **API pattern:** All endpoints return `{"success": bool, "data": ..., "message": ...}`.
- **Styling:** Tailwind CSS + CSS custom properties (design tokens in `index.css`). Supports light/dark theme via `data-theme` attribute.
- **3D/Animation:** Heavy use of Three.js (`@react-three/fiber`), GSAP, and Framer Motion in frontend components.
- **No state management library.** Auth state is in React `useState` + `localStorage`. No Redux/Zustand.
- **No routing library beyond react-router-dom.** Routes defined in `App.tsx` with role-based branching.
