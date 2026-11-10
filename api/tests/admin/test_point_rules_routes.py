from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import AuditEntry, get_audit_repo
from app.admin.rules_repo import PointRules, get_point_rules_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from tests.fakes import FakeAttemptsRepo, FakeAuditRepo, FakePlayersRepo, FakePointRulesRepo

ADMIN_ID = UUID("a1111111-1111-1111-1111-111111111111")
PLAYER_ID = UUID("b2222222-2222-2222-2222-222222222222")
ADMIN = CurrentUser(id=ADMIN_ID, email="alice@example.test")
PLAYER = CurrentUser(id=PLAYER_ID, email="bob@example.test")
PLAYERS = [
    Player(id=ADMIN_ID, display_name="Alice", is_admin=True, text_size="standard"),
    Player(id=PLAYER_ID, display_name="Bob", is_admin=False, text_size="standard"),
]
CURRENT = PointRules(
    regular=1,
    special=2,
    false_call=-1,
    categories=("Alien Green", "Racing stripes", "Exterior graphics", "Brown paint"),
)
CURRENT_JSON = {
    "regular": 1,
    "special": 2,
    "false_call": -1,
    "categories": ["Alien Green", "Racing stripes", "Exterior graphics", "Brown paint"],
}
VALID = {"regular": 2, "special": 3, "false_call": -2, "categories": ["Brown paint", " Fins "]}


class Harness:
    def __init__(self, user: CurrentUser) -> None:
        self.rules = FakePointRulesRepo(CURRENT)
        self.audit = FakeAuditRepo()
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(
            {"alice@example.test", "bob@example.test"}
        )
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_point_rules_repo] = lambda: self.rules
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


@pytest.mark.parametrize("method", ["get", "put"])
def test_players_cannot_use_settings(method: str):
    harness = Harness(PLAYER)

    response = harness.client.request(method, "/admin/settings", json=VALID)

    assert response.status_code == 403
    assert response.json() == {"error": "not_admin"}
    assert harness.rules.rules == CURRENT


def test_get_returns_current_rules(admin: Harness):
    response = admin.client.get("/admin/settings")

    assert response.status_code == 200
    assert response.json() == CURRENT_JSON


def test_put_saves_trimmed_rules_and_records_history(admin: Harness):
    response = admin.client.put("/admin/settings", json=VALID)

    saved = PointRules(regular=2, special=3, false_call=-2, categories=("Brown paint", "Fins"))
    assert response.status_code == 200
    assert response.json() == {**VALID, "categories": ["Brown paint", "Fins"]}
    assert admin.rules.rules == saved
    assert admin.audit.entries == [
        AuditEntry(
            admin_id=ADMIN_ID,
            type="rules",
            before=CURRENT_JSON,
            after={**VALID, "categories": ["Brown paint", "Fins"]},
        )
    ]


@pytest.mark.parametrize(
    "change",
    [
        {"regular": 0},
        {"regular": 11},
        {"special": 0},
        {"special": 11},
        {"false_call": 1},
        {"false_call": -11},
    ],
)
def test_put_rejects_points_out_of_range(admin: Harness, change: dict[str, int]):
    response = admin.client.put("/admin/settings", json={**VALID, **change})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_points"}
    assert admin.rules.rules == CURRENT
    assert admin.audit.entries == []


@pytest.mark.parametrize(
    "categories",
    [[], ["  "], ["x" * 25], ["Fins", "fins "]],
)
def test_put_rejects_bad_categories(admin: Harness, categories: list[str]):
    response = admin.client.put("/admin/settings", json={**VALID, "categories": categories})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_categories"}
    assert admin.rules.rules == CURRENT
