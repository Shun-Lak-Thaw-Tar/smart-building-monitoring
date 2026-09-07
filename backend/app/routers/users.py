from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import require_admin
from app.core.security import hash_password
from app.db.session import get_session
from app.models import User
from app.schemas.auth import UserBrief
from app.schemas.users import StaffAccountCreate

router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(require_admin)],
                   responses={401: {"description": "Authentication required"},
                              403: {"description": "Insufficient permissions"},
                              503: {"description": "Database service unavailable"}})


@router.get("/admins", response_model=list[UserBrief], summary="List administrators for assignment")
def list_admins(session: Annotated[Session, Depends(get_session)]):
    return session.scalars(select(User).where(User.role == "ADMIN").order_by(User.name, User.user_id)).all()


@router.get("/staff", response_model=list[UserBrief], summary="List Office Staff accounts",
            description="Administrators only. Returns STAFF accounts ordered by name.")
def list_staff(session: Annotated[Session, Depends(get_session)]):
    return session.scalars(select(User).where(User.role == "STAFF").order_by(User.name, User.user_id)).all()


@router.post("/staff", response_model=UserBrief, status_code=201, summary="Create an Office Staff account",
             description="Administrators only. The server always assigns STAFF; role input is rejected.",
             responses={409: {"description": "A user with this name already exists"}})
def create_staff(data: StaffAccountCreate, session: Annotated[Session, Depends(get_session)]):
    try:
        if session.scalar(select(User.user_id).where(User.name == data.name)) is not None:
            raise HTTPException(409, "A user with this name already exists")
        user = User(name=data.name, password_hash=hash_password(data.password.get_secret_value()), role="STAFF")
        session.add(user)
        session.flush()
        response = UserBrief.model_validate(user)
        session.commit()
        return response
    except IntegrityError as exc:
        session.rollback()
        # The existing UNIQUE constraint is the final guard against concurrent creation.
        if getattr(exc.orig, "sqlstate", None) == "23505" and getattr(getattr(exc.orig, "diag", None), "constraint_name", None) == "users_name_key":
            raise HTTPException(409, "A user with this name already exists") from None
        raise
    except Exception:
        session.rollback()
        raise
