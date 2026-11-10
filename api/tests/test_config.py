import pytest
from fastapi.testclient import TestClient

from app.config import check_settings
from app.main import create_app

GOOD_DATABASE_URL = (
    "postgresql://postgres.ref:s3cret@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
)


@pytest.fixture
def production_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SUPABASE_URL", "https://jlofvstyscyikdehdsck.supabase.co")
    monkeypatch.setenv("DATABASE_URL", GOOD_DATABASE_URL)


@pytest.mark.usefixtures("production_env")
def test_accepts_production_settings():
    assert check_settings().supabase_url == "https://jlofvstyscyikdehdsck.supabase.co"


@pytest.mark.usefixtures("production_env")
def test_requires_an_anthropic_api_key(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY")

    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
        check_settings()


@pytest.mark.parametrize(
    "url", ["http://127.0.0.1:54321", "http://localhost:54321", "https://ref.supabase.co/"]
)
@pytest.mark.usefixtures("production_env")
def test_accepts_local_http_and_trailing_slash(monkeypatch: pytest.MonkeyPatch, url: str):
    monkeypatch.setenv("SUPABASE_URL", url)

    check_settings()


@pytest.mark.parametrize(
    ("url", "problem"),
    [
        ("https://ref.supabase.co/rest/v1", "must not have a path"),
        ("http://ref.supabase.co", "must use https"),
        ("ref.supabase.co", "must use https"),
        ("https://", "must include a host"),
        ("https://ref.supabase.co?x=1", "must not have a path"),
    ],
)
@pytest.mark.usefixtures("production_env")
def test_rejects_bad_supabase_url(monkeypatch: pytest.MonkeyPatch, url: str, problem: str):
    monkeypatch.setenv("SUPABASE_URL", url)

    with pytest.raises(RuntimeError, match=f"SUPABASE_URL {problem}"):
        check_settings()


@pytest.mark.parametrize(
    "database_url",
    [
        "postgresql://user:pa%zzss@host:5432/postgres",
        "postgresql://user:s3cret@host:54x2/postgres",
        "host=db user=postgres password=s3cret",
        "postgresql://user:s3cret@/postgres",
        "mysql://user:s3cret@host/postgres",
    ],
)
@pytest.mark.usefixtures("production_env")
def test_rejects_malformed_database_url_without_echoing_it(
    monkeypatch: pytest.MonkeyPatch, database_url: str
):
    monkeypatch.setenv("DATABASE_URL", database_url)

    with pytest.raises(RuntimeError, match="DATABASE_URL") as caught:
        check_settings()

    message = str(caught.value)
    assert "s3cret" not in message
    assert "zzss" not in message
    assert caught.value.__cause__ is None
    assert caught.value.__context__ is None or caught.value.__suppress_context__


@pytest.mark.usefixtures("production_env")
def test_app_refuses_to_start_with_bad_settings(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SUPABASE_URL", "https://ref.supabase.co/rest/v1")

    with pytest.raises(RuntimeError, match="SUPABASE_URL"), TestClient(create_app()):
        pass


@pytest.mark.usefixtures("production_env")
def test_app_starts_with_good_settings():
    with TestClient(create_app()) as client:
        assert client.get("/health").status_code == 200
