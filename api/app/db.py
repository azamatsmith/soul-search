from collections.abc import Iterator

import psycopg

from app.config import get_settings
from app.errors import ApiError


def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(get_settings().database_url, prepare_threshold=None) as conn:
        try:
            yield conn
        except ApiError:
            conn.commit()
            raise
