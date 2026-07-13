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

- `backend/` — 6 files, flat package. Entry: `main.py`. Models in `database.py`. Auth routes in `auth.py`. No submodules.
- `frontend/` — React 19 + Vite 5 + Tailwind 3 + TypeScript. Entry: `src/App.tsx` → `src/main.tsx`. Two role shells: `JobseekerShell`, `EnterpriseShell`.
- `docker-compose.yml` — MySQL 8.0 + API (uvicorn) + frontend (nginx). Health check gates API startup on MySQL readiness.
- `docs/` — Design docs (Chinese), not code.

## Backend Gotchas

- **Port**: 8081, not 8000.
- **Database URL**: `mysql+pymysql://root:xingtu123@localhost:3307/xingtu` (local) or `mysql:3306` (Docker). Controlled by `DATABASE_URL` env var. Documented in `backend/.env.example`.
- **JWT secret**: `JWT_SECRET` env var, defaults to `xingtu-secret-key-2026`.
- **Auth**: JWT tokens passed as **query parameters** (`?token=...`), not in headers. Do not "fix" without updating all callers.
- **No ORM migrations**: `Base.metadata.create_all()` on startup. Schema changes require manual DB coordination.
- **SMTP credentials**: Hardcoded in `auth.py:9`. Email fallback — if SMTP fails, the verification code is printed to stdout instead.
- **Dependencies**: `requirements.txt` only. No `pyproject.toml` or `setup.py`.

## Frontend Gotchas

- **Path alias**: `@/*` maps to `src/*` (tsconfig.json + vite.config.ts).
- **No test framework**: No jest, vitest, or test files exist. Don't add test infrastructure without explicit request.
- **No linter/formatter**: No ESLint or Prettier. Follow existing style.
- **3D/animation heavy**: Uses Three.js (`@react-three/fiber`), GSAP, Framer Motion, d3-force, react-force-graph-3d, ogl, recharts.
- **Auth token in localStorage**: Keys `xingtu_token`, `xingtu_role`, `xingtu_user`, plus `xingtu_theme` for theme. Read directly by pages (e.g., `ProfileEdit.tsx:11`, `ProfileHome.tsx:16`) and passed as `?token=` in API calls.
- **⚠️ handleLogin bug**: `App.tsx:32` overwrites the real JWT with `'demo_token'` after login. This breaks profile API calls that read `xingtu_token` from localStorage. If debugging auth, account for this.
- **Dev proxy**: Vite proxies `/api` → `http://localhost:8081` in dev mode.
- **Production**: Docker build uses nginx. `nginx.conf` proxies `/api/` → `http://api:8081`.

## API Convention

All backend routes under `/api/`. Two roles: `jobseeker` and `enterprise`. Frontend routes: `/` (role select), `/login/:role`, then role-specific shells.

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Jobseeker | TUTU@qiuzhi.com | TuTu666 |
| Enterprise | XINGXINGHR@zhaopin.com | XingXing666 |

## What NOT to Do

- Do not commit `node_modules/`, `dist/`, `*.db`, or `.env` files.
- Do not add test/lint/CI infrastructure without being asked — this repo has none intentionally.
- Do not change the auth token passing mechanism (query params) without updating all consumers.
