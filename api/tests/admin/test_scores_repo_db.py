from uuid import UUID

import psycopg
import pytest

from app.admin.scores_repo import PgScoresRepo, PlayerScore
from app.sightings.repo import PgSightingsRepo
from tests.sightings.test_sightings_repo_db import (
    ALICE,
    AT,
    BOB,
    CAROL,
    add_adjustment,
    add_challenge,
    add_sighting,
)

pytestmark = pytest.mark.db

NOBODY = UUID("00000000-0000-0000-0000-000000000000")


def test_players_lists_everyone_with_their_period_points(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    add_sighting(db_conn, BOB, week.id, points=2)
    add_adjustment(db_conn, BOB, week.id, change=3)

    players = PgScoresRepo(db_conn).players(week)

    assert players == (
        PlayerScore(id=ALICE, display_name="Alice", points=0),
        PlayerScore(id=BOB, display_name="Bob", points=5),
        PlayerScore(id=CAROL, display_name="Carol", points=0),
    )


def test_points_is_none_for_an_unknown_player(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    repo = PgScoresRepo(db_conn)

    assert repo.points(CAROL, week) == 0
    assert repo.points(NOBODY, week) is None


def test_adjust_adds_to_the_week(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    repo = PgScoresRepo(db_conn)

    repo.adjust(BOB, ALICE, week, -2, "Duplicate photos")

    assert repo.points(BOB, week) == -2
    row = db_conn.execute(
        "select admin_id, week_id, challenge_id, reason from public.score_adjustments "
        "where player_id = %s",
        (BOB,),
    ).fetchone()
    assert row == (ALICE, week.id, None, "Duplicate photos")


def test_adjust_adds_to_a_running_challenge(db_conn: psycopg.Connection):
    add_challenge(db_conn, {"regular": 1, "false_call": -1, "categories": []})
    sightings = PgSightingsRepo(db_conn)
    challenge = sightings.period_at(AT)
    assert challenge.kind == "challenge"
    repo = PgScoresRepo(db_conn)

    repo.adjust(BOB, ALICE, challenge, 4, "Lost upload")

    assert repo.points(BOB, challenge) == 4
    assert repo.points(BOB, sightings.week_at(AT)) == 0
