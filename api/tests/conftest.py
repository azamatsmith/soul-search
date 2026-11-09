import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.auth.attempts_repo import get_attempts_repo
from app.auth.supabase_auth import get_supabase_auth
from app.clock import get_now
from app.main import create_app
from tests.fakes import FakeAttemptsRepo, FakeSupabaseAuth

T0 = datetime(2026, 11, 9, 10, tzinfo=UTC)


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


@dataclass
class AuthHarness:
    client: TestClient
    attempts: FakeAttemptsRepo
    supabase: FakeSupabaseAuth


@pytest.fixture
def auth_harness() -> AuthHarness:
    attempts = FakeAttemptsRepo(allowed={"bob@example.test"})
    supabase = FakeSupabaseAuth()
    app = create_app()
    app.dependency_overrides[get_attempts_repo] = lambda: attempts
    app.dependency_overrides[get_supabase_auth] = lambda: supabase
    app.dependency_overrides[get_now] = lambda: T0
    return AuthHarness(TestClient(app), attempts, supabase)
