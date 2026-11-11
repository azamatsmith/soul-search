from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import HistoryEntry, get_audit_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from tests.fakes import FakeAttemptsRepo, FakeAuditRepo, FakePlayersRepo

ADMIN_ID = UUID("a1111111-1111-1111-1111-111111111111")
PLAYER_ID = UUID("b2222222-2222-2222-2222-222222222222")
ADMIN = CurrentUser(id=ADMIN_ID, email="alice@example.test")
PLAYER = CurrentUser(id=PLAYER_ID, email="bob@example.test")
PLAYERS = [
    Player(id=ADMIN_ID, display_name="Alice", is_admin=True, text_size="standard"),
    Player(id=PLAYER_ID, display_name="Bob", is_admin=False, text_size="standard"),
]
SCORE = HistoryEntry(
    id=UUID("11111111-1111-1111-1111-111111111111"),
    type="score",
    admin_id=ADMIN_ID,
    admin_name="Alice",
    target_name="Bob",
    before={"points": 8},
    after={"points": 11, "change": 3},
    reason="Lost uploads",
    created_at=datetime(2026, 11, 12, 20, tzinfo=UTC),
)
EMAILS = HistoryEntry(
    id=UUID("22222222-2222-2222-2222-222222222222"),
    type="emails",
    admin_id=ADMIN_ID,
    admin_name="Alice",
    target_name=None,
    before=None,
    after={"email": "nora@example.test"},
    reason=None,
    created_at=datetime(2026, 11, 11, 20, tzinfo=UTC),
)


class Harness:
    def __init__(self, user: CurrentUser) -> None:
        self.audit = FakeAuditRepo((SCORE, EMAILS))
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(
            {"alice@example.test", "bob@example.test"}
        )
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


def test_players_cannot_see_history():
    harness = Harness(PLAYER)

    response = harness.client.get("/admin/history")

    assert response.status_code == 403
    assert harness.audit.scores_only_requests == []


def test_history_lists_every_change(admin: Harness):
    response = admin.client.get("/admin/history")

    assert response.status_code == 200
    assert admin.audit.scores_only_requests == [False]
    assert response.json() == {
        "entries": [
            {
                "id": str(SCORE.id),
                "type": "score",
                "admin": {"id": str(ADMIN_ID), "display_name": "Alice"},
                "target_name": "Bob",
                "before": {"points": 8},
                "after": {"points": 11, "change": 3},
                "reason": "Lost uploads",
                "created_at": "2026-11-12T20:00:00Z",
            },
            {
                "id": str(EMAILS.id),
                "type": "emails",
                "admin": {"id": str(ADMIN_ID), "display_name": "Alice"},
                "target_name": None,
                "before": None,
                "after": {"email": "nora@example.test"},
                "reason": None,
                "created_at": "2026-11-11T20:00:00Z",
            },
        ]
    }


def test_history_can_show_scores_only(admin: Harness):
    response = admin.client.get("/admin/history", params={"type": "score"})

    assert admin.audit.scores_only_requests == [True]
    assert [entry["type"] for entry in response.json()["entries"]] == ["score"]


def test_history_rejects_unknown_type(admin: Harness):
    response = admin.client.get("/admin/history", params={"type": "rules"})

    assert response.status_code == 422
