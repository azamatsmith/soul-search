from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.sightings.repo import PgSightingsRepo
from app.sightings.scoring import Rules

pytestmark = pytest.mark.db

ALICE = UUID("a1111111-1111-1111-1111-111111111111")
BOB = UUID("b2222222-2222-2222-2222-222222222222")
CAROL = UUID("c3333333-3333-3333-3333-333333333333")
AT = datetime(2030, 6, 12, 18, tzinfo=UTC)
WEEK_START = datetime(2030, 6, 10, 7, tzinfo=UTC)
CATEGORIES = ("Alien Green", "Racing stripes", "Exterior graphics", "Brown paint")


def add_sighting(
    conn: psycopg.Connection,
    player_id: UUID,
    period_id: UUID,
    *,
    kind: str = "week",
    points: int = 1,
    taken_at: datetime = AT,
) -> str:
    path = f"{player_id}/{uuid4()}.jpg"
    conn.execute(
        f"""
        insert into public.sightings
          (player_id, photo_path, taken_at, claim_type, points, {kind}_id)
        values (%s, %s, %s, 'regular', %s, %s)
        """,
        (player_id, path, taken_at, points, period_id),
    )
    return path


def add_challenge(conn: psycopg.Connection, rules: dict[str, object]) -> UUID:
    row = conn.execute(
        """
        insert into public.challenges (name, starts_at, ends_at, rules)
        values ('Brown Week', %s, %s, %s) returning id
        """,
        (AT - timedelta(hours=1), AT + timedelta(hours=3), Jsonb(rules)),
    ).fetchone()
    assert row
    return row[0]


def test_period_at_creates_the_pacific_week_with_settings_rules(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)

    period = repo.period_at(AT)

    assert period.kind == "week"
    assert period.name is None
    assert period.starts_at == WEEK_START
    assert period.ends_at == WEEK_START + timedelta(days=7)
    assert period.closed is False
    assert period.rules == Rules(
        regular=1, special=2, false_call=-1, categories=CATEGORIES, bonuses={}
    )
    assert repo.period_at(AT).id == period.id


def test_period_at_reports_closed_week(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    db_conn.execute("update public.weeks set closed_at = now() where id = %s", (week.id,))

    assert repo.period_at(AT).closed is True


def test_period_at_prefers_running_challenge(db_conn: psycopg.Connection):
    challenge_id = add_challenge(
        db_conn,
        {"regular": 1, "special": 2, "false_call": -1, "bonuses": {"Brown paint": 3}},
    )

    period = PgSightingsRepo(db_conn).period_at(AT)

    assert period.kind == "challenge"
    assert period.id == challenge_id
    assert period.name == "Brown Week"
    assert period.rules.bonuses == {"Brown paint": 3}
    assert period.rules.categories == CATEGORIES


def test_challenge_end_is_exclusive(db_conn: psycopg.Connection):
    add_challenge(db_conn, {"regular": 1, "special": 2, "false_call": -1, "bonuses": {}})

    assert PgSightingsRepo(db_conn).period_at(AT + timedelta(hours=3)).kind == "week"


def test_standing_ranks_players_and_counts_adjustments(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    for _ in range(3):
        add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id, points=2)
    add_sighting(db_conn, CAROL, week.id)
    db_conn.execute(
        """
        insert into public.score_adjustments (player_id, admin_id, week_id, change, reason)
        values (%s, %s, %s, -1, 'test')
        """,
        (ALICE, ALICE, week.id),
    )

    standing = repo.standing(BOB, week)

    assert standing.points == 2
    assert standing.count == 1
    assert standing.rank == 1
    assert standing.next_rank is None
    assert standing.points_behind_next is None
    assert standing.total_players >= 3

    carol = repo.standing(CAROL, week)
    assert (carol.rank, carol.next_rank, carol.points_behind_next) == (3, 1, 1)


def test_standing_ties_share_a_rank(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id)

    assert repo.standing(BOB, week).rank == 1
    assert repo.standing(ALICE, week).rank == 1


def test_standing_skips_false_calls_in_count(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    path = add_sighting(db_conn, BOB, week.id)
    db_conn.execute(
        "update public.sightings set status = 'false_call', points = -1 where photo_path = %s",
        (path,),
    )

    standing = repo.standing(BOB, week)

    assert (standing.points, standing.count) == (-1, 0)


def test_standing_without_sightings_has_no_rank(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)

    standing = repo.standing(BOB, week)

    assert (standing.points, standing.count, standing.rank) == (0, 0, None)
    assert standing.last_photo_path is None


def test_standing_last_photo_is_newest(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, BOB, week.id)
    newest = add_sighting(db_conn, BOB, week.id, taken_at=AT + timedelta(minutes=5))

    assert repo.standing(BOB, week).last_photo_path == newest


def test_standing_only_counts_its_period(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    challenge_id = add_challenge(
        db_conn, {"regular": 1, "special": 2, "false_call": -1, "bonuses": {}}
    )
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, BOB, challenge_id, kind="challenge", points=5)

    assert repo.standing(BOB, week).points == 1
    assert repo.standing(BOB, repo.period_at(AT)).points == 5
