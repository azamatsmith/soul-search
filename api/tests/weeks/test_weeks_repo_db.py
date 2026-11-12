from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.sightings.repo import LeaderboardEntry, PgSightingsRepo
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
    challenge_id = add_challenge(db_conn, {"regular": 1, "false_call": -1, "categories": []})
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


def close_week_with(conn: psycopg.Connection, starts_at: datetime, results: list[dict]) -> UUID:
    row = conn.execute(
        """
        insert into public.weeks (starts_at, ends_at, closed_at, results)
        values (%s, %s, %s, %s) returning id
        """,
        (starts_at, starts_at + timedelta(days=7), starts_at + timedelta(days=7), Jsonb(results)),
    ).fetchone()
    assert row
    return row[0]


def result(player_id: UUID, name: str, rank: int, points: int, souls: int) -> dict:
    return {
        "player_id": str(player_id),
        "display_name": name,
        "rank": rank,
        "points": points,
        "souls": souls,
    }


OLD_START = datetime(2020, 1, 6, 8, tzinfo=UTC)


def test_past_lists_closed_weeks_newest_first(db_conn: psycopg.Connection):
    older = close_week_with(db_conn, OLD_START, [result(BOB, "Bob", 1, 3, 3)])
    newer = close_week_with(
        db_conn,
        OLD_START + timedelta(days=7),
        [result(CAROL, "Carol", 1, 5, 4), result(ALICE, "Alice", 2, 1, 1)],
    )
    PgSightingsRepo(db_conn).week_at(AT)

    past = PgWeeksRepo(db_conn).past()

    ids = [week.id for week in past.weeks]
    assert ids[ids.index(newer) + 1] == older
    week = next(week for week in past.weeks if week.id == newer)
    assert week.starts_at == OLD_START + timedelta(days=7)
    assert week.rows == (
        LeaderboardEntry(CAROL, "Carol", 5, 4, 1),
        LeaderboardEntry(ALICE, "Alice", 1, 1, 2),
    )
    assert past.total_players >= 3


def test_past_skips_open_weeks(db_conn: psycopg.Connection):
    open_week = PgSightingsRepo(db_conn).week_at(AT)

    past = PgWeeksRepo(db_conn).past()

    assert open_week.id not in [week.id for week in past.weeks]


def test_past_keeps_weeks_with_no_scores(db_conn: psycopg.Connection):
    empty = close_week_with(db_conn, OLD_START, [])

    past = PgWeeksRepo(db_conn).past()

    assert next(week for week in past.weeks if week.id == empty).rows == ()


def test_past_shows_current_display_names(db_conn: psycopg.Connection):
    week_id = close_week_with(db_conn, OLD_START, [result(BOB, "Old Bob", 1, 3, 3)])

    week = PgWeeksRepo(db_conn).final(week_id)

    assert week
    assert week.rows[0].display_name == "Bob"


def test_final_returns_none_for_open_or_missing_weeks(db_conn: psycopg.Connection):
    open_week = PgSightingsRepo(db_conn).week_at(AT)
    repo = PgWeeksRepo(db_conn)

    assert repo.final(open_week.id) is None
    assert repo.final(uuid4()) is None
