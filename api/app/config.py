import os
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    supabase_jwt_secret: str | None
    database_url: str


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing environment variable {name}")
    return value


def get_settings() -> Settings:
    return Settings(
        supabase_url=_require("SUPABASE_URL").rstrip("/"),
        supabase_secret_key=_require("SUPABASE_SECRET_KEY"),
        supabase_jwt_secret=os.environ.get("SUPABASE_JWT_SECRET") or None,
        database_url=_require("DATABASE_URL"),
    )


def get_cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def get_cors_origin_regex() -> str | None:
    raw = os.environ.get("CORS_ORIGIN_REGEX", "").strip()
    if not raw:
        return None
    try:
        re.compile(raw)
    except re.error as error:
        raise RuntimeError(f"Invalid CORS_ORIGIN_REGEX: {error}") from error
    return raw
