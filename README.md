# Smart Building Monitoring System

CET333 Product Development project for the B.Sc. (Hons) Computer Systems
Engineering programme, University of Sunderland. The planned responsive prototype
supports Office Staff and Administrators/Maintenance staff across Building 216,
Building 209 and JS Building, using simulated environmental readings.

This phase provides only the project structure and development environment: a
placeholder frontend and an independent API health endpoint. Authentication,
feature pages, application endpoints, database tables and real IoT are not implemented.

## Stack and architecture

Browser → React / Vite / Tailwind → Axios REST requests → FastAPI → SQLAlchemy → PostgreSQL.
The API/database connections in this architecture are planned for later phases.

- Frontend: JavaScript, React, Vite, Tailwind CSS, React Router DOM, Axios, Recharts, Lucide React.
- Backend: Python, FastAPI, Uvicorn, Pydantic, pydantic-settings, SQLAlchemy, Psycopg, Alembic.
- Future security: PyJWT and pwdlib with Argon2; STAFF / ADMIN access control.
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
  seeds/  README.md
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
DATABASE_URL and JWT settings prepare for later work and are unused by health.

## Verification

From `frontend/`: `npm.cmd run build`.

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic heads
.\.venv\Scripts\python.exe -m alembic history
Invoke-RestMethod http://localhost:8000/api/health
```

The last command requires the backend server running in another terminal. Alembic
heads/history are empty until the first migration is created.

## Next task

**PostgreSQL Database Setup + Schema Implementation**. Configure PostgreSQL and a
local development database, then implement the seven planned entities and initial
migration. See `database/README.md`. This work has not started.
