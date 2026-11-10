from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from app.db import Conn
from app.sightings.repo import PgSightingsRepo


@dataclass(frozen=True)
class CloseOut:
    closed: tuple[UUID, ...]
    current_week_id: UUID


class WeeksRepo(Protocol):
    def close_ended(self, now: datetime) -> CloseOut: ...


class PgWeeksRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn
        self._sightings = PgSightingsRepo(conn)

    def close_ended(self, now: datetime) -> CloseOut:
        ended = self._conn.execute(
            """
            select id, starts_at from public.weeks
            where closed_at is null and ends_at <= %s
            order by starts_at
            for update
            """,
            (now,),
        ).fetchall()
        for week_id, starts_at in ended:
            self._close(week_id, starts_at, now)
        current = self._sightings.week_at(now)
        return CloseOut(closed=tuple(row[0] for row in ended), current_week_id=current.id)

    def _close(self, week_id: UUID, starts_at: datetime, now: datetime) -> None:
        board = self._sightings.leaderboard(self._sightings.week_at(starts_at))
        results = [
            {
                "player_id": str(row.player_id),
                "display_name": row.display_name,
                "rank": row.rank,
                "points": row.points,
                "souls": row.count,
            }
            for row in board.rows
        ]
        self._conn.execute(
            "update public.weeks set closed_at = %s, results = %s where id = %s",
            (now, Jsonb(results), week_id),
        )


def get_weeks_repo(conn: Conn) -> WeeksRepo:
    return PgWeeksRepo(conn)
