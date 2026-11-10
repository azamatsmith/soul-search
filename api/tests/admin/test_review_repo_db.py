from datetime import timedelta
from uuid import UUID

import psycopg
import pytest

from app.admin.review import Decision
from app.admin.review_repo import PgReviewRepo
from app.sightings.repo import PgSightingsRepo
from app.weeks.repo import PgWeeksRepo
from tests.sightings.test_sightings_repo_db import (
    ALICE,
    AT,
    BOB,
    CAROL,
    add_challenge,
    add_sighting,
)

pytestmark = pytest.mark.db

COUNTED_REGULAR = Decision(status="counted", claim_type="regular", categories=(), points=1)


def sighting_id(conn: psycopg.Connection, path: str) -> UUID:
    row = conn.execute("select id from public.sightings where photo_path = %s", (path,)).fetchone()
    assert row
    return row[0]


def mark(
    conn: psycopg.Connection,
    path: str,
    *,
    status: str = "counted",
    flagged: bool = False,
    verified: bool = True,
    points: int | None = None,
) -> UUID:
    conn.execute(
        """
        update public.sightings
        set status = %s, flagged = %s, verified_at = case when %s then now() end,
          check_note = 'Not sure', verification_notes = 'Reasoning',
          points = coalesce(%s, points)
        where photo_path = %s
        """,
        (status, flagged, verified, points, path),
    )
    return sighting_id(conn, path)


def week_id(conn: psycopg.Connection) -> UUID:
    return PgSightingsRepo(conn).week_at(AT).id


def test_queue_lists_flagged_photos_and_unreviewed_false_calls(db_conn: psycopg.Connection):
    week = week_id(db_conn)
    older = mark(
        db_conn,
        add_sighting(db_conn, BOB, week, taken_at=AT - timedelta(hours=1)),
        flagged=True,
    )
    newer = mark(db_conn, add_sighting(db_conn, CAROL, week), flagged=True)
    false_call = mark(
        db_conn,
        add_sighting(db_conn, BOB, week, taken_at=AT - timedelta(minutes=30)),
        status="false_call",
        points=-1,
    )
    counted = mark(db_conn, add_sighting(db_conn, BOB, week))
    unverified = mark(
        db_conn, add_sighting(db_conn, BOB, week), status="false_call", verified=False
    )
    mine = {older, newer, false_call, counted, unverified}

    queue = PgReviewRepo(db_conn).queue()

    assert [item.id for item in queue if item.id in mine] == [newer, false_call, older]
    flagged = next(item for item in queue if item.id == newer)
    assert flagged.display_name == "Carol"
    assert flagged.check_note == "Not sure"
    assert flagged.verification_notes == "Reasoning"
    assert flagged.week_id == week


def test_find_returns_only_photos_waiting_for_review(db_conn: psycopg.Connection):
    week = week_id(db_conn)
    waiting = mark(db_conn, add_sighting(db_conn, BOB, week), flagged=True)
    counted = mark(db_conn, add_sighting(db_conn, BOB, week))
    repo = PgReviewRepo(db_conn)

    found = repo.find(waiting)
    assert found and found.id == waiting
    assert repo.find(counted) is None


def test_resolve_applies_the_decision_and_clears_the_flag(db_conn: psycopg.Connection):
    week = week_id(db_conn)
    flagged = mark(db_conn, add_sighting(db_conn, BOB, week, points=2), flagged=True)
    repo = PgReviewRepo(db_conn)

    assert repo.resolve(flagged, COUNTED_REGULAR, ALICE)

    row = db_conn.execute(
        """
        select status, flagged, claim_type, points, check_note, reviewed_by, reviewed_at
        from public.sightings where id = %s
        """,
        (flagged,),
    ).fetchone()
    assert row
    assert row[:6] == ("counted", False, "regular", 1, None, ALICE)
    assert row[6] is not None
    assert repo.find(flagged) is None


def test_resolve_twice_returns_false(db_conn: psycopg.Connection):
    week = week_id(db_conn)
    false_call = mark(db_conn, add_sighting(db_conn, BOB, week), status="false_call")
    repo = PgReviewRepo(db_conn)

    assert repo.resolve(false_call, COUNTED_REGULAR, ALICE)
    assert repo.resolve(false_call, COUNTED_REGULAR, ALICE) is False


def test_resolve_rebuilds_a_closed_weeks_results(db_conn: psycopg.Connection):
    week = week_id(db_conn)
    false_call = mark(
        db_conn, add_sighting(db_conn, BOB, week, points=-1), status="false_call", points=-1
    )
    add_sighting(db_conn, CAROL, week)
    PgWeeksRepo(db_conn).close_ended(AT + timedelta(days=8))

    PgReviewRepo(db_conn).resolve(false_call, COUNTED_REGULAR, ALICE)

    row = db_conn.execute("select results from public.weeks where id = %s", (week,)).fetchone()
    assert row
    assert [(r["display_name"], r["points"], r["souls"]) for r in row[0]] == [
        ("Bob", 1, 1),
        ("Carol", 1, 1),
    ]


def test_rules_for_uses_the_challenge_rules(db_conn: psycopg.Connection):
    challenge = add_challenge(
        db_conn, {"regular": 3, "special": 4, "false_call": -2, "bonuses": {"Brown paint": 5}}
    )
    path = add_sighting(db_conn, BOB, challenge, kind="challenge")
    repo = PgReviewRepo(db_conn)
    item = repo.find(mark(db_conn, path, flagged=True))
    assert item

    rules = repo.rules_for(item)

    assert (rules.regular, rules.false_call, dict(rules.bonuses)) == (3, -2, {"Brown paint": 5})


def test_rules_for_a_week_uses_the_settings(db_conn: psycopg.Connection):
    repo = PgReviewRepo(db_conn)
    item = repo.find(mark(db_conn, add_sighting(db_conn, BOB, week_id(db_conn)), flagged=True))
    assert item

    assert repo.rules_for(item).regular == 1
