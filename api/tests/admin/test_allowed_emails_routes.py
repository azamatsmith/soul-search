from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import AuditEntry, get_audit_repo
from app.admin.emails_repo import AllowedEmail, get_allowed_emails_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from tests.fakes import FakeAllowedEmailsRepo, FakeAttemptsRepo, FakeAuditRepo, FakePlayersRepo

ADMIN_ID = UUID("a1111111-1111-1111-1111-111111111111")
PLAYER_ID = UUID("b2222222-2222-2222-2222-222222222222")
ADMIN = CurrentUser(id=ADMIN_ID, email="alice@example.test")
PLAYER = CurrentUser(id=PLAYER_ID, email="bob@example.test")
PLAYERS = [
    Player(id=ADMIN_ID, display_name="Alice", is_admin=True, text_size="standard"),
    Player(id=PLAYER_ID, display_name="Bob", is_admin=False, text_size="standard"),
]
ALLOWED = {"alice@example.test", "bob@example.test"}


class Harness:
    def __init__(self, user: CurrentUser) -> None:
        self.emails = FakeAllowedEmailsRepo(
            [
                AllowedEmail(email="alice@example.test", display_name="Alice"),
                AllowedEmail(email="nora@example.test", display_name=None),
            ]
        )
        self.audit = FakeAuditRepo()
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(ALLOWED)
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_allowed_emails_repo] = lambda: self.emails
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/admin/allowed-emails"),
        ("post", "/admin/allowed-emails"),
        ("delete", "/admin/allowed-emails/nora@example.test"),
    ],
)
def test_players_cannot_use_admin_endpoints(method: str, path: str):
    harness = Harness(PLAYER)

    response = harness.client.request(method, path, json={"email": "x@example.test"})

    assert response.status_code == 403
    assert response.json() == {"error": "not_admin"}
    assert harness.audit.entries == []


def test_list_shows_joined_status(admin: Harness):
    response = admin.client.get("/admin/allowed-emails")

    assert response.status_code == 200
    assert response.json() == {
        "emails": [
            {"email": "alice@example.test", "display_name": "Alice"},
            {"email": "nora@example.test", "display_name": None},
        ]
    }


def test_add_normalizes_and_records_history(admin: Harness):
    response = admin.client.post("/admin/allowed-emails", json={"email": "  Carol@Example.TEST "})

    assert response.status_code == 201
    assert response.json() == {"email": "carol@example.test", "display_name": None}
    assert "carol@example.test" in admin.emails.emails
    assert admin.audit.entries == [
        AuditEntry(
            admin_id=ADMIN_ID,
            type="emails",
            before=None,
            after={"email": "carol@example.test"},
        )
    ]


@pytest.mark.parametrize("email", ["", "carol", "carol@", "@example.test", "a b@example.test"])
def test_add_rejects_invalid_email(admin: Harness, email: str):
    response = admin.client.post("/admin/allowed-emails", json={"email": email})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_email"}
    assert admin.audit.entries == []


def test_add_existing_email_conflicts(admin: Harness):
    response = admin.client.post("/admin/allowed-emails", json={"email": "Nora@example.test"})

    assert response.status_code == 409
    assert response.json() == {"error": "already_allowed"}
    assert admin.audit.entries == []


def test_remove_records_history(admin: Harness):
    response = admin.client.delete("/admin/allowed-emails/Nora@example.test")

    assert response.status_code == 204
    assert "nora@example.test" not in admin.emails.emails
    assert admin.audit.entries == [
        AuditEntry(
            admin_id=ADMIN_ID,
            type="emails",
            before={"email": "nora@example.test"},
            after=None,
        )
    ]


def test_remove_missing_email_is_not_found(admin: Harness):
    response = admin.client.delete("/admin/allowed-emails/ghost@example.test")

    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}


def test_admin_cannot_remove_own_email(admin: Harness):
    response = admin.client.delete("/admin/allowed-emails/alice@example.test")

    assert response.status_code == 422
    assert response.json() == {"error": "cannot_remove_self"}
    assert "alice@example.test" in admin.emails.emails
