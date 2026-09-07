from enum import Enum

from pydantic import BaseModel, ConfigDict, SecretStr


class UserRole(str, Enum):
    STAFF = "STAFF"
    ADMIN = "ADMIN"


class LoginRequest(BaseModel):
    name: str
    password: SecretStr
    role: UserRole


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    name: str
    role: UserRole


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserBrief
