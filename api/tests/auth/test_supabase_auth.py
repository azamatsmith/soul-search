import json
from collections.abc import Callable

import httpx
import pytest

from app.auth.supabase_auth import AuthSession, AuthUnavailable, SupabaseAuth, TooSoon

SESSION_BODY = {
    "access_token": "access",
    "refresh_token": "refresh",
    "expires_in": 3600,
    "expires_at": 1_800_000_000,
    "token_type": "bearer",
    "user": {"id": "a1111111-1111-1111-1111-111111111111"},
}


def make_auth(handler: Callable[[httpx.Request], httpx.Response]) -> SupabaseAuth:
    return SupabaseAuth("http://supabase.test", "secret", transport=httpx.MockTransport(handler))


def test_send_code_creates_confirmed_user_then_sends_without_signup():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={})

    make_auth(handler).send_code("bob@example.test")

    create, otp = requests
    assert str(create.url) == "http://supabase.test/auth/v1/admin/users"
    assert create.headers["apikey"] == "secret"
    assert json.loads(create.content) == {"email": "bob@example.test", "email_confirm": True}
    assert str(otp.url) == "http://supabase.test/auth/v1/otp"
    assert otp.headers["apikey"] == "secret"
    assert json.loads(otp.content) == {"email": "bob@example.test", "create_user": False}


def test_send_code_existing_user_still_sends():
    paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if request.url.path.endswith("/admin/users"):
            return httpx.Response(422, json={"error_code": "email_exists"})
        return httpx.Response(200, json={})

    make_auth(handler).send_code("bob@example.test")

    assert paths == ["/auth/v1/admin/users", "/auth/v1/otp"]


def test_send_code_create_user_failure_raises_unavailable():
    auth = make_auth(lambda _: httpx.Response(401, json={"error_code": "no_authorization"}))

    with pytest.raises(AuthUnavailable):
        auth.send_code("bob@example.test")


def test_send_code_429_raises_too_soon():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/admin/users"):
            return httpx.Response(422, json={"error_code": "email_exists"})
        return httpx.Response(429, json={"error_code": "over_email_send_rate_limit"})

    with pytest.raises(TooSoon):
        make_auth(handler).send_code("bob@example.test")


def test_verify_code_posts_token():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json=SESSION_BODY)

    make_auth(handler).verify_code("bob@example.test", "123456")

    (request,) = requests
    assert str(request.url) == "http://supabase.test/auth/v1/verify"
    assert json.loads(request.content) == {
        "type": "email",
        "email": "bob@example.test",
        "token": "123456",
    }


def test_verify_code_success_returns_session():
    auth = make_auth(lambda _: httpx.Response(200, json=SESSION_BODY))

    session = auth.verify_code("bob@example.test", "123456")

    assert session == AuthSession(
        access_token="access", refresh_token="refresh", expires_in=3600, expires_at=1_800_000_000
    )


def test_verify_code_rejected_returns_none():
    auth = make_auth(lambda _: httpx.Response(403, json={"error_code": "otp_expired"}))

    assert auth.verify_code("bob@example.test", "123456") is None


def test_server_error_raises_unavailable():
    auth = make_auth(lambda _: httpx.Response(500))

    with pytest.raises(AuthUnavailable):
        auth.verify_code("bob@example.test", "123456")
    with pytest.raises(AuthUnavailable):
        auth.send_code("bob@example.test")


def test_connection_error_raises_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(AuthUnavailable):
        make_auth(handler).verify_code("bob@example.test", "123456")


def test_unavailable_reason_names_request_status_and_code_but_not_email():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/admin/users"):
            return httpx.Response(200, json={})
        return httpx.Response(500, json={"error_code": "unexpected_failure"})

    with pytest.raises(AuthUnavailable) as caught:
        make_auth(handler).send_code("bob@example.test")

    assert str(caught.value) == (
        "POST http://supabase.test/auth/v1/otp returned 500 (unexpected_failure)"
    )
    assert "bob@example.test" not in str(caught.value)


def test_unavailable_reason_shows_wrong_base_path():
    auth = SupabaseAuth(
        "http://supabase.test/rest/v1",
        "secret",
        transport=httpx.MockTransport(lambda _: httpx.Response(404, text="Not Found")),
    )

    with pytest.raises(AuthUnavailable) as caught:
        auth.send_code("bob@example.test")

    assert str(caught.value) == "POST http://supabase.test/rest/v1/auth/v1/admin/users returned 404"


def test_unavailable_reason_for_connection_error_names_request():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no such host", request=request)

    with pytest.raises(AuthUnavailable) as caught:
        make_auth(handler).verify_code("bob@example.test", "123456")

    assert str(caught.value) == "POST http://supabase.test/auth/v1/verify failed: no such host"
