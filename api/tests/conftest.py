import os
from collections.abc import Iterator

import psycopg
import pytest


@pytest.fixture(autouse=True)
def test_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://supabase.test")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-jwt-secret-with-at-least-32-characters")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db.test:5432/test")


TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)


@pytest.fixture
def db_conn() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(TEST_DATABASE_URL)
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()
