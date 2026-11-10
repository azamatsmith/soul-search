from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol
from uuid import UUID

import psycopg

from app.verification.outcome import Claim, Outcome

LEASE = timedelta(minutes=10)
GAVE_UP_NOTE = "We couldn't check this photo, so a person will take a look."


@dataclass(frozen=True)
class PendingSighting:
    id: UUID
    photo_path: str
    claim: Claim
    attempts: int


class VerificationRepo(Protocol):
    def claim_due(self, now: datetime, limit: int) -> list[PendingSighting]: ...

    def save_outcome(self, sighting_id: UUID, outcome: Outcome, now: datetime) -> None: ...

    def schedule_retry(self, sighting_id: UUID, error: str, next_attempt_at: datetime) -> None: ...

    def give_up(self, sighting_id: UUID, error: str, now: datetime) -> None: ...

    def commit(self) -> None: ...


class PgVerificationRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def claim_due(self, now: datetime, limit: int) -> list[PendingSighting]:
        # The lease pushes next_attempt_at forward, so a crash mid-check retries later.
        rows = self._conn.execute(
            """
            with due as (
              select s.id, s.next_attempt_at as due_at,
                coalesce((c.rules ->> 'false_call')::int, settings.false_call_points)
                  as false_call_points
              from public.sightings s
              left join public.challenges c on c.id = s.challenge_id
              cross join public.settings settings
              where s.verified_at is null and s.status = 'waiting_review'
                and s.next_attempt_at <= %(now)s
              order by s.next_attempt_at
              limit %(limit)s
              for update of s skip locked
            )
            update public.sightings s
            set verify_attempts = s.verify_attempts + 1,
                next_attempt_at = %(lease_until)s
            from due
            where s.id = due.id
            returning s.id, s.photo_path, s.claim_type, s.categories, s.points,
              due.false_call_points, s.verify_attempts, due.due_at
            """,
            {"now": now, "limit": limit, "lease_until": now + LEASE},
        ).fetchall()
        return [
            PendingSighting(
                id=sighting_id,
                photo_path=photo_path,
                claim=Claim(
                    claim_type=claim_type,
                    categories=tuple(categories),
                    points=points,
                    false_call_points=false_call_points,
                ),
                attempts=attempts,
            )
            for (
                sighting_id,
                photo_path,
                claim_type,
                categories,
                points,
                false_call_points,
                attempts,
                _due_at,
            ) in sorted(rows, key=lambda r: r[7])
        ]

    def save_outcome(self, sighting_id: UUID, outcome: Outcome, now: datetime) -> None:
        self._conn.execute(
            """
            update public.sightings
            set status = %s, flagged = %s, points = %s, check_note = %s,
                verification_notes = %s, plate_number = %s, plate_state = %s,
                verified_at = %s, last_verify_error = null
            where id = %s and verified_at is null
            """,
            (
                outcome.status,
                outcome.flagged,
                outcome.points,
                outcome.check_note,
                outcome.verification_notes,
                outcome.plate_number,
                outcome.plate_state,
                now,
                sighting_id,
            ),
        )

    def schedule_retry(self, sighting_id: UUID, error: str, next_attempt_at: datetime) -> None:
        self._conn.execute(
            """
            update public.sightings set last_verify_error = %s, next_attempt_at = %s
            where id = %s and verified_at is null
            """,
            (error, next_attempt_at, sighting_id),
        )

    def give_up(self, sighting_id: UUID, error: str, now: datetime) -> None:
        self._conn.execute(
            """
            update public.sightings
            set status = 'counted', flagged = true, check_note = %s,
                last_verify_error = %s, verified_at = %s
            where id = %s and verified_at is null
            """,
            (GAVE_UP_NOTE, error, now, sighting_id),
        )

    def commit(self) -> None:
        self._conn.commit()
