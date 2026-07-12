from functools import lru_cache
from os import getenv

from pydantic import BaseModel


class Settings(BaseModel):
    supabase_url: str = getenv("SUPABASE_URL", "")
    supabase_anon_key: str = getenv("SUPABASE_ANON_KEY", "")
    supabase_service_role_key: str = getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    supabase_jwt_secret: str = getenv("SUPABASE_JWT_SECRET", "")
    database_url: str = getenv("DATABASE_URL", "")
    app_env: str = getenv("APP_ENV", "local")
    cors_origins: list[str] = [
        origin.strip()
        for origin in getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
