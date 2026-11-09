import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.errors import ApiError, register_error_handler


def test_api_error_renders_code_and_extra():
    app = FastAPI()
    register_error_handler(app)

    @app.get("/boom")
    def boom() -> None:
        raise ApiError(423, "locked", locked_until="2026-11-09T10:00:00Z")

    response = TestClient(app).get("/boom")

    assert response.status_code == 423
    assert response.json() == {"error": "locked", "locked_until": "2026-11-09T10:00:00Z"}


def test_get_settings_reads_env():
    settings = get_settings()

    assert settings.supabase_url == "http://supabase.test"
    assert settings.supabase_secret_key == "test-secret-key"
    assert settings.database_url == "postgresql://test:test@db.test:5432/test"


def test_get_settings_jwt_secret_is_optional(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET")

    assert get_settings().supabase_jwt_secret is None


def test_get_settings_names_missing_variable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("DATABASE_URL")

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_settings()


def test_request_validation_error_uses_error_shape():
    app = FastAPI()
    register_error_handler(app)

    @app.post("/echo")
    def echo(body: dict[str, int]) -> dict[str, int]:
        return body

    response = TestClient(app).post("/echo", json={"a": "not-a-number"})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}
