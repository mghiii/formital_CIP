from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.schemas.auth import AuthenticatedUser, Profile, Role
from app.services.supabase_auth import SupabaseAuthService

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Votre session a expire. Veuillez vous reconnecter.",
        )

    return await SupabaseAuthService().get_user_from_token(credentials.credentials)


async def get_current_profile(user: Annotated[AuthenticatedUser, Depends(get_current_user)]) -> Profile:
    if not user.profile:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Profil utilisateur introuvable.")

    if not user.profile.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Compte utilisateur inactif.")

    return user.profile


def require_roles(*roles: Role):
    allowed = set(roles)

    async def dependency(profile: Annotated[Profile, Depends(get_current_profile)]) -> Profile:
        if profile.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous n'avez pas l'autorisation d'acceder a cette ressource.",
            )
        return profile

    return dependency


def get_request_id(request: Request) -> str:
    return request.headers.get("x-request-id", "local")
