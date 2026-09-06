import logging

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

logger = logging.getLogger(__name__)


async def database_error_handler(request: Request, exc: DBAPIError) -> JSONResponse:
    sqlstate = getattr(exc.orig, "sqlstate", None)
    connectivity_failure = (
        exc.connection_invalidated
        or isinstance(exc, InterfaceError)
        or isinstance(exc, OperationalError) and (
            sqlstate is None
            or sqlstate.startswith("08")
            or sqlstate in {"53300", "57P01", "57P02", "57P03"}
        )
    )
    if not connectivity_failure:
        # Programming/constraint errors must remain application failures, not 503s.
        raise exc
    # Log diagnostic classifications, never exception text/SQL/URLs/parameters.
    logger.error(
        "Database connectivity failure: method=%s path=%s type=%s sqlstate=%s invalidated=%s",
        request.method, request.url.path, type(exc).__name__, sqlstate, exc.connection_invalidated,
    )
    return JSONResponse(status_code=503, content={"detail": "Database service unavailable"})
