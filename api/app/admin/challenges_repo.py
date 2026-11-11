from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol
from uuid import UUID

import psycopg
from psycopg.types.json import Jsonb

from app.admin.challenges import Challenge, ChallengeDraft, ChallengeRules
from app.db import Conn
from app.sightings.repo import PgSightingsRepo, ranked_cte
from app.weeks.repo import PgWeeksRepo


@dataclass(frozen=True)
class Winner:
    display_name: str
    points: int


@dataclass(frozen=True)
class ChallengeList:
    running: tuple[Challenge, ...]
    upcoming: tuple[Challenge, ...]
    finished: tuple[tuple[Challenge, Winner | None], ...]


class ChallengesRepo(Protocol):
    def list(self, now: datetime) -> ChallengeList: ...

    def get(self, challenge_id: UUID) -> Challenge | None: ...

    def overlapping(
        self, starts_at: datetime, ends_at: datetime, exclude_id: UUID | None
    ) -> str | None: ...

    def create(self, draft: ChallengeDraft, admin_id: UUID) -> Challenge: ...

    def update(self, challenge_id: UUID, draft: ChallengeDraft) -> Challenge: ...

    def delete(self, challenge_id: UUID) -> None: ...


COLUMNS = "id, name, starts_at, ends_at, rules"


def _challenge(row: tuple[Any, ...]) -> Challenge:
    challenge_id, name, starts_at, ends_at, rules = row
    return Challenge(challenge_id, name, starts_at, ends_at, ChallengeRules.from_json(rules))


class PgChallengesRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def list(self, now: datetime) -> ChallengeList:
        rows = self._conn.execute(
            f"select {COLUMNS} from public.challenges order by starts_at"
        ).fetchall()
        challenges = [_challenge(row) for row in rows]
        finished = [c for c in reversed(challenges) if c.ends_at <= now]
        return ChallengeList(
            running=tuple(c for c in challenges if c.starts_at <= now < c.ends_at),
            upcoming=tuple(c for c in challenges if now < c.starts_at),
            finished=tuple((c, self._winner(c.id)) for c in finished),
        )

    def get(self, challenge_id: UUID) -> Challenge | None:
        row = self._conn.execute(
            f"select {COLUMNS} from public.challenges where id = %s", (challenge_id,)
        ).fetchone()
        return _challenge(row) if row else None

    def overlapping(
        self, starts_at: datetime, ends_at: datetime, exclude_id: UUID | None
    ) -> str | None:
        row = self._conn.execute(
            """
            select name from public.challenges
            where starts_at < %(end)s and %(start)s < ends_at
              and id is distinct from %(exclude)s
            order by starts_at limit 1
            """,
            {"start": starts_at, "end": ends_at, "exclude": exclude_id},
        ).fetchone()
        return row[0] if row else None

    def create(self, draft: ChallengeDraft, admin_id: UUID) -> Challenge:
        row = self._conn.execute(
            f"""
            insert into public.challenges (name, starts_at, ends_at, rules, created_by)
            values (%s, %s, %s, %s, %s)
            returning {COLUMNS}
            """,
            (draft.name, draft.starts_at, draft.ends_at, Jsonb(draft.rules.to_json()), admin_id),
        ).fetchone()
        assert row
        return _challenge(row)

    def update(self, challenge_id: UUID, draft: ChallengeDraft) -> Challenge:
        row = self._conn.execute(
            f"""
            update public.challenges
            set name = %s, starts_at = %s, ends_at = %s, rules = %s
            where id = %s
            returning {COLUMNS}
            """,
            (
                draft.name,
                draft.starts_at,
                draft.ends_at,
                Jsonb(draft.rules.to_json()),
                challenge_id,
            ),
        ).fetchone()
        assert row
        return _challenge(row)

    def delete(self, challenge_id: UUID) -> None:
        found = self._conn.execute(
            "select 1 from public.challenges where id = %s for update", (challenge_id,)
        ).fetchone()
        if not found:
            return
        sightings = PgSightingsRepo(self._conn)
        touched: set[UUID] = set()
        for table, time_column in (("sightings", "taken_at"), ("score_adjustments", "created_at")):
            rows = self._conn.execute(
                f"select id, {time_column} from public.{table} where challenge_id = %s",
                (challenge_id,),
            ).fetchall()
            for row_id, at in rows:
                week_id = sightings.week_at(at).id
                touched.add(week_id)
                self._conn.execute(
                    f"update public.{table} set week_id = %s, challenge_id = null where id = %s",
                    (week_id, row_id),
                )
        self._conn.execute("delete from public.challenges where id = %s", (challenge_id,))
        weeks = PgWeeksRepo(self._conn)
        for week_id in touched:
            weeks.refresh_results(week_id)

    def _winner(self, challenge_id: UUID) -> Winner | None:
        row = self._conn.execute(
            f"""
            with {ranked_cte("challenge_id = %(period)s")}
            select display_name, points from ranked
            order by rank, lower(display_name) limit 1
            """,
            {"period": challenge_id},
        ).fetchone()
        return Winner(*row) if row else None


def get_challenges_repo(conn: Conn) -> ChallengesRepo:
    return PgChallengesRepo(conn)
