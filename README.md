# Smart Building Monitoring System

CET333 Product Development project for the B.Sc. (Hons) Computer Systems
Engineering programme, University of Sunderland. The planned responsive prototype
supports Office Staff and Administrators/Maintenance staff across Building 216,
Building 209 and JS Building, using simulated environmental readings.

The backend now implements WBS 3.2–3.7: PostgreSQL, resource reads, login/JWT/RBAC,
maintenance requests, equipment management, completed maintenance records and
derived building monitoring. WBS 3.8–3.10 now provides the responsive Staff and Admin
frontend, with login, requests, management tools and simulated monitoring. Dashboard-specific
APIs and real IoT are not implemented.

## Stack and architecture

Browser → React / Vite / Tailwind → Axios REST requests → FastAPI → SQLAlchemy → PostgreSQL.
FastAPI reads PostgreSQL using SQLAlchemy sessions; React integrates through the existing REST API.

- Frontend: JavaScript, React, Vite, Tailwind CSS, React Router DOM, Axios, Recharts, Lucide React.
- Backend: Python, FastAPI, Uvicorn, Pydantic, pydantic-settings, SQLAlchemy, Psycopg, Alembic.
- Security: PyJWT and pwdlib with Argon2; STAFF / ADMIN access control.
- Testing: Pytest, HTTPX; Postman for manual API checks.

## Structure

```text
frontend/
  public/
  src/
    assets/ components/ layouts/ pages/ services/ context/ hooks/ utils/
    App.jsx  main.jsx  index.css
  .env.example  package.json  package-lock.json  vite.config.js
backend/
  app/
    core/ models/ schemas/ routers/ services/ db/
    __init__.py  main.py
  tests/
  alembic/versions/
  .env.example  alembic.ini  requirements.txt  pytest.ini  run.py
database/
  seeds/  README.md  verify.sql
docs/
.gitignore
README.md
```

Empty folders have `.gitkeep` files or Python package initializers so Git preserves
the structure. `.venv`, installed packages, local environment files and build output
are ignored. `run.py` is a small launcher that respects APP_HOST and APP_PORT.

## Windows development setup

Use Node.js 24 LTS and Python 3.14 (the versions verified during setup); npm and pip
are required. Git is already initialized. Do not initialize another repository.
Commands below start from this repository root.

Frontend:

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:5173. Use `npm.cmd` to avoid PowerShell script-policy issues.
Build from `frontend/` with `npm.cmd run build`; output goes to `frontend/dist/`.

Backend, in a second terminal starting at the repository root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe run.py
```

The virtual environment already exists after initial setup; recreate it only on a
fresh checkout or when needed. Calling its Python directly avoids activation and
PowerShell execution-policy changes. Stop either server with Ctrl+C.

- API: http://localhost:8000
- API documentation: http://localhost:8000/docs
- Health: http://localhost:8000/api/health

Expected health response:

```json
{"status":"ok","service":"smart-building-monitoring-api"}
```

The API root `/` has no route. Use `/docs` or `/api/health` instead.

## Configuration

Both applications include `.env.example`. No real `.env` is needed for the current
placeholder/health endpoint. When configuration is needed, copy each example to
`.env` in the same directory and replace placeholders locally. Never commit secrets.

Frontend variables prefixed `VITE_` are public. Backend settings load
`backend/.env`; local CORS permits only http://localhost:5173 by default and is
enabled only in development. Use that frontend address consistently.
DATABASE_URL is required for resource APIs, migrations, seeds and database tests, but is unused
by health. JWT_SECRET must be a strong random value of at least 32 bytes;
JWT_ALGORITHM is HS256 and JWT_EXPIRE_MINUTES controls token lifetime.
Never replace an existing `.env` with the example when updating the project.

## PostgreSQL schema and baseline data

Use a running PostgreSQL server (verified with 18.6), database `smart_building`, and
dedicated login `smart_building_app`. Configure its URL in ignored `backend/.env`.
See [database setup instructions](database/README.md) for provisioning and safe
credential entry. Do not recreate an existing database or application role.

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m app.db.seed
```

Baseline: 3 buildings, 9 equipment records and 15 simulated readings. Rerunning
the seed adds no duplicates. This baseline command does not seed users or requests.

## Authentication and request workflow (WBS 3.4–3.5)

Set DEMO_STAFF_PASSWORD, DEMO_ADMIN_PASSWORD and DEMO_MAINTENANCE_ADMIN_PASSWORD
in ignored `backend/.env` to distinct strong passwords of at least 12 characters.
The example contains only CHANGE_ME placeholders. Local random values were generated
with permission during setup; view them only in your local configuration.

From `backend/`, run the separate application seed:

```powershell
.\.venv\Scripts\python.exe -m app.db.seed_demo
```

It creates Demo Staff (STAFF), Demo Admin (ADMIN), Maintenance Admin (ADMIN), four
demo requests and seven status timeline events. Reruns do not duplicate or reset
existing records/password hashes. It also creates three completed maintenance
records: one linked repair record and two preventive maintenance records.

Login at `POST /api/auth/login` with JSON name, password and role. The selected
role must match the database account. Use the returned Bearer token in `/docs`
via **Authorize**. `/api/auth/me` returns the current database user.

Staff submit requests at `POST /api/requests`, list their own at
`GET /api/requests/my`, and view their own details/history. Admins list/filter all
requests, retrieve `/api/users/admins`, assign requests, and update status.
See [backend API instructions](backend/README.md) for the exact endpoints and errors.

Administrators can list and create Office Staff accounts using
`GET /api/users/staff` and `POST /api/users/staff`. Creation accepts name/password,
always assigns STAFF server-side, and stores an Argon2 hash. Multiple Staff accounts
are supported; each sees only their own maintenance requests. Account editing,
deletion, password reset and administrator creation are not implemented.

## Read-only resource APIs (WBS 3.3)

Start the backend as shown above and open http://localhost:8000/docs.
Restart an already-running backend after pulling these changes if it does not reload.

| GET endpoint | Behaviour |
|---|---|
| `/api/buildings` | All buildings ordered by ID |
| `/api/buildings/{building_id}` | One building, or 404 |
| `/api/equipment` | Equipment with nested building details; optional `?building_id=1` |
| `/api/equipment/{equipment_id}` | One equipment record, or 404 |
| `/api/environment` | Latest simulated reading per building, ordered by building ID |
| `/api/environment/{building_id}` | Newest-first history; `?limit=10`, allowed 1–100 |

Collections are plain arrays. Empty collections return 200 with `[]`; unknown
individual resources return 404. History for an existing building with no readings
returns `readings: []`. Invalid parameters use FastAPI's standard 422 response.
Database connectivity failures return 503 with `Database service unavailable`.

All six resource reads now require a valid Bearer JWT for either STAFF or ADMIN.
Only health and login remain public application endpoints.
See [backend details](backend/README.md) for ordering and query behaviour.

## Equipment, maintenance history and monitoring (WBS 3.6–3.7)

Admins can add equipment and update its name/type/location/status. PATCH cannot
move equipment between buildings, and no equipment deletion API is provided.
Completed maintenance is recorded separately from request resolution; linking work
requires a matching RESOLVED request. Preventive work may omit request_id. Recording
work never automatically changes equipment status or request status/timeline.

Authenticated STAFF and ADMIN can read `/api/monitoring/buildings` and
`/api/monitoring/buildings/{building_id}` for equipment/request counts, the latest
simulated environment reading and dynamically derived status:

- CRITICAL: out-of-service equipment or an unresolved HIGH-priority request.
- ATTENTION: otherwise, maintenance-required equipment or an unresolved LOW/MEDIUM request.
- NORMAL: neither condition applies. Environmental values do not affect status.

See [backend API documentation](backend/README.md) for all seven new endpoints.

## Verification

From `frontend/`: `npm.cmd run build`. No lint script is configured. See [frontend verification](docs/frontend-verification.md) for live browser checks and the [frontend guide](frontend/README.md) for routes and local startup.

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic heads
.\.venv\Scripts\python.exe -m alembic history
Invoke-RestMethod http://localhost:8000/api/health
```

The last command requires the backend server running in another terminal. Alembic
heads/history show initial revision `9cf1817549e9`.

## Next task

**WBS 3.11 — Full Integration, Validation, Error Handling and Hardening**.
Not started.
