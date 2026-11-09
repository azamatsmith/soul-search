import pytest
from fastapi.testclient import TestClient

from app.config import get_cors_origins
from app.main import create_app


def test_health_returns_ok(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_default_origin(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app())

    response = client.get("/health", headers={"Origin": "http://localhost:5173"})

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_blocks_unlisted_origin(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app())

    response = client.get("/health", headers={"Origin": "http://evil.example"})

    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_tolerate_spaces_and_trailing_comma(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CORS_ORIGINS", "http://a.example, http://b.example,")
    client = TestClient(create_app())

    for origin in ("http://a.example", "http://b.example"):
        response = client.get("/health", headers={"Origin": origin})
        assert response.headers["access-control-allow-origin"] == origin

    response = client.get("/health", headers={"Origin": ""})
    assert "access-control-allow-origin" not in response.headers
    assert get_cors_origins() == ["http://a.example", "http://b.example"]
