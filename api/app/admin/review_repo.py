from typing import Protocol
from uuid import UUID

import psycopg

from app.admin.review import Decision, ReviewItem
from app.db import Conn
from app.sightings.repo import PgSightingsRepo
from app.sightings.scoring import Rules
from app.weeks.repo import PgWeeksRepo

WAITING = """
    s.reviewed_at is null and s.verified_at is not null
    and (s.flagged or s.status = 'false_call')
"""
ITEM_QUERY = f"""
    select s.id, s.player_id, p.display_name, s.photo_path, s.taken_at, s.claim_type,
      s.categories, s.points, s.status, s.flagged, s.check_note, s.verification_notes,
      s.week_id, s.challenge_id
    from public.sightings s
    join public.players p on p.id = s.player_id
    where {WAITING}
"""


class ReviewRepo(Protocol):
    def queue(self) -> tuple[ReviewItem, ...]: ...

    def find(self, sighting_id: UUID) -> ReviewItem | None: ...

    def rules_for(self, item: ReviewItem) -> Rules: ...

    def resolve(self, sighting_id: UUID, decision: Decision, admin_id: UUID) -> bool: ...


class PgReviewRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def queue(self) -> tuple[ReviewItem, ...]:
        rows = self._conn.execute(f"{ITEM_QUERY} order by s.taken_at desc, s.id").fetchall()
        return tuple(_item(row) for row in rows)

    def find(self, sighting_id: UUID) -> ReviewItem | None:
        row = self._conn.execute(f"{ITEM_QUERY} and s.id = %s", (sighting_id,)).fetchone()
        return _item(row) if row else None

    def rules_for(self, item: ReviewItem) -> Rules:
        return PgSightingsRepo(self._conn).period_at(item.taken_at).rules

    def resolve(self, sighting_id: UUID, decision: Decision, admin_id: UUID) -> bool:
        row = self._conn.execute(
            f"""
            update public.sightings s
            set status = %s, claim_type = %s, categories = %s, points = %s,
              flagged = false, check_note = null, reviewed_at = now(), reviewed_by = %s
            where s.id = %s and {WAITING}
            returning s.week_id
            """,
            (
                decision.status,
                decision.claim_type,
                list(decision.categories),
                decision.points,
                admin_id,
                sighting_id,
            ),
        ).fetchone()
        if row is None:
            return False
        if row[0] is not None:
            PgWeeksRepo(self._conn).refresh_results(row[0])
        return True


def _item(row: tuple) -> ReviewItem:
    return ReviewItem(
        id=row[0],
        player_id=row[1],
        display_name=row[2],
        photo_path=row[3],
        taken_at=row[4],
        claim_type=row[5],
        categories=tuple(row[6]),
        points=row[7],
        status=row[8],
        flagged=row[9],
        check_note=row[10],
        verification_notes=row[11],
        week_id=row[12],
        challenge_id=row[13],
    )


def get_review_repo(conn: Conn) -> ReviewRepo:
    return PgReviewRepo(conn)
