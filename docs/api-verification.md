# WBS 3.3 verification — 2026-09-06

Read-only building, equipment and environmental APIs were verified against the
existing PostgreSQL `smart_building` database using ignored local configuration.

- 45 tests passed: all 20 previous checks plus 25 API/error/documentation checks.
- Fresh Uvicorn startup succeeded. Live HTTP checks used port 8001 because the
  existing port 8000 process still served the old health-only application.
- Health and `/docs` returned 200.
- Buildings: 3; equipment: 9; latest environmental summaries: 3.
- Building/equipment detail and equipment building filter returned correct data.
- Environmental history returned newest-first readings and respected limit=2.
- Invalid limits/path types retained FastAPI 422 responses. Missing individual
  resources returned the specified 404 detail messages.
- PostgreSQL API tests checked timestamp-first latest selection, same-time tie
  handling, empty collections, buildings without readings, default/max limits,
  numeric measurement JSON and nested building information.
- Query instrumentation confirmed one SELECT each for equipment and overview.
- An actual Psycopg connection refusal against a reserved non-listening local
  port returned sanitized 503 JSON without stopping the real PostgreSQL service.
- Non-connectivity application errors remained 500 responses.
- OpenAPI exposes only the six new GET endpoints and the existing health route,
  with response schemas, status enum, summaries and expected error documentation.
- All temporary PostgreSQL test changes rolled back. Final counts remained
  3 buildings, 9 equipment, 15 readings, and 0 rows in all four workflow/user tables.
- Alembic current remains `9cf1817549e9 (head)`; check reported no new operations.

No ORM models, constraints, relationships or migrations changed. No authentication,
JWT, write workflows, user seeds or frontend integration were implemented.
Authentication protection is intentionally deferred to WBS 3.4.

To use the normal http://localhost:8000/docs address, restart the existing backend
from the current checkout using `.\.venv\Scripts\python.exe run.py` in `backend/`.
