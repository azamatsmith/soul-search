from datetime import UTC, datetime

import psycopg
import pytest

from app.auth.attempts_repo import PgAttemptsRepo
from app.auth.lockout import AttemptState
from tests.conftest import TEST_DATABASE_URL

pytestmark = pytest.mark.db

T0 = datetime(2026, 11, 9, 10, tzinfo=UTC)


def test_is_allowed_matches_seeded_email(db_conn: psycopg.Connection):
    repo = PgAttemptsRepo(db_conn)

    assert repo.is_allowed("bob@example.test")
    assert not repo.is_allowed("nobody@example.test")


def test_load_for_update_creates_default_state(db_conn: psycopg.Connection):
    repo = PgAttemptsRepo(db_conn)

    assert repo.load_for_update("new@example.test") == AttemptState()


def test_save_round_trips_state(db_conn: psycopg.Connection):
    repo = PgAttemptsRepo(db_conn)
    state = AttemptState(failed_count=2, locked_until=T0, code_sent_at=T0, last_failed_at=T0)
    repo.load_for_update("bob@example.test")

    repo.save("bob@example.test", state, T0)

    assert repo.load_for_update("bob@example.test") == state


def test_load_for_update_blocks_second_transaction(db_conn: psycopg.Connection):
    PgAttemptsRepo(db_conn).load_for_update("bob@example.test")

    with psycopg.connect(TEST_DATABASE_URL) as other:
        other.execute("set lock_timeout = '200ms'")
        with pytest.raises(psycopg.errors.LockNotAvailable):
            PgAttemptsRepo(other).load_for_update("bob@example.test")
        other.rollback()
