import psycopg
import pytest

from app.admin.rules_repo import PgPointRulesRepo, PointRules

pytestmark = pytest.mark.db


def test_get_returns_seeded_rules(db_conn: psycopg.Connection):
    assert PgPointRulesRepo(db_conn).get() == PointRules(
        regular=1,
        special=2,
        false_call=-1,
        categories=("Alien Green", "Racing stripes", "Exterior graphics", "Brown paint"),
    )


def test_save_replaces_rules(db_conn: psycopg.Connection):
    repo = PgPointRulesRepo(db_conn)
    rules = PointRules(regular=2, special=4, false_call=0, categories=("Fins",))

    repo.save(rules)

    assert repo.get() == rules
