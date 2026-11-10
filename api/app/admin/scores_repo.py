from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import psycopg

from app.db import Conn
from app.sightings.repo import Period, ranked_cte


@dataclass(frozen=True)
class PlayerScore:
    id: UUID
    display_name: str
    points: int


class ScoresRepo(Protocol):
    def players(self, period: Period) -> tuple[PlayerScore, ...]: ...

    def points(self, player_id: UUID, period: Period) -> int | None: ...

    def adjust(
        self, player_id: UUID, admin_id: UUID, period: Period, change: int, reason: str
    ) -> None: ...


def _column(period: Period) -> str:
    return "week_id" if period.kind == "week" else "challenge_id"


class PgScoresRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def players(self, period: Period) -> tuple[PlayerScore, ...]:
        rows = self._conn.execute(
            f"""
            with {ranked_cte(f"{_column(period)} = %(period)s")}
            select p.id, p.display_name, coalesce(r.points, 0)
            from public.players p
            left join ranked r on r.id = p.id
            order by lower(p.display_name), p.id
            """,
            {"period": period.id},
        ).fetchall()
        return tuple(PlayerScore(*row) for row in rows)

    def points(self, player_id: UUID, period: Period) -> int | None:
        row = self._conn.execute(
            f"""
            with {ranked_cte(f"{_column(period)} = %(period)s")}
            select coalesce(r.points, 0)
            from public.players p
            left join ranked r on r.id = p.id
            where p.id = %(player)s
            """,
            {"period": period.id, "player": player_id},
        ).fetchone()
        return row[0] if row else None

    def adjust(
        self, player_id: UUID, admin_id: UUID, period: Period, change: int, reason: str
    ) -> None:
        self._conn.execute(
            f"""
            insert into public.score_adjustments
              (player_id, admin_id, {_column(period)}, change, reason)
            values (%s, %s, %s, %s, %s)
            """,
            (player_id, admin_id, period.id, change, reason),
        )


def get_scores_repo(conn: Conn) -> ScoresRepo:
    return PgScoresRepo(conn)
