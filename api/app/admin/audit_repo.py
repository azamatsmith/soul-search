from dataclasses import dataclass
from typing import Literal, Protocol
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from app.db import Conn

AuditType = Literal["photo", "score", "emails", "rules", "challenge"]


@dataclass(frozen=True)
class AuditEntry:
    admin_id: UUID
    type: AuditType
    before: dict[str, object] | None
    after: dict[str, object] | None
    target_id: UUID | None = None
    reason: str | None = None


class AuditRepo(Protocol):
    def record(self, entry: AuditEntry) -> None: ...


class PgAuditRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def record(self, entry: AuditEntry) -> None:
        self._conn.execute(
            """
            insert into public.audit_log (admin_id, type, target_id, before, after, reason)
            values (%s, %s, %s, %s, %s, %s)
            """,
            (
                entry.admin_id,
                entry.type,
                entry.target_id,
                Jsonb(entry.before) if entry.before is not None else None,
                Jsonb(entry.after) if entry.after is not None else None,
                entry.reason,
            ),
        )


def get_audit_repo(conn: Conn) -> AuditRepo:
    return PgAuditRepo(conn)
