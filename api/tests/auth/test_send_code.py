from datetime import timedelta

from app.auth.lockout import AttemptState
from app.auth.supabase_auth import AuthUnavailable, TooSoon
from tests.conftest import T0, AuthHarness

BOB = "bob@example.test"


def send(h: AuthHarness, email: str = BOB):
    return h.client.post("/auth/send-code", json={"email": email})


def test_send_code_unknown_email_403(auth_harness: AuthHarness):
    response = send(auth_harness, "nobody@example.test")

    assert response.status_code == 403
    assert response.json() == {"error": "not_allowed"}
    assert auth_harness.supabase.sent == []


def test_send_code_sends_and_stamps(auth_harness: AuthHarness):
    response = send(auth_harness)

    assert response.status_code == 204
    assert auth_harness.supabase.sent == [BOB]
    assert auth_harness.attempts.states[BOB].code_sent_at == T0


def test_send_code_normalizes_email(auth_harness: AuthHarness):
    response = send(auth_harness, " Bob@Example.TEST ")

    assert response.status_code == 204
    assert auth_harness.supabase.sent == [BOB]
    assert auth_harness.attempts.states[BOB].code_sent_at == T0


def test_send_code_while_locked_423(auth_harness: AuthHarness):
    locked = AttemptState(locked_until=T0 + timedelta(minutes=10))
    auth_harness.attempts.states[BOB] = locked

    response = send(auth_harness)

    assert response.status_code == 423
    assert response.json() == {"error": "locked", "locked_until": "2026-11-09T10:10:00Z"}
    assert auth_harness.attempts.states[BOB] == locked
    assert auth_harness.supabase.sent == []


def test_send_code_too_soon_429(auth_harness: AuthHarness):
    auth_harness.supabase.next_send = TooSoon()

    response = send(auth_harness)

    assert response.status_code == 429
    assert response.json() == {"error": "too_soon"}
    assert auth_harness.attempts.states[BOB].code_sent_at is None


def test_send_code_auth_unavailable_502(auth_harness: AuthHarness):
    auth_harness.supabase.next_send = AuthUnavailable()

    response = send(auth_harness)

    assert response.status_code == 502
    assert response.json() == {"error": "auth_unavailable"}
