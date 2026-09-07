# WBS 3.4 + 3.5 verification — 2026-09-07

## Initial state

Inspected configuration, model/session/router/schema structure, tests and Git.
The existing 45 tests passed before implementation. Alembic was at
`9cf1817549e9 (head)` and no schema changes were needed.

## Staged implementation

- A: Argon2, local demo-user configuration and three-field login — 7 focused tests passed.
- B: Bearer JWT validation, PostgreSQL user lookup, RBAC, protected resource reads
  and administrator lookup — 43 combined auth/resource/error/health tests passed.
- C: Staff creation, own list/detail/history and atomic initial event — 11 workflow tests passed.
- D: Administrator filters/search/assignment — 17 workflow tests passed.
- E: Status updates, reverse transitions, no-op handling and atomic history —
  36 combined auth/workflow tests passed.
- F: Demo request seed, full regression and real HTTP verification completed.

## Results

- Full backend regression: 82 tests passed. Existing query behaviour remains covered
  with authentication added. Resource query counts include the current-user lookup.
- Argon2 hashes are stored for all three demo users. No hash is exposed by response schemas.
- Selected login role is checked against PostgreSQL. JWT roles originate from the
  database user; authorization reloads and uses the current database role.
- Invalid/missing/expired tokens use the specified 401 responses and Bearer challenge.
- Ownership violations for request detail/history use the same 404 as missing records.
- Create/history and update/history failure-injection tests confirm complete rollback.
- Administrator edits lock the affected request row, allowing accurate old/new status events.
- Same assignment/status updates do not add timeline rows; status no-ops preserve updated_at.
- Request lists and nested relationships use eager loading; query-count tests pass.
- PostgreSQL ordering is respected, including its configured text collation.

## Persistent demo seed

With permission, missing JWT/demo credentials were generated randomly into ignored
`backend/.env`. Values were not displayed. Existing database credentials were preserved.

First application seed: 3 users, 4 requests, 7 status events added.
Second application seed: 0 users, 0 requests, 0 status events added.
Baseline remains 3 buildings, 9 equipment and 15 readings. Maintenance history stays empty.

Existing demo records/passwords are preserved on reruns; environment password changes
do not silently rotate existing hashes.

## Live HTTP

A fresh Uvicorn process on port 8001 was used to avoid stale port-8000 code.
The helper in `backend/scripts/verify_workflow.py` verified:

- public health; unauthenticated building reads rejected;
- STAFF/ADMIN login and current-user responses; wrong selected role rejected;
- authenticated counts of 3 buildings, 9 equipment and 3 latest summaries;
- staff own requests, admin request list and admin assignment lookup;
- staff creation, admin assignment, status update and resulting two-entry history.

Only the helper's uniquely marked request was removed afterward, with cascading
timeline cleanup. No passwords/tokens were printed by the live helper.

## Scope

Alembic remains `9cf1817549e9 (head)` with no new operations or migration files.
The existing seven-table ERD is unchanged. No frontend, dashboard, equipment write,
maintenance-history feature or IoT implementation was added. WBS 3.6/3.7 is not started.
