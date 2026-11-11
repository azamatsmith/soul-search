from datetime import UTC, datetime, timedelta
from uuid import UUID

import psycopg
import pytest
from psycopg.types.json import Jsonb

from app.admin.audit_repo import AuditEntry, PgAuditRepo
from app.sightings.repo import PgSightingsRepo
from tests.sightings.test_sightings_repo_db import ALICE, AT, BOB, CAROL, add_sighting

pytestmark = pytest.mark.db

START = datetime(2030, 6, 12, 18, tzinfo=UTC)


def add_entry(conn: psycopg.Connection, entry: AuditEntry, minutes: int) -> None:
    conn.execute(
        """
        insert into public.audit_log (admin_id, type, target_id, before, after, reason, created_at)
        values (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            entry.admin_id,
            entry.type,
            entry.target_id,
            Jsonb(entry.before),
            Jsonb(entry.after),
            entry.reason,
            START + timedelta(minutes=minutes),
        ),
    )


def sighting_id(conn: psycopg.Connection, path: str) -> UUID:
    row = conn.execute("select id from public.sightings where photo_path = %s", (path,)).fetchone()
    assert row is not None
    return row[0]


def test_history_lists_newest_first_with_names(db_conn: psycopg.Connection):
    week = PgSightingsRepo(db_conn).week_at(AT)
    photo = sighting_id(db_conn, add_sighting(db_conn, CAROL, week.id))
    emails = AuditEntry(admin_id=ALICE, type="emails", before=None, after={"email": "n@x.test"})
    score = AuditEntry(
        admin_id=BOB,
        type="score",
        target_id=CAROL,
        before={"points": 8},
        after={"points": 11, "change": 3},
        reason="Lost uploads",
    )
    review = AuditEntry(
        admin_id=ALICE,
        type="photo",
        target_id=photo,
        before={"points": 2},
        after={"points": 1},
    )
    add_entry(db_conn, emails, 0)
    add_entry(db_conn, score, 10)
    add_entry(db_conn, review, 5)

    history = PgAuditRepo(db_conn).history(scores_only=False)

    assert [(e.type, e.admin_name, e.target_name) for e in history[:3]] == [
        ("score", "Bob", "Carol"),
        ("photo", "Alice", "Carol"),
        ("emails", "Alice", None),
    ]
    first = history[0]
    assert first.admin_id == BOB
    assert first.before == {"points": 8}
    assert first.after == {"points": 11, "change": 3}
    assert first.reason == "Lost uploads"
    assert first.created_at == START + timedelta(minutes=10)


def test_history_can_show_scores_only(db_conn: psycopg.Connection):
    add_entry(db_conn, AuditEntry(admin_id=ALICE, type="rules", before={}, after={}), 0)
    add_entry(
        db_conn,
        AuditEntry(
            admin_id=ALICE,
            type="score",
            target_id=BOB,
            before={"points": 0},
            after={"points": -1, "change": -1},
            reason="Duplicate",
        ),
        1,
    )

    history = PgAuditRepo(db_conn).history(scores_only=True)

    assert history[0].target_name == "Bob"
    assert {e.type for e in history} == {"score"}
