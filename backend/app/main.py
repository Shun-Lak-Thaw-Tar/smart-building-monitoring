from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import DBAPIError

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.errors import database_error_handler
from app.routers import auth, buildings, equipment, environment, maintenance_history, monitoring, requests, users

app = FastAPI(title="Smart Building Monitoring API", version="0.1.0")
app.add_exception_handler(DBAPIError, database_error_handler)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(requests.router)
app.include_router(maintenance_history.router)
app.include_router(monitoring.router)
for resource_router in (buildings.router, equipment.router, environment.router):
    app.include_router(resource_router, dependencies=[Depends(get_current_user)],
                       responses={401: {"description": "Authentication required or invalid token"}})

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
