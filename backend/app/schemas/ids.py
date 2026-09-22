"""Validation types for values stored in PostgreSQL INTEGER columns."""
from typing import Annotated

from fastapi import Path, Query
from pydantic import Field


POSTGRES_INTEGER_MAX = 2_147_483_647

# Application identifiers are positive PostgreSQL INTEGER values. Keep validation
# at the API boundary so out-of-range values never reach the database driver.
DatabaseId = Annotated[int, Field(ge=1, le=POSTGRES_INTEGER_MAX)]
PathDatabaseId = Annotated[int, Path(ge=1, le=POSTGRES_INTEGER_MAX)]
OptionalQueryDatabaseId = Annotated[int | None, Query(ge=1, le=POSTGRES_INTEGER_MAX)]
