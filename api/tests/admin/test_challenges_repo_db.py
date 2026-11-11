from datetime import datetime, timedelta
from uuid import uuid4

import psycopg
import pytest

from app.admin.challenges import Challenge, ChallengeDraft, ChallengeRules
from app.admin.challenges_repo import PgChallengesRepo, Winner
from tests.sightings.test_sightings_repo_db import (
    ALICE,
    AT,
    BOB,
    CAROL,
    add_adjustment,
    add_sighting,
)

pytestmark = pytest.mark.db

RULES = ChallengeRules(regular=1, special=2, false_call=-1, bonuses={"Brown paint": 3})


def draft(name: str, starts_at: datetime, hours: int = 4) -> ChallengeDraft:
    return ChallengeDraft(
        name=name, starts_at=starts_at, ends_at=starts_at + timedelta(hours=hours), rules=RULES
    )


def create(conn: psycopg.Connection, name: str, starts_at: datetime, hours: int = 4) -> Challenge:
    return PgChallengesRepo(conn).create(draft(name, starts_at, hours), ALICE)


def test_create_then_get_round_trips(db_conn: psycopg.Connection):
    created = create(db_conn, "Brown Week", AT)

    assert PgChallengesRepo(db_conn).get(created.id) == created
    assert created.rules == RULES
    row = db_conn.execute(
        "select created_by from public.challenges where id = %s", (created.id,)
    ).fetchone()
    assert row == (ALICE,)


def test_update_changes_name_times_and_rules(db_conn: psycopg.Connection):
    repo = PgChallengesRepo(db_conn)
    created = create(db_conn, "Brown Week", AT)
    changed = ChallengeDraft(
        name="Green Week",
        starts_at=AT + timedelta(hours=1),
        ends_at=AT + timedelta(hours=9),
        rules=ChallengeRules(regular=2, special=3, false_call=-2),
    )

    updated = repo.update(created.id, changed)

    assert updated == Challenge(
        created.id, "Green Week", changed.starts_at, changed.ends_at, changed.rules
    )
    assert repo.get(created.id) == updated


def test_get_unknown_is_none(db_conn: psycopg.Connection):
    assert PgChallengesRepo(db_conn).get(uuid4()) is None


def test_list_splits_running_upcoming_finished(db_conn: psycopg.Connection):
    create(db_conn, "Old", AT - timedelta(days=20))
    create(db_conn, "Recent", AT - timedelta(days=10))
    create(db_conn, "Live", AT - timedelta(hours=1))
    create(db_conn, "Later", AT + timedelta(days=9))
    create(db_conn, "Soon", AT + timedelta(days=2))

    listed = PgChallengesRepo(db_conn).list(AT)

    assert [c.name for c in listed.running] == ["Live"]
    assert [c.name for c in listed.upcoming] == ["Soon", "Later"]
    assert [c.name for c, _ in listed.finished] == ["Recent", "Old"]


def test_finished_winner_is_top_scorer_including_adjustments(db_conn: psycopg.Connection):
    scored = create(db_conn, "Scored", AT - timedelta(days=3))
    create(db_conn, "Empty", AT - timedelta(days=5))
    taken = scored.starts_at + timedelta(minutes=5)
    add_sighting(db_conn, BOB, scored.id, kind="challenge", points=2, taken_at=taken)
    add_sighting(db_conn, CAROL, scored.id, kind="challenge", points=1, taken_at=taken)
    add_adjustment(db_conn, CAROL, scored.id, kind="challenge", change=3)

    finished = dict((c.name, winner) for c, winner in PgChallengesRepo(db_conn).list(AT).finished)

    assert finished == {"Scored": Winner(display_name="Carol", points=4), "Empty": None}


def test_overlapping_returns_the_clashing_name(db_conn: psycopg.Connection):
    create(db_conn, "Brown Week", AT)

    clash = PgChallengesRepo(db_conn).overlapping(
        AT + timedelta(hours=3), AT + timedelta(hours=8), None
    )

    assert clash == "Brown Week"


def test_back_to_back_challenges_do_not_overlap(db_conn: psycopg.Connection):
    create(db_conn, "Brown Week", AT)
    repo = PgChallengesRepo(db_conn)

    assert repo.overlapping(AT + timedelta(hours=4), AT + timedelta(hours=8), None) is None
    assert repo.overlapping(AT - timedelta(hours=2), AT, None) is None


def test_overlapping_ignores_the_excluded_challenge(db_conn: psycopg.Connection):
    created = create(db_conn, "Brown Week", AT)

    assert PgChallengesRepo(db_conn).overlapping(AT, AT + timedelta(hours=4), created.id) is None
