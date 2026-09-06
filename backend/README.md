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
temporary writes. Run checks that do not need a seeded database with `python -m pytest -m "not database"`
using the virtual environment Python. Missing DATABASE_URL skips database tests;
a configured connection failure does not.

## Read-only APIs — WBS 3.3

Run `.\.venv\Scripts\python.exe run.py` from `backend/` and open
http://localhost:8000/docs for OpenAPI documentation. Restart an existing backend
process if it still serves only the old health route.

Authentication protection is intentionally deferred to WBS 3.4.
These resource reads are temporarily unauthenticated. No user accounts, JWT,
authorization dependencies or application write endpoints are implemented.

| GET endpoint | Query parameters | Response / order |
|---|---|---|
| `/api/buildings` | None | Building array; building_id ASC |
| `/api/buildings/{building_id}` | None | Building object |
| `/api/equipment` | Optional integer building_id | Equipment array; building_id, equipment_name ASC |
| `/api/equipment/{equipment_id}` | None | Equipment object |
| `/api/environment` | None | Array of `{building, reading}`; building_id ASC |
| `/api/environment/{building_id}` | limit: default 10, range 1–100 | `{building, readings}`; recorded_at DESC |

Building objects include ID, name and nullable description. Nested building briefs
include only ID/name. Equipment includes its status enum and timezone-aware creation
timestamp. Measurements validate as Decimal and serialize as JSON numbers; timestamps
retain offsets. Equipment IDs break equal-name ties; reading IDs break equal-time
ties. Timestamp, not ID, determines the latest environmental sample.

The overview omits buildings without readings. History returns `readings: []` for
an existing building without data. All empty collections/filter results return 200
and `[]`, including equipment filtered by an unknown building ID. Individual missing
buildings/equipment return 404 with exactly `Building not found` / `Equipment not found`.
Invalid path/query types and history limits retain standard FastAPI 422 responses.

Each resource request uses the existing `get_session` dependency. It reliably closes
the session and returns the pooled connection without committing. Equipment uses
joined loading for building details; the overview uses a row-number window query
joined to buildings. Each collection needs one SELECT, avoiding per-row building queries.
History uses one building lookup plus one bounded reading query.

Relevant database connection failures return 503:

```json
{"detail":"Database service unavailable"}
```

Server logging records exception class, SQLSTATE, connection invalidation and request
path without raw exception messages, SQL, parameters or credentials. Non-connectivity
database errors and unexpected programming failures remain normal 500 errors. Health
does not depend on a database connection and retains its original response.

Example PowerShell requests while the server runs:

```powershell
Invoke-RestMethod http://localhost:8000/api/buildings
Invoke-RestMethod 'http://localhost:8000/api/equipment?building_id=1'
Invoke-RestMethod http://localhost:8000/api/environment
Invoke-RestMethod 'http://localhost:8000/api/environment/1?limit=2'
```

The complete test suite includes real PostgreSQL-backed API checks, temporary
rollback-only data, query-count checks, numeric serialization, OpenAPI, safe error
responses and real Psycopg connection-refusal handling. No SQLite substitution is used.

Next: **WBS 3.4 — Login, JWT Authentication and Role-Based Access Control** (not started).
