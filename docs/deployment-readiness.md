# Deployment readiness audit

Audit date: 30 September 2026. Target: Vercel frontend, Render FastAPI service,
Render PostgreSQL, GitHub source. Verdict: **READY FOR HOSTING** after the
deployment-only fixes in this audit, with the manual configuration below.
This is repository readiness, not a claim that a hosted deployment has been tested.

## A. Repository structure

Paths relative to `C:\UOS-13\Product Development\smart-building-monitoring`:

| Component | Path |
| --- | --- |
| Backend root / FastAPI entry | `backend/` / `backend/app/main.py` (`app = FastAPI(...)`) |
| Python dependencies | `backend/requirements.txt` |
| Settings / SQLAlchemy | `backend/app/core/config.py` / `backend/app/db/session.py` |
| JWT / passwords / RBAC | `backend/app/core/security.py`, `backend/app/core/dependencies.py` |
| Alembic | `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/` |
| Baseline / application demo seeds | `backend/app/db/seed.py`, `backend/app/db/seed_demo.py` |
| Frontend root / dependencies | `frontend/`, `frontend/package.json`, `frontend/package-lock.json` |
| Vite / Axios / routing | `frontend/vite.config.js`, `frontend/src/services/apiClient.js`, `frontend/src/App.jsx` |
| Vercel routing | `frontend/vercel.json` |
| Safe configuration examples | `backend/.env.example`, `frontend/.env.example` |
| Ignore rules / existing documentation | `.gitignore`, `README.md`, `backend/README.md`, `frontend/README.md`, `database/README.md` |

Older README seed counts are stale; use the verified counts below.

## B. Render backend

- Root Directory: `backend`
- Runtime: Python; set `PYTHON_VERSION=3.14.6` to match the tested interpreter.
- Build Command: `python -m pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health Check Path: `/api/health`
- Health response: `{"status":"ok","service":"smart-building-monitoring-api"}`.
  This is a process health check; it does not verify database connectivity.
- Do not use `--reload` or the local `run.py` launcher on Render.

All required packages are pinned: FastAPI, Uvicorn, SQLAlchemy, psycopg[binary],
Alembic, Pydantic, pydantic-settings, PyJWT and pwdlib[argon2]. No dependency
version changes were needed. Installed dependency validation passed.

## C. Render PostgreSQL

`DATABASE_URL` is required for database operations; there is no hard-coded local
fallback. Both the app and Alembic read the same settings. Plain `postgresql://`
and legacy `postgres://` URLs are now normalized to `postgresql+psycopg://`,
preserving credentials, hostname, database and query parameters. Explicit driver
URLs remain unchanged. Use Render's internal URL for services in the same region.
Keep external connection TLS options as supplied by Render; do not strip them.

SQLAlchemy uses a cached engine, default QueuePool and `pool_pre_ping=True`.
Each request closes its session; writes own their transaction. Start with one
Uvicorn process and check database connection limits before increasing workers.
Alembic uses NullPool.

Run from `backend/`, with hosted environment variables configured:

```sh
python -m alembic upgrade head
python -m alembic check
python -m app.db.seed
python -m app.db.seed_demo
```

Run migrations as a controlled deployment step before accepting application traffic.
Use Render's pre-deploy command if available for the selected service, or a
controlled one-off execution. Run seeds once after migration, not on every startup.

All 11 migration files are tracked. Single head: `e5f8a3b6c9d0`.
The full test run applied migrations only to the guarded local `_test` database;
its subsequent Alembic check reported no new upgrade operations. No remote
database was accessed.

Baseline seed creates 3 buildings (216, 209, JS), 12 rooms, 40 equipment items
and 15 fixed simulated readings. Each room has air conditioning, lighting and
projector coverage; building-wide items remain valid. Application seed creates
Demo Staff (STAFF), Demo Admin (ADMIN), Maintenance Admin (ADMIN), 4 requests,
7 status events and 3 maintenance records. Passwords come only from environment.
Both seeds use advisory transaction locks and identify existing rows; reruns
avoid duplicates. Demo account passwords are not reset on rerun. Baseline seeding
can restore seeded room assignments, so it is not a general data-reset command.
Some older demo requests retain legacy free-text locations rather than structured
room links. Seeds do not prepopulate safety incidents or every possible alert;
use the existing simulated workflows for those demonstrations.

## D. Vercel frontend

- Framework: Vite; Root Directory: `frontend`
- Install: `npm ci` using the tracked lockfile
- Build: `npm run build`
- Output Directory: `dist`
- Use a compatible Node runtime (Node 22.12+; Vite also supports Node 20.19+).
- Set `VITE_API_BASE_URL=https://YOUR-BACKEND.onrender.com/api` before building.
  This is public, build-time configuration. Rebuild/redeploy after changing it.
- `frontend/vercel.json` now rewrites SPA requests to `/index.html` so direct
  `/login`, `/admin/...`, and `/staff/...` links and refreshes reach React Router.

Axios already uses the Vite variable with a localhost development fallback.
That fallback was the only hard-coded HTTP backend URL in `frontend/src`.
The audited production build used a reserved HTTPS example hostname and confirmed
the localhost fallback was absent from the compiled JavaScript. The example
hostname is for verification only; configure the real backend URL on Vercel.

## E. Environment variables

| Backend variable | Required value or default |
| --- | --- |
| `APP_ENV` | Set `production`; default `development` |
| `DATABASE_URL` | Required Render PostgreSQL secret URL; no default |
| `JWT_SECRET` | Required strong random secret, at least 32 bytes; no default |
| `CORS_ORIGINS` | JSON array of exact frontend origins; see below |
| `JWT_ALGORITHM` | Keep `HS256`; other algorithms are rejected by existing auth |
| `JWT_EXPIRE_MINUTES` | Positive integer; default `30` |
| `DEMO_STAFF_PASSWORD` | Required only for demo seed; distinct secret, at least 12 characters |
| `DEMO_ADMIN_PASSWORD` | Same seed requirement |
| `DEMO_MAINTENANCE_ADMIN_PASSWORD` | Same seed requirement |
| `ENERGY_TARIFF_PER_KWH` | Optional prototype value; default `0.20` |
| `ENERGY_EMISSION_FACTOR_KG_PER_KWH` | Optional prototype value; default `0.45` |
| `APP_HOST`, `APP_PORT` | Local launcher defaults `127.0.0.1`, `8000`; not used by the recommended Render CLI command |
| `TEST_DATABASE_URL` | Tests only; isolated PostgreSQL database ending `_test`; do not point at hosted application data |

Hosting runtime settings: `PYTHON_VERSION=3.14.6`; Render supplies `PORT`.
Frontend application variable: `VITE_API_BASE_URL` only. Never place secrets in
`VITE_*` variables, because they are bundled for the browser.

JWT secret validation rejects missing/placeholder/short values when auth is used.
Passwords use Argon2. Bearer tokens have expiry, and each authenticated request
rechecks the user's database role and active status. Server-side RBAC is unchanged.
Do not use a successful health check as proof that JWT settings are correct.

## F. CORS and HTTPS

CORS previously ran only with `APP_ENV=development`, blocking Vercel in production.
It now applies the existing explicit allowlist in all environments. Credentials
remain disabled; allowed methods remain GET, POST, PATCH, DELETE, OPTIONS; headers
remain Authorization and Content-Type. There is no wildcard allowlist.

Example dashboard value (replace the placeholder, no trailing slash or `/api`):

```json
["http://localhost:5173","http://127.0.0.1:5180","http://127.0.0.1:5190","https://YOUR-FRONTEND.vercel.app"]
```

Add custom domains or deliberately used preview URLs explicitly. The default is
local-only, so a real Vercel origin must be supplied before the hosted browser test.
HTTPS Vercel to HTTPS Render avoids mixed-content requests. Bearer authentication
does not require cross-site cookies or enabling CORS credentials.

## G. Verification and storage

- Full isolated backend suite: `python -m pytest -q -p no:cacheprovider`:
  **227 passed in 43.52 seconds**. Includes auth, database, seed idempotency,
  health, URL normalization and production CORS checks.
- `python -m pip check`: no broken requirements.
- Isolated test database `python -m alembic check`: no new upgrade operations.
- `npm run build`: passed, 2,522 modules, output `frontend/dist`, no build warnings.
  First attempt hit a local sandbox EPERM writing Vite's temp config; rerun with
  filesystem approval passed without a source change.
- Short live local production-mode check: backend health 200, frontend `/login`
  200, invalid login controlled 401 with permitted HTTPS-origin CORS, HTTPS API
  base present in compiled output. Temporary processes were stopped.
- No broad browser regression run or remote deployment was performed. TLS,
  final domain CORS, real hosted login and Vercel rewrites still need hosted checks.
- Core records are in PostgreSQL. CSV exports use browser Blobs; no uploaded files,
  local database files or server-side CSV persistence were found. Browser theme,
  language, draft and session state is client-side. No persistent Render disk is
  required for the inspected runtime.
- Obvious-secret inspection of current tracked source found placeholders and
  generated test credentials, not real embedded secrets. `.env` is ignored and
  untracked; `.env.example` files are safe templates. This was not a Git-history scan.

## H. Changes

- `backend/app/core/config.py`: normalize hosted PostgreSQL schemes to psycopg 3.
- `backend/app/main.py`: enable configured CORS in production.
- `backend/tests/test_deployment_config.py`: focused deployment regression tests.
- `frontend/vercel.json`: SPA rewrite.
- `backend/.env.example`, `frontend/.env.example`: safe hosting guidance.
- `docs/deployment-readiness.md`: this audit and hosting instructions.

No models, authentication rules, business workflows or application routes changed.

## I. Manual hosting steps

1. Make these audited changes available in the GitHub deployment branch when ready;
   this audit did not commit or push them.
2. Create Render PostgreSQL and the Python web service in the same region.
3. Configure the backend root, runtime, build/start commands and secrets above.
4. Apply migrations to the hosted database; confirm `alembic check` is clean.
5. Run baseline seed then demo seed with the three strong demo passwords.
6. Confirm backend health and an authenticated database-backed API work over HTTPS.
7. Create the Vercel Vite project using the frontend settings and real HTTPS API URL.
8. Add the exact resulting Vercel origin to backend `CORS_ORIGINS`; redeploy backend.
9. Redeploy frontend if its API variable changed.
10. Verify Admin/Staff login, RBAC, nested-route refresh, reading and submitting a
    request, reports CSV and demo safety alerts on the hosted domains. Check for
    mixed-content, CORS and unexpected network errors. Verify data survives restart.

## J. Verdict

**READY FOR HOSTING**. Repository blockers identified in this audit are fixed and
local checks pass. Provisioning, real secrets/domains and hosted verification
remain manual deployment steps.

Provider references checked during the audit:
- https://render.com/docs/deploy-fastapi
- https://render.com/docs/python-version
- https://render.com/docs/postgresql-creating-connecting
- https://vercel.com/docs/frameworks/frontend/vite
