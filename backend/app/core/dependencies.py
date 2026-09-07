from typing import Annotated

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core.security import jwt_secret
from app.db.session import get_session
from app.models import User

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    if credentials is None:
        detail = "Invalid or expired token" if request.headers.get("Authorization") else "Authentication required"
        raise HTTPException(401, detail, headers={"WWW-Authenticate": "Bearer"})
    try:
        claims = jwt.decode(credentials.credentials, jwt_secret(), algorithms=["HS256"],
                            options={"require": ["sub", "name", "role", "iat", "exp"]})
        user_id = int(claims["sub"])
        if not -(2 ** 31) <= user_id < 2 ** 31:
            raise ValueError("Invalid subject")
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"}) from None
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(401, "Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    # Current PostgreSQL role is authoritative, including after role changes.
    return user


def require_staff(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "STAFF":
        raise HTTPException(403, "Insufficient permissions")
    return user


def require_admin(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "ADMIN":
        raise HTTPException(403, "Insufficient permissions")
    return user
