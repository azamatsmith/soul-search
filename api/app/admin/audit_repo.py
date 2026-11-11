from dataclasses import dataclass
from datetime import datetime
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


@dataclass(frozen=True)
class HistoryEntry:
    id: UUID
    type: AuditType
    admin_id: UUID
    admin_name: str
    target_name: str | None
    before: dict[str, object] | None
    after: dict[str, object] | None
    reason: str | None
    created_at: datetime


HISTORY_LIMIT = 100


class AuditRepo(Protocol):
    def record(self, entry: AuditEntry) -> None: ...

    def history(self, scores_only: bool) -> tuple[HistoryEntry, ...]: ...


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

    def history(self, scores_only: bool) -> tuple[HistoryEntry, ...]:
        rows = self._conn.execute(
            """
            select a.id, a.type, a.admin_id, admin.display_name,
                   coalesce(score_player.display_name, photo_player.display_name),
                   a.before, a.after, a.reason, a.created_at
            from public.audit_log a
            join public.players admin on admin.id = a.admin_id
            left join public.players score_player
              on a.type = 'score' and score_player.id = a.target_id
            left join public.sightings s on a.type = 'photo' and s.id = a.target_id
            left join public.players photo_player on photo_player.id = s.player_id
            where not %s or a.type = 'score'
            order by a.created_at desc
            limit %s
            """,
            (scores_only, HISTORY_LIMIT),
        ).fetchall()
        return tuple(HistoryEntry(*row) for row in rows)


def get_audit_repo(conn: Conn) -> AuditRepo:
    return PgAuditRepo(conn)
