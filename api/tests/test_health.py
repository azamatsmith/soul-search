import pytest
from fastapi.testclient import TestClient

from app.config import get_cors_origin_regex, get_cors_origins
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


def test_cors_preflight_allows_post_with_authorization(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    client = TestClient(create_app())

    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    methods = response.headers["access-control-allow-methods"]
    assert "POST" in methods
    assert "PUT" in methods


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


PREVIEW_REGEX = r"^https://deploy-preview-\d+--soulsearchapp\.netlify\.app$"


def test_cors_allows_origin_matching_regex(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", PREVIEW_REGEX)
    client = TestClient(create_app())
    origin = "https://deploy-preview-32--soulsearchapp.netlify.app"

    response = client.get("/health", headers={"Origin": origin})

    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize(
    "origin",
    [
        "https://deploy-preview-32--soulsearchapp.netlify.app.evil.example",
        "https://deploy-preview-32--othersite.netlify.app",
        "http://deploy-preview-32--soulsearchapp.netlify.app",
        "https://deploy-preview-abc--soulsearchapp.netlify.app",
    ],
)
def test_cors_regex_blocks_lookalikes(monkeypatch: pytest.MonkeyPatch, origin: str):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", PREVIEW_REGEX)
    client = TestClient(create_app())

    response = client.get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers


def test_cors_regex_unset_allows_no_previews(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("CORS_ORIGIN_REGEX", raising=False)
    client = TestClient(create_app())
    origin = "https://deploy-preview-32--soulsearchapp.netlify.app"

    response = client.get("/health", headers={"Origin": origin})

    assert "access-control-allow-origin" not in response.headers
    assert get_cors_origin_regex() is None


def test_cors_regex_blank_is_unset(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", "  ")

    assert get_cors_origin_regex() is None


def test_cors_regex_invalid_fails_at_startup(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("CORS_ORIGIN_REGEX", "(unclosed")

    with pytest.raises(RuntimeError, match="CORS_ORIGIN_REGEX"):
        create_app()


def test_version_returns_deployed_commit(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("RENDER_GIT_COMMIT", "649ebbe")
    client = TestClient(create_app())

    response = client.get("/version")

    assert response.status_code == 200
    assert response.json() == {"commit": "649ebbe"}


def test_version_is_unknown_outside_render(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("RENDER_GIT_COMMIT", raising=False)
    client = TestClient(create_app())

    response = client.get("/version")

    assert response.json() == {"commit": "unknown"}
