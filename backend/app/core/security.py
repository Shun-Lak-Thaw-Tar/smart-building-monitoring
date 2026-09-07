from datetime import datetime, timedelta, timezone
from functools import lru_cache
import secrets

import jwt
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError

from app.core.config import settings
from app.models import User

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return password_hasher.verify(password, stored_hash)
    except UnknownHashError:
        return False


@lru_cache
def dummy_hash() -> str:
    """Unknown names still perform an Argon2 verification."""
    return hash_password(secrets.token_urlsafe(32))


def jwt_secret() -> str:
    secret = settings.jwt_secret
    if not secret or secret == "CHANGE_ME" or len(secret.encode()) < 32:
        raise RuntimeError("Configure JWT_SECRET with at least 32 random bytes in backend/.env.")
    if settings.jwt_algorithm != "HS256" or settings.jwt_expire_minutes <= 0:
        raise RuntimeError("JWT_ALGORITHM must be HS256 and JWT_EXPIRE_MINUTES must be positive.")
    return secret


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({
        "sub": str(user.user_id), "name": user.name, "role": user.role,
        "iat": now, "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }, jwt_secret(), algorithm="HS256")
