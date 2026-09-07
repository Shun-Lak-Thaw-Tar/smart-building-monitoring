# WBS 3.6 + 3.7 verification — 2026-09-07

## Baseline and staged checks

Inspected Git, equipment/router/schema/session/model structure, demo seeds, tests
and existing Alembic state. The initial 96 tests passed and revision was
`9cf1817549e9 (head)`. Existing source and data were preserved.

- Stage A equipment writes: 15 focused tests passed.
- Stage B maintenance-history reads: 3 focused tests passed.
- Stage C maintenance-history creation: 16 focused tests passed.
- Stage D monitoring: 13 focused tests passed.
- Stage E demo seed/idempotency: passed against PostgreSQL rollback test data.
- Stage F full regression: 141 tests passed, including an additional explicit
  check that resolving a request does not create completed-maintenance records.

## Behaviour verified

Equipment writes require ADMIN. Defaults, trimming, length/enum validation, unknown
building/equipment errors, field restrictions, no building moves and no-op updates
were tested. Existing authenticated reads remain available to both roles.

Maintenance history is ADMIN-only, with safe nested equipment/building/request/user
responses and newest-first ordering. Both filters combine with AND. Equipment-specific
history distinguishes missing equipment from an empty history. Creation validates
equipment, optional matching RESOLVED request, and server-controlled actor/time.
Preventive work and multiple actions per request are supported. Failure injection
verified rollback. Equipment/request state and request timelines remain independent.

Monitoring uses the agreed CRITICAL/ATTENTION/NORMAL precedence. Tests cover every
status condition, resolved HIGH requests, count invariants, latest timestamp/ID
tie-breaking and missing environmental data. Environmental readings are simulated
and display-only. Adding buildings did not increase query count: four monitoring
resource queries plus one current-user lookup. Maintenance lists use one eager-loaded
resource query plus authentication.

## Persistent data and live HTTP

First Batch 2 demo seed added exactly 3 maintenance-history rows and no users,
requests or status events. Second run added zero rows in every category.

Maintenance records: Projector 07 linked repair documentation, Air Conditioner 01
preventive cleaning, and Lighting Zone B preventive inspection. Fixed timestamps
and equipment identify baseline entries; existing records are not reset.

Final expected counts: 3 buildings, 9 equipment, 15 readings, 3 users, 4 requests,
7 request-status-history events and 3 maintenance-history records.

A fresh Uvicorn process on port 8003 passed real PostgreSQL-backed HTTP checks:
staff reads/monitoring, rejected staff writes/history access, admin equipment
creation/status update, preventive maintenance creation, history lists and equipment
history. Building 209 remained CRITICAL because Projector 07 is OUT_OF_SERVICE.
Only uniquely marked temporary verification equipment/history was removed afterward.
No passwords or tokens were displayed by the live helper.

## Design and scope

Alembic remains `9cf1817549e9 (head)` and check reports no new operations. No model,
ERD, database schema, migration or architecture changes. Added exactly the seven
Batch 2 endpoints; no equipment DELETE, environmental writes, dashboard-specific
APIs, frontend implementation or real IoT. Existing use cases cover the implementation;
the API table is updated in the backend README. Frontend WBS 3.8–3.10 is not started.
