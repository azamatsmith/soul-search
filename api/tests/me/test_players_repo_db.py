from uuid import UUID, uuid4

import psycopg
import pytest

from app.me.players_repo import NameTaken, PgPlayersRepo, Player

pytestmark = pytest.mark.db

ALICE = UUID("a1111111-1111-1111-1111-111111111111")
BOB = UUID("b2222222-2222-2222-2222-222222222222")


def new_auth_user(conn: psycopg.Connection) -> UUID:
    user_id = uuid4()
    conn.execute(
        "insert into auth.users (id, email) values (%s, %s)", (user_id, f"{user_id}@example.test")
    )
    return user_id


def test_get_seeded_admin(db_conn: psycopg.Connection):
    player = PgPlayersRepo(db_conn).get(ALICE)

    assert player == Player(id=ALICE, display_name="Alice", is_admin=True, text_size="standard")


def test_get_missing_returns_none(db_conn: psycopg.Connection):
    assert PgPlayersRepo(db_conn).get(uuid4()) is None


def test_save_creates_player(db_conn: psycopg.Connection):
    user_id = new_auth_user(db_conn)

    player = PgPlayersRepo(db_conn).save_display_name(user_id, "Nora L.")

    assert player == Player(
        id=user_id, display_name="Nora L.", is_admin=False, text_size="standard"
    )


def test_save_renames_existing(db_conn: psycopg.Connection):
    player = PgPlayersRepo(db_conn).save_display_name(ALICE, "Alice K.")

    assert player.display_name == "Alice K."
    assert player.is_admin


def test_save_taken_ignoring_case_raises(db_conn: psycopg.Connection):
    with pytest.raises(NameTaken):
        PgPlayersRepo(db_conn).save_display_name(BOB, "alice")


def test_flagged_count_counts_flagged_sightings(db_conn: psycopg.Connection):
    repo = PgPlayersRepo(db_conn)
    before = repo.flagged_count()
    db_conn.execute(
        """
        insert into public.sightings
          (player_id, photo_path, taken_at, claim_type, points, flagged, week_id)
        values (%s, 'x.jpg', now(), 'regular', 1, true, (select id from public.weeks limit 1))
        """,
        (BOB,),
    )

    assert repo.flagged_count() == before + 1


def test_save_does_not_commit_on_its_own(db_conn: psycopg.Connection):
    PgPlayersRepo(db_conn).save_display_name(ALICE, "Alice K.")
    db_conn.rollback()

    assert PgPlayersRepo(db_conn).get(ALICE).display_name == "Alice"


def test_connection_usable_after_name_taken(db_conn: psycopg.Connection):
    repo = PgPlayersRepo(db_conn)
    with pytest.raises(NameTaken):
        repo.save_display_name(BOB, "ALICE")

    assert repo.get(BOB).display_name == "Bob"


def test_save_text_size_updates_player(db_conn: psycopg.Connection):
    player = PgPlayersRepo(db_conn).save_text_size(ALICE, "large")

    assert player == Player(id=ALICE, display_name="Alice", is_admin=True, text_size="large")


def test_save_text_size_missing_player_returns_none(db_conn: psycopg.Connection):
    assert PgPlayersRepo(db_conn).save_text_size(uuid4(), "large") is None
