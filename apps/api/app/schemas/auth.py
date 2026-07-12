from enum import Enum
from typing import Any

from pydantic import BaseModel


class Role(str, Enum):
    operator = "operator"
    engineer = "engineer"
    admin = "admin"


class Profile(BaseModel):
    id: str
    full_name: str | None = None
    username: str | None = None
    email: str | None = None
    role: Role
    rfid_badge_id: str | None = None
    is_active: bool


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None
    raw_user: dict[str, Any]
    profile: Profile | None = None


class CurrentUserResponse(BaseModel):
    user: AuthenticatedUser
    profile: Profile
