from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Literal, Protocol
from uuid import UUID

import psycopg
from fastapi import Depends

from app.db import get_conn
from app.sightings.periods import week_bounds
from app.sightings.scoring import Rules


@dataclass(frozen=True)
class Period:
    kind: Literal["week", "challenge"]
    id: UUID
    name: str | None
    starts_at: datetime
    ends_at: datetime
    closed: bool
    rules: Rules


@dataclass(frozen=True)
class Standing:
    points: int
    count: int
    rank: int | None
    total_players: int
    next_rank: int | None
    points_behind_next: int | None
    last_photo_path: str | None


class SightingsRepo(Protocol):
    def period_at(self, at: datetime) -> Period: ...

    def standing(self, player_id: UUID, period: Period) -> Standing: ...


class PgSightingsRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def period_at(self, at: datetime) -> Period:
        settings = self._settings()
        challenge = self._conn.execute(
            """
            select id, name, starts_at, ends_at, rules from public.challenges
            where starts_at <= %s and %s < ends_at
            order by starts_at desc limit 1
            """,
            (at, at),
        ).fetchone()
        if challenge:
            challenge_id, name, starts_at, ends_at, rules = challenge
            return Period(
                kind="challenge",
                id=challenge_id,
                name=name,
                starts_at=starts_at,
                ends_at=ends_at,
                closed=False,
                rules=Rules(
                    regular=rules["regular"],
                    special=rules["special"],
                    false_call=rules["false_call"],
                    categories=settings.categories,
                    bonuses=rules.get("bonuses", {}),
                ),
            )
        start, end = week_bounds(at)
        self._conn.execute(
            """
            insert into public.weeks (starts_at, ends_at) values (%s, %s)
            on conflict (starts_at) do nothing
            """,
            (start, end),
        )
        week = self._conn.execute(
            "select id, starts_at, ends_at, closed_at from public.weeks where starts_at = %s",
            (start,),
        ).fetchone()
        assert week
        week_id, starts_at, ends_at, closed_at = week
        return Period(
            kind="week",
            id=week_id,
            name=None,
            starts_at=starts_at,
            ends_at=ends_at,
            closed=closed_at is not None,
            rules=settings,
        )

    def standing(self, player_id: UUID, period: Period) -> Standing:
        column = "week_id" if period.kind == "week" else "challenge_id"
        row = self._conn.execute(
            f"""
            with totals as (
              select p.id,
                coalesce(s.points, 0) + coalesce(a.points, 0) as points,
                coalesce(s.count, 0) as count
              from public.players p
              left join (
                select player_id, sum(points) as points,
                  count(*) filter (where status <> 'false_call') as count
                from public.sightings where {column} = %(period)s group by player_id
              ) s on s.player_id = p.id
              left join (
                select player_id, sum(change) as points
                from public.score_adjustments where {column} = %(period)s group by player_id
              ) a on a.player_id = p.id
            ),
            ranked as (
              select *, rank() over (order by points desc) as rank from totals
            ),
            me as (select * from ranked where id = %(player)s)
            select
              coalesce(me.points, 0),
              coalesce(me.count, 0),
              me.rank,
              (select count(*) from public.players),
              above.rank,
              above.points - me.points,
              (
                select photo_path from public.sightings
                where player_id = %(player)s and {column} = %(period)s
                order by taken_at desc limit 1
              )
            from (select 1) one
            left join me on true
            left join lateral (
              select rank, points from ranked where points > me.points
              order by points asc limit 1
            ) above on true
            """,
            {"period": period.id, "player": player_id},
        ).fetchone()
        assert row
        points, count, rank, total, next_rank, behind, last_photo = row
        has_sightings = last_photo is not None
        return Standing(
            points=points,
            count=count,
            rank=rank if has_sightings else None,
            total_players=total,
            next_rank=next_rank if has_sightings else None,
            points_behind_next=behind if has_sightings else None,
            last_photo_path=last_photo,
        )

    def _settings(self) -> Rules:
        row = self._conn.execute(
            """
            select regular_points, special_points, false_call_points, special_categories
            from public.settings
            """
        ).fetchone()
        assert row
        regular, special, false_call, categories = row
        return Rules(
            regular=regular,
            special=special,
            false_call=false_call,
            categories=tuple(categories),
            bonuses={},
        )


def get_sightings_repo(conn: Annotated[psycopg.Connection, Depends(get_conn)]) -> SightingsRepo:
    return PgSightingsRepo(conn)
