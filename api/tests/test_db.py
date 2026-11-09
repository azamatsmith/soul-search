import psycopg
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.db import get_conn
from app.errors import ApiError, register_error_handler
from tests.conftest import TEST_DATABASE_URL

pytestmark = pytest.mark.db

EMAIL = "kept-on-api-error@example.test"


def test_get_conn_keeps_writes_when_route_returns_api_error(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", TEST_DATABASE_URL)
    app = FastAPI()
    register_error_handler(app)

    @app.post("/write-then-refuse")
    def write_then_refuse(conn: psycopg.Connection = Depends(get_conn)) -> None:  # noqa: B008
        conn.execute("insert into public.sign_in_attempts (email) values (%s)", (EMAIL,))
        raise ApiError(401, "wrong_code")

    try:
        response = TestClient(app).post("/write-then-refuse")

        assert response.status_code == 401
        with psycopg.connect(TEST_DATABASE_URL) as check:
            row = check.execute(
                "select 1 from public.sign_in_attempts where email = %s", (EMAIL,)
            ).fetchone()
        assert row is not None
    finally:
        with psycopg.connect(TEST_DATABASE_URL) as cleanup:
            cleanup.execute("delete from public.sign_in_attempts where email = %s", (EMAIL,))
