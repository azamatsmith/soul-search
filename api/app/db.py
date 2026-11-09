from collections.abc import Iterator

import psycopg

from app.config import get_settings


def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(get_settings().database_url, prepare_threshold=None) as conn:
        yield conn
