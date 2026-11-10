from collections.abc import Iterator
from typing import Annotated

import psycopg
from fastapi import Depends

from app.config import get_settings
from app.errors import ApiError


def get_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(get_settings().database_url, prepare_threshold=None) as conn:
        try:
            yield conn
        except ApiError:
            conn.commit()
            raise


# Function scope commits before the response and before background tasks run.
Conn = Annotated[psycopg.Connection, Depends(get_conn, scope="function")]
