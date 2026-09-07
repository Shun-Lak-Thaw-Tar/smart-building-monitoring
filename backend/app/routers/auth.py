from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, dummy_hash, verify_password
from app.db.session import get_session
from app.models import User
from app.schemas.auth import LoginRequest, LoginResponse, UserBrief

router = APIRouter(prefix="/api/auth", tags=["Authentication"], responses={503: {"description": "Database service unavailable"}})


@router.post("/login", response_model=LoginResponse, summary="Log in with name, password and role",
             responses={401: {"description": "Invalid login credentials or role"}})
def login(data: LoginRequest, session: Annotated[Session, Depends(get_session)]):
    user = session.scalar(select(User).where(User.name == data.name))
    valid = verify_password(data.password.get_secret_value(), user.password_hash if user else dummy_hash())
    if not user or not valid or user.role != data.role:
        raise HTTPException(401, "Invalid login credentials or role", headers={"WWW-Authenticate": "Bearer"})
    return LoginResponse(access_token=create_access_token(user),
                         expires_in=settings.jwt_expire_minutes * 60, user=user)


@router.get("/me", response_model=UserBrief, summary="Get current authenticated user",
            responses={401: {"description": "Authentication required or invalid token"}})
def me(user: Annotated[User, Depends(get_current_user)]):
    return user
