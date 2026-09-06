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

Expected Alembic head: `9cf1817549e9` (initial database schema).

Configure DATABASE_URL in the ignored local `.env`, then run:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m app.db.seed
.\.venv\Scripts\python.exe -m alembic check
```

The seven models are registered through `app.models`. Database sessions in
`app.db.session` are created lazily so health startup needs no database connection.
Callers own commits; closing a session rolls back uncommitted work.

The seed adds 3 buildings, 9 equipment records and 15 fixed simulated readings.
Reruns insert only missing baseline rows. No users or workflow history are seeded.
See [database instructions](../database/README.md) for provisioning, constraints,
delete behaviour, timestamps and verification queries.

Database tests require the migrated, seeded PostgreSQL baseline and roll back their
temporary writes. Run only health checks with `python -m pytest -m "not database"`
using the virtual environment Python. Missing DATABASE_URL skips database tests;
a configured connection failure does not.
