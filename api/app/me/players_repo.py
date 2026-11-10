from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

import psycopg

from app.db import Conn

NAME_UNIQUE_CONSTRAINT = "players_display_name_lower_key"
PLAYER_COLUMNS = "id, display_name, is_admin, text_size"


@dataclass(frozen=True)
class Player:
    id: UUID
    display_name: str
    is_admin: bool
    text_size: str


class NameTaken(Exception):
    pass


class PlayersRepo(Protocol):
    def get(self, player_id: UUID) -> Player | None: ...

    def save_display_name(self, player_id: UUID, name: str) -> Player: ...

    def save_text_size(self, player_id: UUID, size: str) -> Player | None: ...

    def flagged_count(self) -> int: ...


class PgPlayersRepo:
    def __init__(self, conn: psycopg.Connection) -> None:
        self._conn = conn

    def get(self, player_id: UUID) -> Player | None:
        row = self._conn.execute(
            f"select {PLAYER_COLUMNS} from public.players where id = %s", (player_id,)
        ).fetchone()
        return Player(*row) if row else None

    def save_display_name(self, player_id: UUID, name: str) -> Player:
        self._conn.execute("savepoint save_display_name")
        try:
            row = self._conn.execute(
                f"""
                insert into public.players (id, display_name) values (%s, %s)
                on conflict (id) do update set display_name = excluded.display_name
                returning {PLAYER_COLUMNS}
                """,
                (player_id, name),
            ).fetchone()
        except psycopg.errors.UniqueViolation as error:
            self._conn.execute("rollback to savepoint save_display_name")
            if error.diag.constraint_name == NAME_UNIQUE_CONSTRAINT:
                raise NameTaken from error
            raise
        assert row is not None
        return Player(*row)

    def save_text_size(self, player_id: UUID, size: str) -> Player | None:
        row = self._conn.execute(
            f"update public.players set text_size = %s where id = %s returning {PLAYER_COLUMNS}",
            (size, player_id),
        ).fetchone()
        return Player(*row) if row else None

    def flagged_count(self) -> int:
        row = self._conn.execute("select count(*) from public.sightings where flagged").fetchone()
        assert row is not None
        return row[0]


def get_players_repo(conn: Conn) -> PlayersRepo:
    return PgPlayersRepo(conn)
