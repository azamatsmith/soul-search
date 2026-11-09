from dataclasses import dataclass, replace
from datetime import datetime, timedelta

MAX_WRONG = 5
LOCK_DURATION = timedelta(minutes=15)
FAIL_WINDOW = timedelta(minutes=15)
CODE_LIFETIME = timedelta(seconds=600)


@dataclass(frozen=True)
class AttemptState:
    failed_count: int = 0
    locked_until: datetime | None = None
    code_sent_at: datetime | None = None
    last_failed_at: datetime | None = None


def is_locked(state: AttemptState, now: datetime) -> bool:
    return state.locked_until is not None and state.locked_until > now


def register_failure(state: AttemptState, now: datetime) -> AttemptState:
    window_passed = state.last_failed_at is None or now - state.last_failed_at > FAIL_WINDOW
    count = 1 if window_passed else state.failed_count + 1
    if count >= MAX_WRONG:
        return replace(state, failed_count=0, locked_until=now + LOCK_DURATION, last_failed_at=now)
    return replace(state, failed_count=count, last_failed_at=now)


def register_success(state: AttemptState) -> AttemptState:
    return replace(state, failed_count=0, locked_until=None, last_failed_at=None)


def tries_left(state: AttemptState) -> int:
    return MAX_WRONG - state.failed_count


def code_expired(state: AttemptState, now: datetime) -> bool:
    return state.code_sent_at is not None and now - state.code_sent_at > CODE_LIFETIME
