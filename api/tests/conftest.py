import pytest


@pytest.fixture(autouse=True)
def test_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "http://supabase.test")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-jwt-secret-with-at-least-32-characters")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test:test@db.test:5432/test")
