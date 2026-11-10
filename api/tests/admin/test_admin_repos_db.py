from uuid import UUID

import psycopg
import pytest

from app.admin.audit_repo import AuditEntry, PgAuditRepo
from app.admin.emails_repo import AllowedEmail, PgAllowedEmailsRepo

pytestmark = pytest.mark.db

ALICE = UUID("a1111111-1111-1111-1111-111111111111")


def test_list_shows_seeded_players_as_joined(db_conn: psycopg.Connection):
    emails = PgAllowedEmailsRepo(db_conn).list()

    assert emails == (
        AllowedEmail(email="alice@example.test", display_name="Alice"),
        AllowedEmail(email="bob@example.test", display_name="Bob"),
        AllowedEmail(email="carol@example.test", display_name="Carol"),
    )


def test_add_new_email_is_not_joined(db_conn: psycopg.Connection):
    repo = PgAllowedEmailsRepo(db_conn)

    added = repo.add("nora@example.test", ALICE)

    assert added == AllowedEmail(email="nora@example.test", display_name=None)
    assert added in repo.list()


def test_add_existing_email_returns_none(db_conn: psycopg.Connection):
    assert PgAllowedEmailsRepo(db_conn).add("bob@example.test", ALICE) is None


def test_remove_deletes_email(db_conn: psycopg.Connection):
    repo = PgAllowedEmailsRepo(db_conn)

    assert repo.remove("bob@example.test") is True
    assert [entry.email for entry in repo.list()] == ["alice@example.test", "carol@example.test"]


def test_remove_missing_email_returns_false(db_conn: psycopg.Connection):
    assert PgAllowedEmailsRepo(db_conn).remove("ghost@example.test") is False


def test_record_writes_audit_row(db_conn: psycopg.Connection):
    PgAuditRepo(db_conn).record(
        AuditEntry(admin_id=ALICE, type="emails", before=None, after={"email": "n@example.test"})
    )

    row = db_conn.execute(
        "select admin_id, type, target_id, before, after, reason from public.audit_log"
        " order by created_at desc limit 1"
    ).fetchone()
    assert row == (ALICE, "emails", None, None, {"email": "n@example.test"}, None)
