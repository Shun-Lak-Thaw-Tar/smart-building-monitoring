# Database

PostgreSQL setup and schema implementation are the next phase. Neither a database
connection nor PostgreSQL installation is required for the current health endpoint.

Planned entities: users, buildings, equipment, maintenance_requests,
request_status_history, maintenance_history and environmental_readings.

During the next phase, create the local database and development user, configure
`DATABASE_URL` in the ignored `backend/.env`, implement SQLAlchemy models using
`app.db.base.Base`, import them in `backend/alembic/env.py`, and generate/review the
first migration. Apply migrations only after reviewing them. Store future seed
scripts in `seeds/`; Building 216, Building 209 and JS Building are planned.

No application tables, migrations or seeds have been created yet. Keep all schema
migrations under `backend/alembic/`, not in this directory.
