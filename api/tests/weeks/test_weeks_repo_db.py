from datetime import UTC, datetime, timedelta
from uuid import UUID

import psycopg
import pytest

from app.sightings.repo import PgSightingsRepo
from app.weeks.repo import PgWeeksRepo
from tests.sightings.test_sightings_repo_db import (
    ALICE,
    AT,
    BOB,
    CAROL,
    WEEK_START,
    add_adjustment,
    add_challenge,
    add_sighting,
)

pytestmark = pytest.mark.db

WEEK_END = WEEK_START + timedelta(days=7)
JUST_AFTER = WEEK_END + timedelta(minutes=5)


def week_row(conn: psycopg.Connection, week_id: UUID) -> tuple:
    row = conn.execute(
        "select closed_at, results from public.weeks where id = %s", (week_id,)
    ).fetchone()
    assert row
    return row


def test_closes_ended_week_with_final_standings(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, CAROL, week.id)
    add_adjustment(db_conn, CAROL, week.id, change=1)
    add_sighting(db_conn, ALICE, week.id, points=-1)
    db_conn.execute(
        "update public.sightings set status = 'false_call' where player_id = %s", (ALICE,)
    )

    result = PgWeeksRepo(db_conn).close_ended(JUST_AFTER)

    assert week.id in result.closed
    closed_at, results = week_row(db_conn, week.id)
    assert closed_at == JUST_AFTER
    assert results == [
        {"player_id": str(BOB), "display_name": "Bob", "rank": 1, "points": 2, "souls": 2},
        {"player_id": str(CAROL), "display_name": "Carol", "rank": 1, "points": 2, "souls": 1},
        {"player_id": str(ALICE), "display_name": "Alice", "rank": 3, "points": -1, "souls": 0},
    ]


def test_challenge_points_stay_out_of_the_week(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    challenge_id = add_challenge(
        db_conn, {"regular": 1, "special": 2, "false_call": -1, "bonuses": {}}
    )
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, BOB, challenge_id, kind="challenge", points=5)
    add_adjustment(db_conn, BOB, challenge_id, change=3, kind="challenge")

    PgWeeksRepo(db_conn).close_ended(JUST_AFTER)

    _, results = week_row(db_conn, week.id)
    assert [(row["display_name"], row["points"]) for row in results] == [("Bob", 1)]


def test_leaves_a_running_week_open(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)

    result = PgWeeksRepo(db_conn).close_ended(WEEK_END - timedelta(seconds=1))

    assert week.id not in result.closed
    assert week_row(db_conn, week.id) == (None, None)


def test_running_twice_changes_nothing(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    add_sighting(db_conn, BOB, week.id)
    repo = PgWeeksRepo(db_conn)
    repo.close_ended(JUST_AFTER)
    first = week_row(db_conn, week.id)

    again = repo.close_ended(JUST_AFTER + timedelta(hours=1))

    assert again.closed == ()
    assert week_row(db_conn, week.id) == first


def test_opens_the_current_week(db_conn: psycopg.Connection):
    result = PgWeeksRepo(db_conn).close_ended(JUST_AFTER)

    row = db_conn.execute(
        "select starts_at, closed_at from public.weeks where id = %s", (result.current_week_id,)
    ).fetchone()
    assert row == (WEEK_END, None)


def test_catches_up_on_missed_weeks(db_conn: psycopg.Connection):
    sightings = PgSightingsRepo(db_conn)
    first = sightings.week_at(AT)
    second = sightings.week_at(AT + timedelta(days=7))

    result = PgWeeksRepo(db_conn).close_ended(JUST_AFTER + timedelta(days=7))

    assert {first.id, second.id} <= set(result.closed)
    assert result.closed.index(first.id) < result.closed.index(second.id)


@pytest.mark.parametrize(
    ("week_at", "ends_at"),
    [
        (datetime(2030, 10, 30, 12, tzinfo=UTC), datetime(2030, 11, 4, 8, tzinfo=UTC)),
        (datetime(2030, 3, 6, 12, tzinfo=UTC), datetime(2030, 3, 11, 7, tzinfo=UTC)),
    ],
    ids=["fall-back", "spring-forward"],
)
def test_closes_at_pacific_midnight_across_dst(
    db_conn: psycopg.Connection, week_at: datetime, ends_at: datetime
):
    week = PgSightingsRepo(db_conn).week_at(week_at)
    repo = PgWeeksRepo(db_conn)

    assert week.id not in repo.close_ended(ends_at - timedelta(seconds=1)).closed
    assert week.id in repo.close_ended(ends_at).closed
