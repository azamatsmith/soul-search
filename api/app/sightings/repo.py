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


class SightingsRepo(Protocol):
    def period_at(self, at: datetime) -> Period: ...


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
