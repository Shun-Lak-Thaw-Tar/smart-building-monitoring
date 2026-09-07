from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, SecretStr, StringConstraints, model_validator


class StaffAccountCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    password: SecretStr = Field(min_length=8, max_length=1024)

    @model_validator(mode="before")
    @classmethod
    def redact_password_during_validation(cls, data):
        # Standard 422 errors may include invalid input. Convert before validating
        # so password lengths and other invalid fields never echo plaintext.
        if isinstance(data, dict) and isinstance(data.get("password"), str):
            return {**data, "password": SecretStr(data["password"])}
        return data
