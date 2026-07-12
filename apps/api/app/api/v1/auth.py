from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_current_profile, get_current_user, require_roles
from app.schemas.auth import AuthenticatedUser, CurrentUserResponse, Profile, Role

router = APIRouter()


@router.get("/me", response_model=CurrentUserResponse)
async def me(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    profile: Annotated[Profile, Depends(get_current_profile)],
) -> CurrentUserResponse:
    return CurrentUserResponse(user=user, profile=profile)


@router.get("/admin-check", response_model=Profile)
async def admin_check(
    profile: Annotated[Profile, Depends(require_roles(Role.admin))],
) -> Profile:
    return profile
