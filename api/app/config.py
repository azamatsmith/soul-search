import os
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

import psycopg
from psycopg.conninfo import conninfo_to_dict

LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_secret_key: str
    supabase_jwt_secret: str | None
    database_url: str
    anthropic_api_key: str


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
        anthropic_api_key=_require("ANTHROPIC_API_KEY"),
    )


def check_settings() -> Settings:
    settings = get_settings()
    _check_supabase_url(settings.supabase_url)
    _check_database_url(settings.database_url)
    return settings


def _check_supabase_url(url: str) -> None:
    parts = urlsplit(url)
    local = parts.hostname in LOCAL_HOSTS
    if parts.scheme != "https" and not (parts.scheme == "http" and local):
        raise RuntimeError("SUPABASE_URL must use https, like https://<project>.supabase.co")
    if not parts.hostname:
        raise RuntimeError("SUPABASE_URL must include a host")
    if parts.path or parts.query or parts.fragment:
        raise RuntimeError(
            "SUPABASE_URL must not have a path such as /rest/v1; use https://<project>.supabase.co"
        )


def _check_database_url(url: str) -> None:
    if not url.startswith(("postgresql://", "postgres://")):
        raise RuntimeError("DATABASE_URL must be a postgresql:// connection string")
    try:
        parts = conninfo_to_dict(url)
    except psycopg.Error:
        # psycopg's message quotes the string, which can include the password.
        raise RuntimeError(
            "DATABASE_URL could not be parsed; percent-encode special characters in the password"
        ) from None
    if not parts.get("host"):
        raise RuntimeError("DATABASE_URL must include a host")
    if not str(parts.get("port", "5432")).isdigit():
        raise RuntimeError("DATABASE_URL has a port that isn't a number")


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
