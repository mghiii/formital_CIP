from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.schemas.auth import AuthenticatedUser, Profile


class SupabaseAuthService:
    """Boundary for Supabase Auth validation."""

    async def get_user_from_token(self, token: str) -> AuthenticatedUser:
        settings = get_settings()
        if not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Votre session a expire. Veuillez vous reconnecter.",
            )

        if not settings.supabase_url or not settings.supabase_anon_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service d'authentification non configure.",
            )

        auth_headers = {
            "apikey": settings.supabase_anon_key,
            "Authorization": f"Bearer {token}",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            user_response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers=auth_headers,
            )

            if user_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Votre session a expire. Veuillez vous reconnecter.",
                )

            raw_user = user_response.json()
            user_id = raw_user.get("id")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Utilisateur Supabase invalide.",
                )

            profile_response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/rest/v1/profiles",
                params={"id": f"eq.{user_id}", "select": "*"},
                headers={**auth_headers, "Accept": "application/json"},
            )

            if profile_response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Profil utilisateur inaccessible.",
                )

            profiles = profile_response.json()
            raw_profile = profiles[0] if profiles else None
            return self.build_user(raw_user, raw_profile)

    @staticmethod
    def build_user(raw_user: dict[str, Any], raw_profile: dict[str, Any] | None) -> AuthenticatedUser:
        profile = Profile(**raw_profile) if raw_profile else None
        return AuthenticatedUser(
            id=str(raw_user["id"]),
            email=raw_user.get("email"),
            raw_user=raw_user,
            profile=profile,
        )
