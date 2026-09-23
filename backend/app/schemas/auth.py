from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, SecretStr, model_validator


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
    is_active: bool


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserBrief


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: SecretStr = Field(min_length=8, max_length=1024)
    new_password: SecretStr = Field(min_length=8, max_length=1024)
    confirm_password: SecretStr = Field(min_length=8, max_length=1024)

    @model_validator(mode="before")
    @classmethod
    def redact_passwords_during_validation(cls, data):
        # Pydantic's normal validation errors include their invalid input. Wrap
        # every password before validation so none can be echoed in a 422 body.
        if isinstance(data, dict):
            return {
                **data,
                **{
                    field: SecretStr(value)
                    for field in ("current_password", "new_password", "confirm_password")
                    if isinstance((value := data.get(field)), str)
                },
            }
        return data
