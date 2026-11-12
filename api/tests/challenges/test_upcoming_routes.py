from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi.testclient import TestClient

from app.admin.challenges import Challenge, ChallengeRules
from app.admin.challenges_repo import ChallengeList, get_challenges_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from tests.fakes import FakeAttemptsRepo, FakeChallengesRepo

PLAYER = CurrentUser(id=UUID("b2222222-2222-2222-2222-222222222222"), email="bob@example.test")
NOW = datetime(2026, 11, 12, 20, tzinfo=UTC)
DASH = Challenge(
    id=UUID("c3333333-3333-3333-3333-333333333333"),
    name="Thanksgiving Dash",
    starts_at=NOW + timedelta(days=14),
    ends_at=NOW + timedelta(days=14, hours=4),
    rules=ChallengeRules(regular=1, false_call=-1, categories={"Alien Green": 3}),
)


def client_for(allowed: set[str], upcoming: tuple[Challenge, ...] = ()) -> TestClient:
    app = create_app()
    listing = ChallengeList(running=(), upcoming=upcoming, finished=())
    app.dependency_overrides[get_current_user] = lambda: PLAYER
    app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(allowed)
    app.dependency_overrides[get_challenges_repo] = lambda: FakeChallengesRepo(listing=listing)
    app.dependency_overrides[get_now] = lambda: NOW
    return TestClient(app)


def test_players_see_upcoming_challenges():
    client = client_for({PLAYER.email}, (DASH,))

    response = client.get("/challenges/upcoming")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(DASH.id),
            "name": "Thanksgiving Dash",
            "starts_at": "2026-11-26T20:00:00Z",
            "ends_at": "2026-11-27T00:00:00Z",
            "rules": {
                "regular": 1,
                "false_call": -1,
                "categories": [{"name": "Alien Green", "points": 3}],
            },
        }
    ]


def test_no_upcoming_challenges_is_empty():
    response = client_for({PLAYER.email}).get("/challenges/upcoming")

    assert response.json() == []


def test_upcoming_challenges_need_an_allowed_player():
    response = client_for(set(), (DASH,)).get("/challenges/upcoming")

    assert response.status_code == 403
