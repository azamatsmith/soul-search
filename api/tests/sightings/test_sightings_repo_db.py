from datetime import UTC, datetime, timedelta
from uuid import UUID

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.sightings.repo import PgSightingsRepo
from app.sightings.scoring import Rules

pytestmark = pytest.mark.db

AT = datetime(2030, 6, 12, 18, tzinfo=UTC)
WEEK_START = datetime(2030, 6, 10, 7, tzinfo=UTC)
CATEGORIES = ("Alien Green", "Racing stripes", "Exterior graphics", "Brown paint")


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
