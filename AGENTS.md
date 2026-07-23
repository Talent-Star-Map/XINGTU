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

**Jobs data is seeded in code.** `backend/jobs.py` has `SEED_JOBS` — a hardcoded list of 15 jobs (read-only seed for the quality/jobs endpoints). The quality API can optionally load from `backend/test_data/expanded_jobs.json` if it exists. Note: `SEED_JOBS` is **not** the same as the `jobs` DB table — the DB `jobs` table (see `database.py::Job`) holds enterprise-published positions for the enterprise-side TalentSearch/JobManage/Dashboard flows, seeded by `backend/mock_data/seed.py`.

**DB models for enterprise talent search.** `database.py` defines `Job` (enterprise_id, title, salary_min/max, skills_required, status...) and `MatchRecord` (job_id, jobseeker_id, match_score, skill_match, exp_match, salary_match, status...). `match_score` and the three dimension scores are `nullable=True` — they are populated by `match_engine.run_match_batch()`; until then they stay NULL and the frontend must render "暂无匹配数据". Do NOT mock fake scores in seed data.

**Matching engine.** `backend/match_engine.py` computes 3-dimensional scores (skill coverage 0.6 / experience range 0.25 / salary overlap 0.15) and upserts to `match_records`. Triggered by `POST /api/enterprise/run-match` (button on TalentSearch top-right). **Skill-gate filter**: pairs with no skill overlap are skipped (no match_records row created). Each batch run deletes `status='pending'` records first (preserving accepted/rejected), then recomputes — so re-running is safe.

**Admin model & quality API auth.** `database.py` defines `Admin` (email, username, password). Seed a default admin via `cd backend && python -m mock_data.seed_admin` (default `admin@xingtu.com / Admin1234`, idempotent). Admin login is `POST /api/auth/admin/login` — separate from jobseeker/enterprise login, no verification code, no registration. **All `/api/quality/*` endpoints require admin JWT** (`?token=...` with role=admin); frontend `QualityDashboard.tsx` injects token via `withToken()` helper. Quality feature lives in admin端 only — removed from JobseekerShell and EnterpriseShell.

**AdminShell frontend.** `components/AdminShell.tsx` mirrors the EnterpriseShell/JobseekerShell state-driven pattern (not react-router Route). Login entry is a low-key button at the bottom of `RoleSelect.tsx`. Admin theme color is green (vs jobseeker cyan / enterprise purple).

**Resume parsing depends on external APIs.** `backend/resume_parser.py` and `backend/quality_checker.py` likely call external LLM services. They won't work without network access or proper API keys.

**Env file.** `backend/.env` 包含 `DATABASE_URL`、`JWT_SECRET`、`LONGCAT_API_KEY` 等运行配置，已提交供团队共享。`database.py` 通过 `python-dotenv` 读取（`load_dotenv()` 在 `main.py` 顶部调用）。

**图图 AI 问答.** `chat_api.py` 调用 LongCat API（`https://api.longcat.chat/anthropic/v1/messages`，Anthropic Messages 格式）。需配置 `LONGCAT_API_KEY` / `LONGCAT_MODEL` / `LONGCAT_BASE_URL`。API 不可用时自动回退到本地关键词知识库。新增 `/api/chat/resources` 端点根据技能返回真实学习链接（`learning_path.py`）。

## Architecture

```
XINGTU/
├── backend/           # FastAPI app (Python 3.12)
│   ├── main.py        # App entrypoint, mounts routers + /uploads static mount
│   ├── auth.py        # /api/auth — register, login, profile, resume CRUD; /api/auth/admin/login
│   ├── jobs.py        # /api/jobs — seeded job data + stats (SEED_JOBS, 15 hardcoded)
│   ├── company.py     # /api/company — public enterprise profiles
│   ├── enterprise.py  # /api/enterprise — talent search, job CRUD, dashboard, run-match
│   ├── match_engine.py # 3-dimensional matching engine (skill/exp/salary) → match_records
│   ├── quality_api.py # /api/quality — data quality reports + accuracy tests (admin-only, require_admin dep)
│   ├── database.py    # SQLAlchemy models: Jobseeker, Enterprise, Admin, VerifyCode, Job, MatchRecord + JWT helpers
│   ├── match_api.py        # /api/match — 人岗匹配分析接口
│   ├── match_analyzer.py   # 多维度匹配算法：技能50%/经验20%/学历15%/薪资15%
│   ├── skill_synonyms.py   # 技能同义词映射表
│   ├── chat_api.py         # /api/chat — 图图 AI 问答（LongCat API, Anthropic 格式）
│   ├── learning_path.py    # 技能→学习资源链接映射
│   ├── resume_parser.py    # 简历解析：PDF/Word → 技能提取 + 同义词归一化
│   ├── quality_checker.py  # Data quality analysis (plagiarism, inflation, cross-validation)
│   ├── jd_scraper.py       # JD scraping from Boss/拉勾 (requests-based CLI tool)
│   ├── selenium_scraper.py # JD scraping via Selenium headless Chrome (alt to jd_scraper)
│   ├── mock_data/          # Seed scripts (idempotent)
│   │   ├── seed.py         # 10 test jobseekers + 10 test jobs + 10 preset match_records
│   │   └── seed_admin.py   # Default admin account (admin@xingtu.com / Admin1234)
│   ├── .env                # 运行配置（数据库+API Key），已提交供团队共享
│   └── test_data/          # Seed test data for quality endpoints
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
│   │   ├── lib/              # NavContext, utils
│   │   └── types/index.ts    # Shared TypeScript interfaces
│   └── nginx.conf     # Production: SPA fallback + /api/ reverse proxy
├── docs/              # Competition briefs, architecture docs (Chinese)
└── docker-compose.yml # mysql + api + frontend services
```

## Key commands

| Task | Command |
|---|---|
| Start everything (Docker) | `docker compose up -d` |
| Start MySQL only | `docker compose up -d mysql` |
| Start backend (dev) | `cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload` |
| Start frontend (dev) | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |
| Seed test data (jobs/jobseekers/matches) | `cd backend && python -m mock_data.seed` |
| Seed default admin account | `cd backend && python -m mock_data.seed_admin` |
| Run JD scraper (requests) | `cd backend && python jd_scraper.py boss` |
| Run JD scraper (Selenium) | `cd backend && python selenium_scraper.py` |

## Conventions

- **Language:** UI and most comments are in Chinese. API responses use Chinese error messages.
- **Auth:** JWT tokens passed as query parameter (`?token=...`), not in headers.
- **API pattern:** All endpoints return `{"success": bool, "data": ..., "message": ...}`.
- **Styling:** Tailwind CSS + CSS custom properties (design tokens in `index.css`). Supports light/dark theme via `data-theme` attribute.
- **3D/Animation:** Heavy use of Three.js (`@react-three/fiber`), GSAP, and Framer Motion in frontend components.
- **No state management library.** Auth state is in React `useState` + `localStorage`. No Redux/Zustand.
- **No routing library beyond react-router-dom.** Routes defined in `App.tsx` with role-based branching.
