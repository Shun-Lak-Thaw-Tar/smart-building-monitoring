from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import DBAPIError

from app.core.config import settings
from app.db.errors import database_error_handler
from app.routers import buildings, equipment, environment

app = FastAPI(title="Smart Building Monitoring API", version="0.1.0")
app.add_exception_handler(DBAPIError, database_error_handler)
app.include_router(buildings.router)
app.include_router(equipment.router)
app.include_router(environment.router)

if settings.app_env == "development":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "smart-building-monitoring-api"}
