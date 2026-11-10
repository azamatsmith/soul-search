from dataclasses import dataclass
from typing import Protocol

import psycopg

from app.db import Conn


@dataclass(frozen=True)
class PointRules:
    regular: int
    special: int
    false_call: int
    categories: tuple[str, ...]


class PointRulesRepo(Protocol):
    def get(self) -> PointRules: ...

    def save(self, rules: PointRules) -> None: ...


class PgPointRulesRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get(self) -> PointRules:
        row = self._conn.execute(
            """
            select regular_points, special_points, false_call_points, special_categories
            from public.settings
            """
        ).fetchone()
        assert row is not None
        regular, special, false_call, categories = row
        return PointRules(regular, special, false_call, tuple(categories))

    def save(self, rules: PointRules) -> None:
        self._conn.execute(
            """
            update public.settings
            set regular_points = %s, special_points = %s, false_call_points = %s,
                special_categories = %s, updated_at = now()
            """,
            (rules.regular, rules.special, rules.false_call, list(rules.categories)),
        )


def get_point_rules_repo(conn: Conn) -> PointRulesRepo:
    return PgPointRulesRepo(conn)
