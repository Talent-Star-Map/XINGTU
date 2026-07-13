# AGENTS.md — XINGTU (星图)

Job capability graph platform. Two services: Python/FastAPI backend + React/Vite/TypeScript frontend, orchestrated via Docker Compose with MySQL.

## Quick Commands

```bash
# Docker (full stack, recommended)
docker compose up -d          # API on :8081, frontend on :3000, MySQL on :3307

# Local dev — start MySQL first, then backend and frontend separately
docker compose up -d mysql    # MySQL on port 3307
cd backend && pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8081 --reload

cd frontend && npm install
npm run dev                   # Vite dev server on :5173, proxies /api → :8081
```

## Architecture

- `backend/` — FastAPI app. Entry: `main.py`. Models in `database.py`. Auth routes in `auth.py`. Single flat package (no submodules).
- `frontend/` — React 19 + Vite 5 + Tailwind 3 + TypeScript. Entry: `src/App.tsx`. Two role-based shells: `JobseekerShell` and `EnterpriseShell`.
- `docker-compose.yml` — MySQL 8.0 + API + frontend (nginx). Health check gates API startup on MySQL readiness.
- `docs/` — Design docs (Chinese), not code.

## Backend Gotchas

- **Port**: Backend runs on **8081**, not the typical 8000.
- **Database URL**: defaults to `mysql+pymysql://root:xingtu123@localhost:3307/xingtu` (local) or `mysql:3306` (Docker). Controlled by `DATABASE_URL` env var.
- **JWT secret**: `JWT_SECRET` env var, defaults to `xingtu-secret-key-2026`.
- **Auth**: JWT tokens passed as **query parameters** (`?token=...`), not in headers. This is unconventional — don't "fix" it without checking all callers.
- **No ORM migrations**: `Base.metadata.create_all()` on startup. Schema changes require manual DB coordination.
- **SMTP credentials hardcoded** in `auth.py` — do not commit new secrets in this pattern.

## Frontend Gotchas

- **Path alias**: `@/*` maps to `src/*` (configured in `tsconfig.json` and `vite.config.ts`).
- **No test framework**: no jest, vitest, or test files exist. Don't add test infrastructure without explicit request.
- **No linter/formatter**: no ESLint or Prettier config. Follow existing style.
- **3D/animation heavy**: uses Three.js (`@react-three/fiber`), GSAP, Framer Motion, d3-force, react-force-graph-3d. These are real dependencies, not placeholders.
- **Dev proxy**: Vite proxies `/api` to `http://localhost:8081` in dev mode.
- **Production**: Docker build uses nginx. `nginx.conf` proxies `/api/` to `http://api:8081`.

## API Convention

All backend routes are under `/api/`. Frontend calls them as `/api/...` (proxied in both dev and prod). Two roles: `jobseeker` and `enterprise`.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Jobseeker | TUTU@qiuzhi.com | TuTu666 |
| Enterprise | XINGXINGHR@zhaopin.com | XingXing666 |

## What NOT to Do

- Do not commit `node_modules/`, `dist/`, `*.db`, or `.env` files.
- Do not add test/lint/CI infrastructure without being asked — this repo has none intentionally.
- Do not change the auth token passing mechanism (query params) without updating all consumers.
- Do not assume a `pyproject.toml` or `setup.py` exists — dependencies are in `requirements.txt` only.
