from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import psycopg

from app.db import Conn


@dataclass(frozen=True)
class AllowedEmail:
    email: str
    display_name: str | None


class AllowedEmailsRepo(Protocol):
    def list(self) -> tuple[AllowedEmail, ...]: ...

    def add(self, email: str, admin_id: UUID) -> AllowedEmail | None: ...

    def remove(self, email: str) -> bool: ...


class PgAllowedEmailsRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list(self) -> tuple[AllowedEmail, ...]:
        rows = self._conn.execute(
            """
            select a.email, p.display_name
            from public.allowed_emails a
            left join auth.users u on lower(u.email) = a.email
            left join public.players p on p.id = u.id
            order by a.email
            """
        ).fetchall()
        return tuple(AllowedEmail(*row) for row in rows)

    def add(self, email: str, admin_id: UUID) -> AllowedEmail | None:
        row = self._conn.execute(
            """
            insert into public.allowed_emails (email, added_by) values (%s, %s)
            on conflict do nothing returning email
            """,
            (email, admin_id),
        ).fetchone()
        if row is None:
            return None
        return next(entry for entry in self.list() if entry.email == email)

    def remove(self, email: str) -> bool:
        row = self._conn.execute(
            "delete from public.allowed_emails where email = %s returning email", (email,)
        ).fetchone()
        return row is not None


def get_allowed_emails_repo(conn: Conn) -> AllowedEmailsRepo:
    return PgAllowedEmailsRepo(conn)
