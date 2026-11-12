from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.sightings.repo import NewSighting, PgSightingsRepo
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


def new_sighting(player_id: UUID, period_id: UUID, kind: str = "week", points: int = 1):
    return NewSighting(
        id=uuid4(),
        player_id=player_id,
        photo_path=f"{player_id}/{uuid4()}.jpg",
        taken_at=AT,
        claim_type="regular",
        categories=(),
        points=points,
        latitude=None,
        longitude=None,
        week_id=period_id if kind == "week" else None,
        challenge_id=period_id if kind == "challenge" else None,
    )


def add_adjustment(
    conn: psycopg.Connection,
    player_id: UUID,
    period_id: UUID,
    *,
    change: int,
    kind: str = "week",
) -> None:
    conn.execute(
        f"""
        insert into public.score_adjustments (player_id, admin_id, {kind}_id, change, reason)
        values (%s, %s, %s, %s, 'test')
        """,
        (player_id, ALICE, period_id, change),
    )


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
        regular=1, special=2, false_call=-1, categories=dict.fromkeys(CATEGORIES, 2)
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
        {"regular": 1, "false_call": -1, "categories": [{"name": "Brown paint", "points": 3}]},
    )

    period = PgSightingsRepo(db_conn).period_at(AT)

    assert period.kind == "challenge"
    assert period.id == challenge_id
    assert period.name == "Brown Week"
    assert period.rules == Rules(
        regular=1, special=None, false_call=-1, categories={"Brown paint": 3}
    )


def test_challenge_end_is_exclusive(db_conn: psycopg.Connection):
    add_challenge(db_conn, {"regular": 1, "false_call": -1, "categories": []})

    assert PgSightingsRepo(db_conn).period_at(AT + timedelta(hours=3)).kind == "week"


def test_insert_then_find_returns_the_sighting(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    new = new_sighting(BOB, week.id)

    inserted = repo.insert(new)

    assert inserted.id == new.id
    assert inserted.player_id == BOB
    assert inserted.status == "waiting_review"
    assert repo.find(new.id) == inserted


def test_insert_same_id_twice_returns_the_first(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    first = repo.insert(new_sighting(BOB, week.id, points=1))
    again = replace(new_sighting(BOB, week.id, points=2), id=first.id)

    assert repo.insert(again) == first


def test_find_missing_returns_none(db_conn: psycopg.Connection):
    assert PgSightingsRepo(db_conn).find(uuid4()) is None


def test_standing_ranks_players_and_counts_adjustments(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    for _ in range(3):
        add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id, points=2)
    add_sighting(db_conn, CAROL, week.id)
    add_adjustment(db_conn, ALICE, week.id, change=-1)

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
    challenge_id = add_challenge(db_conn, {"regular": 1, "false_call": -1, "categories": []})
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, BOB, challenge_id, kind="challenge", points=5)

    assert repo.standing(BOB, week).points == 1
    assert repo.standing(BOB, repo.period_at(AT)).points == 5


def test_week_at_ignores_running_challenge(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    add_challenge(db_conn, {"regular": 1, "false_call": -1, "categories": []})

    week = repo.week_at(AT)

    assert (week.kind, week.starts_at) == ("week", WEEK_START)


def test_standing_ranks_adjustment_only_player(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, ALICE, week.id, points=3)
    add_adjustment(db_conn, BOB, week.id, change=1)

    standing = repo.standing(BOB, week)

    assert (standing.points, standing.count, standing.rank) == (1, 0, 2)


def test_standing_ranks_false_call_player_among_participants_only(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.period_at(AT)
    add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id, points=-1)

    assert repo.standing(BOB, week).rank == 2


NO_CATEGORY_RULES = {"regular": 1, "false_call": -1, "categories": []}


def _week_and_challenge_setup(conn: psycopg.Connection, repo: PgSightingsRepo):
    week = repo.week_at(AT)
    challenge_id = add_challenge(conn, NO_CATEGORY_RULES)
    add_sighting(conn, ALICE, week.id)
    add_sighting(conn, BOB, challenge_id, kind="challenge", points=5)
    add_adjustment(conn, BOB, challenge_id, change=2, kind="challenge")
    return week


def test_leaderboard_week_excludes_challenge_points(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = _week_and_challenge_setup(db_conn, repo)

    board = repo.leaderboard(week)

    assert [(r.player_id, r.points, r.rank) for r in board.rows] == [(ALICE, 1, 1)]


def test_leaderboard_all_time_includes_weeks_challenges_and_adjustments(
    db_conn: psycopg.Connection,
):
    repo = PgSightingsRepo(db_conn)
    before = {r.player_id: r.points for r in repo.leaderboard(None).rows}
    _week_and_challenge_setup(db_conn, repo)

    after = {r.player_id: r.points for r in repo.leaderboard(None).rows}

    assert after[BOB] - before.get(BOB, 0) == 7
    assert after[ALICE] - before.get(ALICE, 0) == 1


def test_leaderboard_ties_share_rank_and_sort_by_name(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, ALICE, week.id)

    names = dict(
        db_conn.execute(
            "select id, display_name from public.players where id in (%s, %s)", (ALICE, BOB)
        ).fetchall()
    )
    expected = sorted(names.values(), key=str.lower)

    board = repo.leaderboard(week)

    assert [(r.display_name, r.rank) for r in board.rows] == [(name, 1) for name in expected]


def test_leaderboard_false_call_lowers_points_not_count(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    add_sighting(db_conn, BOB, week.id)
    path = add_sighting(db_conn, BOB, week.id, points=-1)
    db_conn.execute(
        "update public.sightings set status = 'false_call' where photo_path = %s", (path,)
    )

    (row,) = repo.leaderboard(week).rows

    assert (row.points, row.count) == (0, 1)


def test_leaderboard_lists_only_participants_and_counts_everyone(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    add_sighting(db_conn, ALICE, week.id)

    board = repo.leaderboard(week)

    assert [r.player_id for r in board.rows] == [ALICE]
    assert board.total_players >= 3


def test_leaderboard_false_call_only_player_is_last(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, week.id, points=-1)

    board = repo.leaderboard(week)

    assert [(r.player_id, r.rank) for r in board.rows] == [(ALICE, 1), (BOB, 2)]


def test_leaderboard_rank_matches_standing(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    add_sighting(db_conn, ALICE, week.id, points=3)
    add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, CAROL, week.id)

    for row in repo.leaderboard(week).rows:
        assert repo.standing(row.player_id, week).rank == row.rank


def test_week_log_lists_only_this_weeks_sightings_newest_first(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    last_week = repo.week_at(AT - timedelta(days=7))
    older = add_sighting(db_conn, BOB, week.id, taken_at=AT - timedelta(hours=2))
    newer = add_sighting(db_conn, ALICE, week.id)
    add_sighting(db_conn, BOB, last_week.id, taken_at=AT - timedelta(days=7))

    log = repo.week_log(week, None)

    assert [s.photo_path for s in log] == [newer, older]


def test_week_log_filters_to_one_player(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    mine = add_sighting(db_conn, BOB, week.id)
    add_sighting(db_conn, ALICE, week.id)

    log = repo.week_log(week, BOB)

    assert [s.photo_path for s in log] == [mine]


def test_week_log_includes_display_name_and_check_note(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    path = add_sighting(db_conn, BOB, week.id)
    db_conn.execute(
        """
        update public.sightings
        set check_note = 'not a Kia Soul', verification_notes = 'admin only reasoning'
        where photo_path = %s
        """,
        (path,),
    )

    (logged,) = repo.week_log(week, None)

    assert logged.display_name == "Bob"
    assert logged.check_note == "not a Kia Soul"
    assert not hasattr(logged, "verification_notes")


def test_leaderboard_for_a_challenge_counts_only_its_points(db_conn: psycopg.Connection):
    repo = PgSightingsRepo(db_conn)
    _week_and_challenge_setup(db_conn, repo)
    challenge = repo.period_at(AT)

    board = repo.leaderboard(challenge)

    assert challenge.kind == "challenge"
    assert [(r.player_id, r.points, r.rank) for r in board.rows] == [(BOB, 7, 1)]


def test_week_log_includes_challenge_photos_taken_this_week_with_the_name(
    db_conn: psycopg.Connection,
):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    challenge = add_challenge(db_conn, NO_CATEGORY_RULES)
    weekly = add_sighting(db_conn, ALICE, week.id, taken_at=AT - timedelta(hours=2))
    during = add_sighting(db_conn, BOB, challenge, kind="challenge")

    log = repo.week_log(week, None)

    assert [(s.photo_path, s.challenge_name) for s in log] == [
        (during, "Brown Week"),
        (weekly, None),
    ]


def test_week_log_leaves_out_challenge_photos_from_another_week(
    db_conn: psycopg.Connection,
):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    challenge = add_challenge(db_conn, NO_CATEGORY_RULES)
    add_sighting(db_conn, BOB, challenge, kind="challenge", taken_at=AT + timedelta(days=7))

    assert repo.week_log(week, None) == ()


def test_week_log_shows_a_late_challenge_upload_in_the_challenge_week(
    db_conn: psycopg.Connection,
):
    repo = PgSightingsRepo(db_conn)
    week = repo.week_at(AT)
    challenge = add_challenge(db_conn, NO_CATEGORY_RULES)
    late = add_sighting(
        db_conn, BOB, challenge, kind="challenge", taken_at=WEEK_START - timedelta(minutes=10)
    )

    assert [s.photo_path for s in repo.week_log(week, None)] == [late]
