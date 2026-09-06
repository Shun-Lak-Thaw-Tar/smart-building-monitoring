# PostgreSQL database — WBS 3.2

SQLAlchemy models in `backend/app/models/` and Alembic migrations in
`backend/alembic/versions/` are the authoritative schema. `verify.sql` contains
only read queries, not an alternative schema definition.

## Prerequisites and local configuration

Use PostgreSQL (verified with 18.6), the installed backend dependencies, and a
running server on localhost:5432. The local database is `smart_building`; the
dedicated application login is `smart_building_app`, not the postgres superuser.

On this Windows installation the tools are in `C:\Program Files\PostgreSQL\18\bin`.
Adjust that version directory on another computer:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\pg_isready.exe' -h localhost -p 5432
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U postgres -d postgres -W
```

Only on a fresh installation where the role/database do not exist, run inside psql:

```sql
CREATE ROLE smart_building_app LOGIN;
\password smart_building_app
CREATE DATABASE smart_building OWNER smart_building_app;
```

The password command prompts privately. Existing role/database setup is already
complete locally: do not rerun creation or reset its password unnecessarily.

Copy `backend/.env.example` to `backend/.env` only if `.env` does not already exist.
Set the local connection value without sharing or committing it:

```dotenv
DATABASE_URL=postgresql+psycopg://USERNAME:PASSWORD@localhost:5432/smart_building
```

Replace USERNAME with `smart_building_app` and PASSWORD with its URL-encoded password.
Keep `.env` ignored by Git. No passwords belong in source, shell history or documentation.
The health endpoint remains usable without PostgreSQL. Other database commands
require configuration and report failure when the database cannot be reached.

## Apply and inspect migrations

Run from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
.\.venv\Scripts\python.exe -m alembic history
.\.venv\Scripts\python.exe -m alembic check
```

Expected head: `9cf1817549e9`, initial database schema. The migration was generated
against the empty local database, reviewed, then applied. It creates exactly:
users, buildings, equipment, maintenance_requests, request_status_history,
maintenance_history and environmental_readings. Alembic additionally maintains
its own `alembic_version` table. Do not create application tables manually.

## Seed simulated baseline data

```powershell
.\.venv\Scripts\python.exe -m app.db.seed
```

The seed implementation lives in `backend/app/db/seed.py` to reuse the models and
session configuration. `database/seeds/` is reserved; there is no second seed script.

- Buildings: Building 216, Building 209 and JS Building.
- Equipment: the nine agreed demo records, three per building.
- Environmental readings: five SIMULATED samples per building, 15 total.
- Users, maintenance requests and both history tables: zero seeded records.

Samples have fixed timezone-aware timestamps on 2026-09-01, from 08:00 to 12:00 UTC.
These are historical demo readings, not a live feed. Temperature is 21.50–25.10 °C,
humidity 43–59%, and energy values are positive simulated quantities (110–170).
The application’s presentation/unit convention for energy remains for later design.

Idempotency uses building name, equipment building/name/location, and reading
building/timestamp to detect existing baseline rows. It preserves existing values
and inserts only missing rows. A PostgreSQL advisory transaction lock serializes
concurrent seed runs; it adds no table or schema constraint. All inserts commit
together. The second verified invocation reported zero additions in every category.
This does not impose uniqueness on arbitrary future equipment or reading records.

## Constraints, indexes and timestamps

All IDs are generated integer identities. Names of users/buildings are unique.
Eight named CHECK constraints enforce roles, equipment status, request priority
and status, both history statuses, humidity 0–100 and nonnegative energy. Initial
history previous_status can be NULL; fault_category remains unrestricted text
within VARCHAR(100). Required/optional columns follow the agreed ER design.

Seventeen query indexes cover the requested FK/filter/date fields, including
`environmental_readings(building_id, recorded_at)`. PostgreSQL also creates primary
key and unique-constraint indexes automatically.

Historical-data references use RESTRICT. Deleting a request cascades its status
timeline and sets its service-history request link to NULL. Optional equipment and
assignee links in requests use SET NULL. Equipment referenced by completed service
history is protected by RESTRICT. ORM relationships delegate deletion to these
database rules, including when related collections have already been loaded.

All timestamps are TIMESTAMPTZ with database `now()` creation defaults. PostgreSQL
may display them in the session timezone; they still represent timezone-aware
instants. `maintenance_requests.updated_at` additionally uses SQLAlchemy
`onupdate=func.now()`: updates issued through SQLAlchemy set it automatically when
no explicit value is supplied. Raw SQL updates must set it explicitly. There are
no timestamp triggers or automatic workflow/status-history business logic.

## Verify the real database

Open `verify.sql` in pgAdmin connected to `smart_building`, or run from the repository root:

```powershell
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' -h localhost -U smart_building_app -d smart_building -W -f database/verify.sql
```

Expected: eight public tables including Alembic, 3 building rows, 9 equipment JOIN
rows, 15 reading JOIN rows, and zero rows in the four unseeded application tables.
The queries also show real constraint definitions and indexes.

From `backend/`, run tests after migration and seed:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

Database tests target PostgreSQL, never SQLite. They expect this baseline state;
after later feature data is added, run them against a separately configured seeded
development/test database. Writes use rollback transactions and synthetic negative
IDs. No usable hashes or persistent user/workflow data are created. With no
DATABASE_URL, database tests explicitly skip; health tests still run. A configured
but inaccessible database fails the integration checks.

WBS 3.3 now reads this unchanged schema through building, equipment and environment
APIs. See `backend/README.md`. Next: **WBS 3.4 — Login, JWT Authentication and
Role-Based Access Control** (not started).
