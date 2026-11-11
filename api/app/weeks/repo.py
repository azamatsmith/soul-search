from dataclasses import dataclass
from datetime import datetime
from typing import Protocol
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from app.db import Conn
from app.sightings.repo import LeaderboardEntry, PgSightingsRepo


@dataclass(frozen=True)
class CloseOut:
    closed: tuple[UUID, ...]
    current_week_id: UUID


@dataclass(frozen=True)
class PastWeek:
    id: UUID
    starts_at: datetime
    ends_at: datetime
    rows: tuple[LeaderboardEntry, ...]


@dataclass(frozen=True)
class PastWeeks:
    weeks: tuple[PastWeek, ...]
    total_players: int


class WeeksRepo(Protocol):
    def close_ended(self, now: datetime) -> CloseOut: ...

    def past(self) -> PastWeeks: ...

    def final(self, week_id: UUID) -> PastWeek | None: ...


FINAL_STANDINGS = """
    select w.id, w.starts_at, w.ends_at,
      r.player_id, coalesce(p.display_name, r.display_name), r.points, r.souls, r.rank
    from public.weeks w
    left join lateral jsonb_to_recordset(w.results)
      as r(player_id uuid, display_name text, rank int, points int, souls int) on true
    left join public.players p on p.id = r.player_id
    where w.closed_at is not null and w.results is not null
      and (%(week)s::uuid is null or w.id = %(week)s::uuid)
    order by w.starts_at desc, r.rank, lower(coalesce(p.display_name, r.display_name))
"""


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

    def past(self) -> PastWeeks:
        total = self._conn.execute("select count(*) from public.players").fetchone()
        assert total
        return PastWeeks(weeks=self._final_standings(None), total_players=total[0])

    def final(self, week_id: UUID) -> PastWeek | None:
        weeks = self._final_standings(week_id)
        return weeks[0] if weeks else None

    def _final_standings(self, week_id: UUID | None) -> tuple[PastWeek, ...]:
        bounds: dict[UUID, tuple[datetime, datetime]] = {}
        rows: dict[UUID, list[LeaderboardEntry]] = {}
        for row in self._conn.execute(FINAL_STANDINGS, {"week": week_id}).fetchall():
            bounds[row[0]] = (row[1], row[2])
            standings = rows.setdefault(row[0], [])
            if row[3] is not None:
                standings.append(LeaderboardEntry(*row[3:]))
        return tuple(
            PastWeek(id=week, starts_at=start, ends_at=end, rows=tuple(rows[week]))
            for week, (start, end) in bounds.items()
        )

    def refresh_results(self, week_id: UUID) -> None:
        row = self._conn.execute(
            "select starts_at from public.weeks where id = %s and closed_at is not null for update",
            (week_id,),
        ).fetchone()
        if row:
            self._conn.execute(
                "update public.weeks set results = %s where id = %s",
                (Jsonb(self._results(row[0])), week_id),
            )

    def _close(self, week_id: UUID, starts_at: datetime, now: datetime) -> None:
        self._conn.execute(
            "update public.weeks set closed_at = %s, results = %s where id = %s",
            (now, Jsonb(self._results(starts_at)), week_id),
        )

    def _results(self, starts_at: datetime) -> list[dict[str, object]]:
        board = self._sightings.leaderboard(self._sightings.week_at(starts_at))
        return [
            {
                "player_id": str(row.player_id),
                "display_name": row.display_name,
                "rank": row.rank,
                "points": row.points,
                "souls": row.count,
            }
            for row in board.rows
        ]


def get_weeks_repo(conn: Conn) -> WeeksRepo:
    return PgWeeksRepo(conn)
