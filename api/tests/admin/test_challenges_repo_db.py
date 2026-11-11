from datetime import UTC, datetime, timedelta
from uuid import uuid4

import psycopg
import pytest

from app.admin.challenges import Challenge, ChallengeDraft, ChallengeRules
from app.admin.challenges_repo import ChallengeOverlaps, PgChallengesRepo, Winner
from app.sightings.repo import PgSightingsRepo
from app.weeks.repo import PgWeeksRepo
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


WEEK_A_PHOTO = datetime(2030, 6, 16, 12, tzinfo=UTC)
WEEK_B_PHOTO = datetime(2030, 6, 17, 12, tzinfo=UTC)


def sighting_periods(conn: psycopg.Connection, player: object) -> list[tuple[object, ...]]:
    return conn.execute(
        "select week_id, challenge_id, points from public.sightings "
        "where player_id = %s and taken_at in (%s, %s) order by taken_at",
        (player, WEEK_A_PHOTO, WEEK_B_PHOTO),
    ).fetchall()


def test_delete_moves_photos_to_each_ones_week_and_refreshes_closed_weeks(
    db_conn: psycopg.Connection,
):
    sightings = PgSightingsRepo(db_conn)
    week_a = sightings.week_at(WEEK_A_PHOTO)
    week_b = sightings.week_at(WEEK_B_PHOTO)
    challenge = create(db_conn, "Brown Week", datetime(2030, 6, 16, 7, tzinfo=UTC), hours=48)
    add_sighting(db_conn, BOB, challenge.id, kind="challenge", points=2, taken_at=WEEK_A_PHOTO)
    add_sighting(db_conn, BOB, challenge.id, kind="challenge", points=3, taken_at=WEEK_B_PHOTO)
    PgWeeksRepo(db_conn).close_ended(week_a.ends_at + timedelta(minutes=1))

    PgChallengesRepo(db_conn).delete(challenge.id)

    assert sighting_periods(db_conn, BOB) == [(week_a.id, None, 2), (week_b.id, None, 3)]
    final = PgWeeksRepo(db_conn).final(week_a.id)
    assert final is not None
    assert [(row.display_name, row.points) for row in final.rows] == [("Bob", 2)]
    assert PgChallengesRepo(db_conn).get(challenge.id) is None


def test_delete_moves_adjustments_by_created_at(db_conn: psycopg.Connection):
    challenge = create(db_conn, "Brown Week", AT)
    add_adjustment(db_conn, CAROL, challenge.id, kind="challenge", change=3)
    db_conn.execute(
        "update public.score_adjustments set created_at = %s where challenge_id = %s",
        (WEEK_B_PHOTO, challenge.id),
    )

    PgChallengesRepo(db_conn).delete(challenge.id)

    week_b = PgSightingsRepo(db_conn).week_at(WEEK_B_PHOTO)
    row = db_conn.execute(
        "select week_id, challenge_id from public.score_adjustments where player_id = %s",
        (CAROL,),
    ).fetchone()
    assert row == (week_b.id, None)


def test_delete_unknown_is_a_no_op(db_conn: psycopg.Connection):
    PgChallengesRepo(db_conn).delete(uuid4())


def test_database_rejects_overlap_even_without_the_check(db_conn: psycopg.Connection):
    create(db_conn, "Brown Week", AT)

    with pytest.raises(ChallengeOverlaps) as err:
        create(db_conn, "Green Week", AT + timedelta(hours=2))

    assert err.value.name == "Brown Week"
    assert PgChallengesRepo(db_conn).overlapping(AT, AT + timedelta(hours=1), None) == "Brown Week"


def test_update_into_an_overlap_is_rejected(db_conn: psycopg.Connection):
    create(db_conn, "Brown Week", AT)
    later = create(db_conn, "Green Week", AT + timedelta(hours=5))

    with pytest.raises(ChallengeOverlaps):
        PgChallengesRepo(db_conn).update(later.id, draft("Green Week", AT + timedelta(hours=1)))


def test_create_stays_inside_the_request_transaction(db_conn: psycopg.Connection):
    created = create(db_conn, "Brown Week", AT)

    db_conn.rollback()

    assert PgChallengesRepo(db_conn).get(created.id) is None
