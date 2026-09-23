from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, dummy_hash, hash_password, verify_password
from app.db.session import get_session
from app.models import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, LoginResponse, UserBrief

router = APIRouter(prefix="/api/auth", tags=["Authentication"], responses={503: {"description": "Database service unavailable"}})


@router.post("/login", response_model=LoginResponse, summary="Log in with name, password and role",
             responses={401: {"description": "Invalid login credentials or role"}})
def login(data: LoginRequest, session: Annotated[Session, Depends(get_session)]):
    user = session.scalar(select(User).where(User.name == data.name))
    valid = verify_password(data.password.get_secret_value(), user.password_hash if user else dummy_hash())
    if not user or not valid or not user.is_active or user.role != data.role:
        raise HTTPException(401, "Invalid login credentials or role", headers={"WWW-Authenticate": "Bearer"})
    return LoginResponse(access_token=create_access_token(user),
                         expires_in=settings.jwt_expire_minutes * 60, user=user)


@router.get("/me", response_model=UserBrief, summary="Get current authenticated user",
            responses={401: {"description": "Authentication required or invalid token"}})
def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.post("/change-password", status_code=204, summary="Change the current user's password",
             responses={400: {"description": "Current password is incorrect or new passwords do not match"},
                        401: {"description": "Authentication required"}})
def change_password(
    data: ChangePasswordRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[Session, Depends(get_session)],
):
    if data.new_password.get_secret_value() != data.confirm_password.get_secret_value():
        raise HTTPException(400, "New passwords do not match")
    if not verify_password(data.current_password.get_secret_value(), user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(data.new_password.get_secret_value())
    session.commit()
