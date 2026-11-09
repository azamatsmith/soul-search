from datetime import UTC, datetime, timedelta

from app.auth.lockout import (
    AttemptState,
    code_expired,
    is_locked,
    register_failure,
    register_success,
    tries_left,
)

T0 = datetime(2026, 11, 9, 10, tzinfo=UTC)
MINUTE = timedelta(minutes=1)
SECOND = timedelta(seconds=1)


def fail(state: AttemptState, times: int, at: datetime) -> AttemptState:
    for _ in range(times):
        state = register_failure(state, at)
    return state


def test_fifth_failure_locks_for_15_minutes():
    state = fail(AttemptState(), 5, T0)

    assert state.locked_until == T0 + 15 * MINUTE
    assert state.failed_count == 0


def test_fourth_failure_leaves_one_try():
    state = fail(AttemptState(), 4, T0)

    assert tries_left(state) == 1
    assert not is_locked(state, T0)


def test_lock_ends_exactly_after_15_minutes():
    state = fail(AttemptState(), 5, T0)

    assert is_locked(state, T0 + 15 * MINUTE - SECOND)
    assert not is_locked(state, T0 + 15 * MINUTE)


def test_failure_after_quiet_window_starts_over():
    state = fail(AttemptState(), 4, T0)

    state = register_failure(state, T0 + 15 * MINUTE + SECOND)

    assert state.failed_count == 1
    assert state.locked_until is None


def test_failure_within_window_accumulates():
    state = register_failure(AttemptState(), T0)

    state = register_failure(state, T0 + 14 * MINUTE)

    assert state.failed_count == 2


def test_first_failure_after_lock_counts_as_one():
    state = fail(AttemptState(), 5, T0)

    state = register_failure(state, T0 + 16 * MINUTE)

    assert state.failed_count == 1


def test_success_clears_count_and_lock():
    state = AttemptState(failed_count=3, locked_until=T0, code_sent_at=T0, last_failed_at=T0)

    state = register_success(state)

    assert state == AttemptState(code_sent_at=T0)


def test_code_expired_after_600_seconds():
    state = AttemptState(code_sent_at=T0)

    assert not code_expired(state, T0 + 600 * SECOND)
    assert code_expired(state, T0 + 601 * SECOND)
    assert not code_expired(AttemptState(), T0 + 601 * SECOND)
