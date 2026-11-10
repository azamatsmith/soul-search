from datetime import datetime
from typing import Protocol

import psycopg

from app.auth.lockout import AttemptState
from app.db import Conn


class AttemptsRepo(Protocol):
    def is_allowed(self, email: str) -> bool: ...

    def load_for_update(self, email: str) -> AttemptState: ...

    def save(self, email: str, state: AttemptState, now: datetime) -> None: ...


class PgAttemptsRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def is_allowed(self, email: str) -> bool:
        row = self._conn.execute(
            "select 1 from public.allowed_emails where email = %s", (email,)
        ).fetchone()
        return row is not None

    def load_for_update(self, email: str) -> AttemptState:
        self._conn.execute(
            "insert into public.sign_in_attempts (email) values (%s) on conflict do nothing",
            (email,),
        )
        row = self._conn.execute(
            """
            select failed_count, locked_until, code_sent_at, last_failed_at
            from public.sign_in_attempts where email = %s for update
            """,
            (email,),
        ).fetchone()
        assert row is not None
        return AttemptState(*row)

    def save(self, email: str, state: AttemptState, now: datetime) -> None:
        self._conn.execute(
            """
            update public.sign_in_attempts
            set failed_count = %s, locked_until = %s, code_sent_at = %s,
                last_failed_at = %s, updated_at = %s
            where email = %s
            """,
            (
                state.failed_count,
                state.locked_until,
                state.code_sent_at,
                state.last_failed_at,
                now,
                email,
            ),
        )


def get_attempts_repo(conn: Conn) -> AttemptsRepo:
    return PgAttemptsRepo(conn)
