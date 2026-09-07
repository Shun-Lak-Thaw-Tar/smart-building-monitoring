# Backend

Run all commands below from `backend/` in PowerShell. See the root README for setup.

```powershell
.\.venv\Scripts\python.exe run.py
```

Configuration is loaded from environment variables and optional `backend/.env`.
Health startup does not require database credentials or a JWT secret. Login and
protected endpoints require configured database/JWT settings. CORS is enabled only when `APP_ENV=development`, for the
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

All resource reads require a Bearer JWT. Both STAFF and ADMIN may access them.
Health and login remain public; `/docs` documents the Bearer security scheme.

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
joined to buildings. Each collection needs one resource SELECT plus the current-user
lookup, avoiding per-row building queries. History uses one building lookup plus
one bounded reading query, in addition to authentication.

Relevant database connection failures return 503:

```json
{"detail":"Database service unavailable"}
```

Server logging records exception class, SQLSTATE, connection invalidation and request
path without raw exception messages, SQL, parameters or credentials. Non-connectivity
database errors and unexpected programming failures remain normal 500 errors. Health
does not depend on a database connection and retains its original response.

Example PowerShell requests after assigning the login response's token to a local
variable `$accessToken` (never print or commit it):

```powershell
$authHeaders = @{ Authorization = "Bearer $accessToken" }
Invoke-RestMethod http://localhost:8000/api/buildings -Headers $authHeaders
Invoke-RestMethod 'http://localhost:8000/api/environment/1?limit=2' -Headers $authHeaders
```

The complete test suite includes real PostgreSQL-backed API checks, temporary
rollback-only data, query-count checks, numeric serialization, OpenAPI, safe error
responses and real Psycopg connection-refusal handling. No SQLite substitution is used.

## WBS 3.4 — Login, JWT and roles

In ignored `.env`, configure JWT_SECRET with at least 32 random bytes,
JWT_ALGORITHM=HS256, and a positive JWT_EXPIRE_MINUTES (default 30).
Demo passwords come only from DEMO_STAFF_PASSWORD, DEMO_ADMIN_PASSWORD and
DEMO_MAINTENANCE_ADMIN_PASSWORD. Missing/placeholder passwords or passwords shorter
than 12 characters stop demo seeding clearly. No credentials are embedded in source.

```powershell
.\.venv\Scripts\python.exe -m app.db.seed_demo
```

The separate demo seed creates Demo Staff (STAFF), Demo Admin (ADMIN), and
Maintenance Admin (ADMIN). Argon2 hashes are stored in users.password_hash. Existing
hashes/roles are preserved; conflicting roles cause an error. Changing a password
environment variable does not rotate an existing account's password automatically.

`POST /api/auth/login` accepts JSON `name`, `password`, `role` (STAFF or ADMIN).
All three must match. It returns access_token, token_type=bearer, expires_in in
seconds, and a user object containing only user_id/name/role. JWT claims are sub,
name, role, iat and exp; roles come from the database account. `GET /api/auth/me`
validates signature/expiry and reloads the user. Permission checks use the current
database role, so stale token role claims cannot override account permissions.

Enter the returned token in `/docs` **Authorize**. Restart an old backend before
testing to avoid stale unauthenticated routes. Never print passwords/tokens in
terminal logs or store them in tracked request examples.

| Failure | Status | detail |
|---|---|---|
| Unknown login name, wrong password or selected role | 401 | Invalid login credentials or role |
| Missing token | 401 | Authentication required |
| Invalid/expired token or missing database user | 401 | Invalid or expired token |
| Wrong role for operation | 403 | Insufficient permissions |

401 responses include WWW-Authenticate: Bearer. Database connection failures retain
the sanitized 503 behaviour; unexpected bugs are not converted to 503.

## Administrator Staff account management

`GET /api/users/staff` lists STAFF accounts alphabetically by name, returning a
plain array of user_id/name/role objects (or `[]` when empty). `POST /api/users/staff`
creates an Office Staff account and returns that same safe object with status 201.
Both endpoints require ADMIN; STAFF receives 403 and missing authentication receives 401.

Creation accepts only name and password. Names are trimmed, required, and limited
to 100 characters. Passwords are 8–1024 characters with no complexity rules and
are not trimmed. Passwords use the existing Argon2 helper; plaintext and hashes
are never returned, including in validation errors. The backend always assigns
STAFF. Extra fields, including role, are rejected with standard 422 validation.

An existing name in either role returns 409, `A user with this name already exists`.
The precheck and existing PostgreSQL unique constraint cover concurrent creation;
failed writes roll back. Uniqueness retains the database's existing semantics.

Multiple Staff accounts can log in using name/password/STAFF. Each continues to
access only their own maintenance requests. No editing, deletion, password reset
or administrator-creation API is added. Schema, ERD and authentication architecture
are unchanged; the use-case refinement is Administrator Manage/Create Staff Accounts.

Live verification (fresh server required):

```powershell
.\.venv\Scripts\python.exe scripts/verify_staff_accounts.py --base-url http://127.0.0.1:8002
```

The helper creates a uniquely named temporary Staff account, checks list/login/RBAC,
then deletes only that account directly for test cleanup. It exposes no deletion API.

## WBS 3.5 — Maintenance requests

| Endpoint | Permission |
|---|---|
| GET /api/users/admins | ADMIN; sorted by name, safe user briefs only |
| POST /api/requests | STAFF; returns 201 |
| GET /api/requests/my | STAFF; own requests only |
| GET /api/requests | ADMIN; all requests and filters |
| GET /api/requests/{request_id} | ADMIN any; STAFF own only |
| GET /api/requests/{request_id}/history | ADMIN any; STAFF own only |
| PATCH /api/requests/{request_id}/assign | ADMIN |
| PATCH /api/requests/{request_id}/status | ADMIN |

Create body: building_id, optional equipment_id, room_location, fault_category,
description and priority (LOW/MEDIUM/HIGH). Text is trimmed; lengths are 150, 100,
and 5000 respectively. Empty text and client-supplied server fields are rejected
with 422. Server sets submitted_by to the authenticated staff ID, assigned_to to
NULL and status to PENDING. Missing building/equipment returns 404; equipment in a
different building returns 400, `Equipment does not belong to the selected building`.

Creation inserts the request and initial NULL → PENDING timeline entry in one
transaction. Responses include nested building, optional equipment, submitted_by
and optional assigned_to user briefs; password hashes are never serialized.

Lists sort created_at DESC then request_id DESC. Admin query parameters building_id,
status, priority and search combine with AND. Search trims whitespace, is case-insensitive
substring matching across category, room, description, equipment name and building
name, and allows at most 100 characters. Whitespace-only search is ignored and LIKE
wildcards are escaped as literal characters. No results returns 200 and `[]`.

Unknown request and staff ownership violations both return 404,
`Maintenance request not found`. `/my` is registered before the dynamic ID route.

Assignment body: `assigned_to` integer. Missing assignee returns 404,
`Assignee not found`; STAFF assignee returns 400, `Assignee must be an administrator`.
Assigning the same admin is a no-op. Assignment never adds status history.

Status body: `status` (PENDING/IN_PROGRESS/RESOLVED), optional `note` (max 500,
trimmed; blank becomes NULL). All valid directions, including reopening/correction,
are allowed. Same-status PATCH returns the unchanged resource with no timeline row
or timestamp update. Actual changes update the request and add previous/new status,
current admin actor and note atomically. The existing SQLAlchemy updated_at behaviour
applies. A row lock serializes edits to the same request to prevent stale transitions.

Timeline responses are oldest-first by changed_at/status_history_id and include
nested changed_by user briefs. Request lists eagerly load building/equipment/users;
history eagerly loads actors. No per-row relationship queries are needed.

## Demo data and verification

Run `app.db.seed` for 3 buildings/9 equipment/15 readings, then `app.db.seed_demo`
for 3 users/4 requests/7 timeline rows. Demo statuses are PENDING, IN_PROGRESS,
RESOLVED, PENDING. Fixed UTC submission timestamps and submitter identify demo
requests; advisory locking serializes seed invocations. Existing requests/history
are preserved rather than reset. No maintenance_history records are created.

Tests use PostgreSQL rollback transactions and random temporary test credentials.
Application-data isolation may temporarily remove demo rows inside test transactions;
rollback restores them. Tests target the development baseline, not a production database.

After starting a fresh server, run the live verification helper against its port:

```powershell
.\.venv\Scripts\python.exe scripts/verify_workflow.py --base-url http://127.0.0.1:8001
```

It reads credentials locally, checks login/RBAC and the request workflow, and removes
only its uniquely marked temporary request (timeline rows cascade). It prints neither
tokens nor passwords. Full regression: `.\.venv\Scripts\python.exe -m pytest -q`.

Next: **WBS 3.6 + 3.7 — Equipment Management, Maintenance History and Building Monitoring**.
Not started.
