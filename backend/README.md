# Backend

Run all commands below from `backend/` in PowerShell. See the root README for setup.

```powershell
.\.venv\Scripts\python.exe run.py
```

Configuration is loaded from environment variables and optional `backend/.env`.
Development defaults allow startup without database credentials or a JWT secret.
JWT settings are reserved for later authentication implementation; no tokens are
issued or validated yet. CORS is enabled only when `APP_ENV=development`, for the
origins in `CORS_ORIGINS` (a JSON array). Production CORS is not configured.

```powershell
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m alembic heads
.\.venv\Scripts\python.exe -m alembic history
```

Empty Alembic heads/history are expected. The migration environment and revision
template are ready, but there are no model tables or revisions. Online migration
commands require PostgreSQL and `DATABASE_URL`; do not run schema migrations yet.
