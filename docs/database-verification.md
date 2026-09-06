# WBS 3.2 verification — 2026-09-06

Verified against PostgreSQL 18.6 on localhost:5432, database `smart_building`,
dedicated login `smart_building_app`. No credentials are recorded here.

- Initial public schema was empty.
- Generated and reviewed migration `9cf1817549e9_initial_database_schema.py`.
- `alembic upgrade head` succeeded; current/head is `9cf1817549e9`.
- `alembic check` reported no new upgrade operations.
- All seven agreed application tables plus `alembic_version` exist.
- Verified 11 foreign keys with delete actions, 8 CHECK constraints, 2 unique name
  constraints and 17 explicit query indexes, in addition to primary key indexes.
- First seed: 3 buildings, 9 equipment, 15 simulated readings added.
- Second seed: 0 buildings, 0 equipment, 0 readings added.
- Real SELECT/JOIN queries in `database/verify.sql` returned the expected building
  names, all nine equipment records and five timezone-aware samples per building.
- Users, requests, request status history and maintenance history remain empty.
- 20 tests passed, including existing health checks and PostgreSQL constraints,
  schema reflection, migration head, deletion behaviour, uniqueness and idempotency.

The seven-table/column/relationship design is unchanged from the agreed ER baseline.
No login, password hashing, JWT/RBAC logic, feature APIs or frontend integration
was added. WBS 3.3 has not started.
