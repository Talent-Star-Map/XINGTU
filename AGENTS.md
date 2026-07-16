# AGENTS.md — 星图 (XINGTU)

## What is this

A job-capability knowledge graph platform (岗位能力图谱动态演化与分析系统). Two user roles: **jobseeker** and **enterprise**. Built with React + Vite + TypeScript (frontend) and FastAPI + SQLAlchemy + MySQL (backend). Docker Compose for deployment.

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

**Port mismatch in vite.config.ts proxy.** The Vite dev server proxies `/api` to `localhost:8083`, but the backend runs on `8081`. This is either a bug or a stale config — verify before assuming API calls will work in dev.

**Database URL differs by environment.** Docker: `mysql:3306`. Local dev: `localhost:3307`. The default in `database.py` is `localhost:3307` — this is correct for local dev, not Docker.

**No test framework.** There are no unit/integration tests, no test runner configured, no pytest.ini, no vitest config. The "tests" are API endpoints (`/api/quality/*-test`) that run in-process against seed data. Don't look for `npm test` or `pytest` — they don't exist.

**No linting or formatting.** No eslint, prettier, ruff, or black config. Code style is informal.

**SMTP credentials are hardcoded.** `backend/auth.py:9` has QQ SMTP credentials in plaintext. Don't commit new secrets — follow this pattern only for dev, and flag it in reviews.

**Jobs data is seeded in code.** `backend/jobs.py` has `SEED_JOBS` — a hardcoded list of 15 jobs (read-only seed for the quality/jobs endpoints). The quality API can optionally load from `backend/test_data/expanded_jobs.json` if it exists. Note: `SEED_JOBS` is **not** the same as the `jobs` DB table — the DB `jobs` table (see `database.py::Job`) holds enterprise-published positions for the enterprise-side TalentSearch/JobManage/Dashboard flows, and is currently empty pending the matching engine + mock data.

**DB models for enterprise talent search.** `database.py` now defines `Job` (enterprise_id, title, salary_min/max, skills_required, status...) and `MatchRecord` (job_id, jobseeker_id, match_score, skill_match, exp_match, salary_match, status...). `match_score` and the three dimension scores are `nullable=True` — they are populated by the matching engine; until then they stay NULL and the frontend must render "暂无匹配数据". Do NOT mock fake scores.

**Resume parsing depends on external APIs.** `backend/resume_parser.py` and `backend/quality_checker.py` likely call external LLM services. They won't work without network access or proper API keys.

**Env file.** `backend/.env.example` documents `DATABASE_URL` and `JWT_SECRET`. `database.py` reads these via `python-dotenv` (`load_dotenv()` called at top of `main.py`). Copy `.env.example` → `.env` for local dev; defaults in `database.py` already point to `localhost:3307`.

## Architecture

```
XINGTU/
├── backend/           # FastAPI app (Python 3.12)
│   ├── main.py        # App entrypoint, mounts routers + /uploads static mount
│   ├── auth.py        # /api/auth — register, login, profile, resume CRUD
│   ├── jobs.py        # /api/jobs — seeded job data + stats (SEED_JOBS, 15 hardcoded)
│   ├── company.py     # /api/company — public enterprise profiles
│   ├── quality_api.py # /api/quality — data quality reports + accuracy tests
│   ├── database.py    # SQLAlchemy models: Jobseeker, Enterprise, VerifyCode, Job, MatchRecord + JWT helpers
│   ├── resume_parser.py    # Resume text → structured extraction (external LLM dep)
│   ├── quality_checker.py  # Data quality analysis (plagiarism, inflation, cross-validation)
│   ├── jd_scraper.py       # JD scraping from Boss/拉勾 (requests-based CLI tool)
│   ├── selenium_scraper.py # JD scraping via Selenium headless Chrome (alt to jd_scraper)
│   ├── .env.example        # Documents DATABASE_URL + JWT_SECRET (copy to .env)
│   └── test_data/          # Seed test data for quality endpoints
├── frontend/          # React 19 + Vite 5 + TypeScript
│   ├── src/
│   │   ├── App.tsx    # Router: role-based shell (JobseekerShell / EnterpriseShell)
│   │   ├── pages/
│   │   │   ├── jobseeker/  # Dashboard, Jobs, SkillGraph, MySkillGraphPage, Resume, Match, LearningPath, Trend, ProfileHome, ProfileEdit
│   │   │   ├── enterprise/ # Dashboard, JobManage, TalentSearch, MarketInsight, IndustryReport, CompanyProfile, QualityDashboard
│   │   │   └── (root)      # Login, RoleSelect
│   │   ├── components/
│   │   │   ├── JobseekerShell.tsx   # Jobseeker layout + nav
│   │   │   ├── EnterpriseShell.tsx # Enterprise layout + nav
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
