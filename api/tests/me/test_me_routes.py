from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.tokens import CurrentUser, get_current_user
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from tests.fakes import FakePlayersRepo

USER_ID = UUID("b2222222-2222-2222-2222-222222222222")
USER = CurrentUser(id=USER_ID, email="bob@example.test")
ALICE = Player(
    id=UUID("a1111111-1111-1111-1111-111111111111"),
    display_name="Alice",
    is_admin=True,
    text_size="standard",
)


def client_for(user: CurrentUser, players: FakePlayersRepo) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_players_repo] = lambda: players
    return TestClient(app)


@pytest.fixture
def players() -> FakePlayersRepo:
    return FakePlayersRepo([ALICE], flagged=3)


def test_me_before_name_step(players: FakePlayersRepo):
    response = client_for(USER, players).get("/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(USER_ID),
        "email": "bob@example.test",
        "display_name": None,
        "is_admin": False,
        "text_size": "standard",
        "flagged_count": None,
    }


def test_me_admin_gets_flagged_count(players: FakePlayersRepo):
    admin = CurrentUser(id=ALICE.id, email="alice@example.test")

    body = client_for(admin, players).get("/me").json()

    assert body["display_name"] == "Alice"
    assert body["is_admin"] is True
    assert body["flagged_count"] == 3


def test_me_player_flagged_count_null(players: FakePlayersRepo):
    players.players[USER_ID] = Player(USER_ID, "Bob", False, "large")

    body = client_for(USER, players).get("/me").json()

    assert body["text_size"] == "large"
    assert body["flagged_count"] is None


def test_put_name_creates_and_returns_me(players: FakePlayersRepo):
    response = client_for(USER, players).put("/me/display-name", json={"display_name": " Bob K. "})

    assert response.status_code == 200
    assert response.json()["display_name"] == "Bob K."
    assert players.players[USER_ID].display_name == "Bob K."


@pytest.mark.parametrize(("name", "code"), [("B", "too_short"), ("Bob 🚗", "invalid")])
def test_put_name_rule_errors_422(players: FakePlayersRepo, name: str, code: str):
    response = client_for(USER, players).put("/me/display-name", json={"display_name": name})

    assert response.status_code == 422
    assert response.json() == {"error": code}
    assert USER_ID not in players.players


def test_put_name_taken_409(players: FakePlayersRepo):
    response = client_for(USER, players).put("/me/display-name", json={"display_name": "ALICE"})

    assert response.status_code == 409
    assert response.json() == {"error": "name_taken"}


def test_me_requires_auth_401(players: FakePlayersRepo):
    app = create_app()
    app.dependency_overrides[get_players_repo] = lambda: players

    response = TestClient(app).get("/me")

    assert response.status_code == 401
    assert response.json() == {"error": "unauthenticated"}
