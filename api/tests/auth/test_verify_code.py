import logging
from datetime import timedelta

import pytest

from app.auth.lockout import AttemptState
from app.auth.supabase_auth import AuthSession, AuthUnavailable
from tests.conftest import T0, AuthHarness

BOB = "bob@example.test"
MINUTE = timedelta(minutes=1)
SESSION = AuthSession(
    access_token="access", refresh_token="refresh", expires_in=3600, expires_at=1_800_000_000
)
JUST_SENT = AttemptState(code_sent_at=T0 - MINUTE)


def verify(h: AuthHarness, code: str = "123456", email: str = BOB):
    return h.client.post("/auth/verify-code", json={"email": email, "code": code})


def test_verify_success_returns_session_and_resets(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = AttemptState(
        failed_count=3, code_sent_at=T0 - MINUTE, last_failed_at=T0 - MINUTE
    )
    auth_harness.supabase.next_verify = SESSION

    response = verify(auth_harness)

    assert response.status_code == 200
    assert response.json() == {
        "access_token": "access",
        "refresh_token": "refresh",
        "expires_in": 3600,
        "expires_at": 1_800_000_000,
    }
    assert auth_harness.attempts.states[BOB].failed_count == 0


def test_verify_wrong_code_401_with_tries_left(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = JUST_SENT

    response = verify(auth_harness)

    assert response.status_code == 401
    assert response.json() == {"error": "wrong_code", "tries_left": 4}
    assert auth_harness.attempts.states[BOB].failed_count == 1


def test_verify_fifth_wrong_locks_423(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = AttemptState(
        failed_count=4, code_sent_at=T0 - MINUTE, last_failed_at=T0 - MINUTE
    )

    response = verify(auth_harness)

    assert response.status_code == 423
    assert response.json() == {"error": "locked", "locked_until": "2026-11-09T10:15:00Z"}
    assert auth_harness.attempts.states[BOB].locked_until == T0 + 15 * MINUTE


def test_verify_while_locked_423_does_not_extend(auth_harness: AuthHarness):
    locked = AttemptState(locked_until=T0 + 5 * MINUTE, code_sent_at=T0 - MINUTE)
    auth_harness.attempts.states[BOB] = locked

    response = verify(auth_harness)

    assert response.status_code == 423
    assert response.json() == {"error": "locked", "locked_until": "2026-11-09T10:05:00Z"}
    assert auth_harness.attempts.states[BOB] == locked
    assert auth_harness.supabase.verified == []


def test_verify_expired_410_counts_as_wrong(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = AttemptState(
        failed_count=2, code_sent_at=T0 - timedelta(seconds=601), last_failed_at=T0 - MINUTE
    )

    response = verify(auth_harness)

    assert response.status_code == 410
    assert response.json() == {"error": "expired"}
    assert auth_harness.attempts.states[BOB].failed_count == 3


def test_verify_fifth_try_on_expired_code_locks_423(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = AttemptState(
        failed_count=4, code_sent_at=T0 - timedelta(seconds=601), last_failed_at=T0 - MINUTE
    )

    response = verify(auth_harness)

    assert response.status_code == 423
    assert auth_harness.attempts.states[BOB].locked_until == T0 + 15 * MINUTE


def test_verify_without_code_sent_counts_as_wrong(auth_harness: AuthHarness):
    response = verify(auth_harness)

    assert response.status_code == 401
    assert response.json() == {"error": "wrong_code", "tries_left": 4}


def test_verify_code_normalizes_email(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = JUST_SENT
    auth_harness.supabase.next_verify = SESSION

    response = verify(auth_harness, email=" Bob@Example.TEST ")

    assert response.status_code == 200
    assert auth_harness.supabase.verified == [(BOB, "123456")]


@pytest.mark.parametrize("code", ["12345", "12a456", "1234567", ""])
def test_verify_rejects_non_six_digit_code_422(auth_harness: AuthHarness, code: str):
    response = verify(auth_harness, code=code)

    assert response.status_code == 422
    assert auth_harness.supabase.verified == []


def test_verify_auth_unavailable_does_not_count(auth_harness: AuthHarness):
    auth_harness.attempts.states[BOB] = JUST_SENT
    auth_harness.supabase.next_verify = AuthUnavailable()

    response = verify(auth_harness)

    assert response.status_code == 502
    assert response.json() == {"error": "auth_unavailable"}
    assert auth_harness.attempts.states[BOB] == JUST_SENT


def test_verify_unknown_email_403(auth_harness: AuthHarness):
    response = verify(auth_harness, email="nobody@example.test")

    assert response.status_code == 403
    assert response.json() == {"error": "not_allowed"}
    assert auth_harness.attempts.states == {}


def test_verify_auth_unavailable_is_logged(
    auth_harness: AuthHarness, caplog: pytest.LogCaptureFixture
):
    auth_harness.attempts.states[BOB] = JUST_SENT
    auth_harness.supabase.next_verify = AuthUnavailable(
        "POST http://supabase.test/auth/v1/otp returned 500"
    )

    with caplog.at_level(logging.WARNING):
        verify(auth_harness)

    messages = [record.getMessage() for record in caplog.records]
    assert any("POST http://supabase.test/auth/v1/otp returned 500" in m for m in messages)
    assert not any(BOB in m for m in messages)
