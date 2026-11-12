from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.verification.outcome import Outcome
from app.verification.repo import LEASE, PgVerificationRepo

pytestmark = pytest.mark.db

BOB = UUID("b2222222-2222-2222-2222-222222222222")
NOW = datetime(2030, 6, 12, 18, tzinfo=UTC)


def add_week(conn: psycopg.Connection) -> UUID:
    row = conn.execute(
        "insert into public.weeks (starts_at, ends_at) values (%s, %s) returning id",
        (NOW - timedelta(days=2), NOW + timedelta(days=5)),
    ).fetchone()
    assert row
    return row[0]


def add_challenge(conn: psycopg.Connection, false_call: int) -> UUID:
    row = conn.execute(
        """
        insert into public.challenges (name, starts_at, ends_at, rules)
        values ('Brown Week', %s, %s, %s) returning id
        """,
        (
            NOW - timedelta(hours=1),
            NOW + timedelta(hours=3),
            Jsonb({"regular": 1, "false_call": false_call, "categories": []}),
        ),
    ).fetchone()
    assert row
    return row[0]


def add_sighting(
    conn: psycopg.Connection,
    period_id: UUID,
    *,
    kind: str = "week",
    claim_type: str = "regular",
    categories: list[str] | None = None,
    points: int = 1,
    status: str = "waiting_review",
    next_attempt_at: datetime = NOW - timedelta(minutes=1),
    verified_at: datetime | None = None,
) -> UUID:
    sighting_id = uuid4()
    conn.execute(
        f"""
        insert into public.sightings (
          id, player_id, photo_path, taken_at, claim_type, categories, points, status,
          next_attempt_at, verified_at, {kind}_id
        ) values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            sighting_id,
            BOB,
            f"{BOB}/{sighting_id}.jpg",
            NOW,
            claim_type,
            categories or [],
            points,
            status,
            next_attempt_at,
            verified_at,
            period_id,
        ),
    )
    return sighting_id


def row(conn: psycopg.Connection, sighting_id: UUID) -> dict[str, object]:
    cursor = conn.execute(
        """
        select status, flagged, points, check_note, verification_notes, plate_number,
          plate_state, verified_at, verify_attempts, next_attempt_at, last_verify_error
        from public.sightings where id = %s
        """,
        (sighting_id,),
    )
    values = cursor.fetchone()
    assert values and cursor.description
    return {column.name: value for column, value in zip(cursor.description, values, strict=True)}


def test_claim_due_returns_due_sightings_with_their_false_call_points(db_conn):
    week = add_week(db_conn)
    sighting_id = add_sighting(
        db_conn, week, claim_type="special", categories=["Brown paint"], points=2
    )

    (pending,) = PgVerificationRepo(db_conn).claim_due(NOW, limit=5)

    assert pending.id == sighting_id
    assert pending.photo_path == f"{BOB}/{sighting_id}.jpg"
    assert pending.claim.claim_type == "special"
    assert pending.claim.categories == ("Brown paint",)
    assert pending.claim.points == 2
    assert pending.claim.false_call_points == -1
    assert pending.attempts == 1


def test_claim_due_uses_the_challenge_false_call_points(db_conn):
    challenge = add_challenge(db_conn, false_call=-4)
    add_sighting(db_conn, challenge, kind="challenge")

    (pending,) = PgVerificationRepo(db_conn).claim_due(NOW, limit=5)

    assert pending.claim.false_call_points == -4


def test_claim_due_leases_the_sighting_so_it_is_not_claimed_twice(db_conn):
    week = add_week(db_conn)
    sighting_id = add_sighting(db_conn, week)
    repo = PgVerificationRepo(db_conn)

    repo.claim_due(NOW, limit=5)

    assert repo.claim_due(NOW, limit=5) == []
    claimed = row(db_conn, sighting_id)
    assert claimed["verify_attempts"] == 1
    assert claimed["next_attempt_at"] == NOW + LEASE


def test_claim_due_skips_future_verified_and_resolved_sightings(db_conn):
    week = add_week(db_conn)
    add_sighting(db_conn, week, next_attempt_at=NOW + timedelta(minutes=1))
    add_sighting(db_conn, week, verified_at=NOW)
    add_sighting(db_conn, week, status="counted")

    assert PgVerificationRepo(db_conn).claim_due(NOW, limit=5) == []


def test_claim_due_takes_the_oldest_first_up_to_the_limit(db_conn):
    week = add_week(db_conn)
    newer = add_sighting(db_conn, week, next_attempt_at=NOW - timedelta(minutes=1))
    older = add_sighting(db_conn, week, next_attempt_at=NOW - timedelta(minutes=5))

    claimed = PgVerificationRepo(db_conn).claim_due(NOW, limit=1)

    assert [p.id for p in claimed] == [older]
    assert newer != older


def test_save_outcome_resolves_the_sighting(db_conn):
    week = add_week(db_conn)
    sighting_id = add_sighting(db_conn, week)

    PgVerificationRepo(db_conn).save_outcome(
        sighting_id,
        Outcome(
            status="false_call",
            flagged=False,
            points=-1,
            check_note="Not a Soul.",
            verification_notes="A Honda Element.",
            plate_number="8ABC123",
            plate_state=None,
        ),
        NOW,
    )

    saved = row(db_conn, sighting_id)
    assert saved["status"] == "false_call"
    assert saved["flagged"] is False
    assert saved["points"] == -1
    assert saved["check_note"] == "Not a Soul."
    assert saved["verification_notes"] == "A Honda Element."
    assert saved["plate_number"] == "8ABC123"
    assert saved["plate_state"] is None
    assert saved["verified_at"] == NOW


def test_schedule_retry_records_the_error_and_next_attempt(db_conn):
    week = add_week(db_conn)
    sighting_id = add_sighting(db_conn, week)

    PgVerificationRepo(db_conn).schedule_retry(sighting_id, "overloaded", NOW + timedelta(hours=1))

    saved = row(db_conn, sighting_id)
    assert saved["last_verify_error"] == "overloaded"
    assert saved["next_attempt_at"] == NOW + timedelta(hours=1)
    assert saved["verified_at"] is None


def test_give_up_counts_the_photo_and_flags_it_for_a_person(db_conn):
    week = add_week(db_conn)
    sighting_id = add_sighting(db_conn, week, points=2)

    PgVerificationRepo(db_conn).give_up(sighting_id, "overloaded", NOW)

    saved = row(db_conn, sighting_id)
    assert saved["status"] == "counted"
    assert saved["flagged"] is True
    assert saved["points"] == 2
    assert saved["check_note"] == "We couldn't check this photo, so a person will take a look."
    assert saved["last_verify_error"] == "overloaded"
    assert saved["verified_at"] == NOW
