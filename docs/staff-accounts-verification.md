# Staff account enhancement verification — 2026-09-07

- Inspected existing users router, safe user schema, Argon2 helpers, session/RBAC
  dependencies, PostgreSQL-backed test fixtures and existing uncommitted work.
- Previous baseline: 82 tests passed before changes.
- Added exactly GET and POST `/api/users/staff`, both ADMIN-only.
- GET returns STAFF accounts only, ordered by PostgreSQL name ASC then user_id,
  using safe user_id/name/role objects. Empty collection returns 200 and `[]`.
- POST trims/validates names (1–100 characters), accepts passwords of 8–1024
  characters without trimming or complexity rules, rejects extra fields, and
  assigns STAFF server-side. Success returns 201 with a safe user brief.
- Reused existing Argon2 helper, require_admin dependency and SQLAlchemy User model.
- Duplicate names across either role return sanitized 409. An injected race after
  the application precheck exercised the real PostgreSQL UNIQUE constraint and rollback.
- Validation tests confirm that password input is not echoed in 422 responses.
- Full regression: 96 passed (82 previous plus 14 focused tests).
- Fresh Uvicorn server on port 8002 passed real HTTP list/create/login/RBAC checks.
  The new account logged in as STAFF and was rejected when selecting ADMIN; its
  STAFF token received 403 for both staff-management endpoints.
- The live helper removed only its uniquely named temporary account. No account
  deletion/edit/reset or administrator-creation API was introduced.
- Alembic remains `9cf1817549e9 (head)`; check reported no new operations.
- No database, ERD, model, migration, frontend or authentication architecture changes.
  Existing maintenance-request ownership behaviour remains covered and unchanged.

Use-case refinement: Administrator Manage Staff Accounts / Create Staff Account.
No next WBS batch was started.
