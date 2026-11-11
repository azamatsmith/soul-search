from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.main import create_app
from app.sightings.repo import LeaderboardEntry
from app.weeks.repo import PastWeek, get_weeks_repo
from tests.fakes import FakeAttemptsRepo, FakeWeeksRepo

BOB_ID = UUID("b2222222-2222-2222-2222-222222222222")
DANA_ID = UUID("d4444444-4444-4444-4444-444444444444")
BOB = CurrentUser(id=BOB_ID, email="bob@example.test")
START = datetime(2026, 11, 2, 8, tzinfo=UTC)

DANA_WON = PastWeek(
    id=UUID("22222222-2222-2222-2222-222222222222"),
    starts_at=START,
    ends_at=START + timedelta(days=7),
    rows=(
        LeaderboardEntry(DANA_ID, "Dana R.", 21, 16, 1),
        LeaderboardEntry(BOB_ID, "Bob", 18, 14, 2),
    ),
)
NOBODY_SCORED = PastWeek(
    id=UUID("11111111-1111-1111-1111-111111111111"),
    starts_at=START - timedelta(days=7),
    ends_at=START,
    rows=(),
)


@pytest.fixture
def repo() -> FakeWeeksRepo:
    repo = FakeWeeksRepo(current_week_id=uuid4())
    repo.weeks = [DANA_WON, NOBODY_SCORED]
    repo.total_players = 23
    return repo


@pytest.fixture
def client(repo: FakeWeeksRepo) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: BOB
    app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo({BOB.email})
    app.dependency_overrides[get_weeks_repo] = lambda: repo
    return TestClient(app)


def test_lists_past_weeks_with_winner_and_my_result(client: TestClient):
    body = client.get("/past-weeks").json()

    assert body == {
        "total_players": 23,
        "weeks": [
            {
                "id": str(DANA_WON.id),
                "starts_at": "2026-11-02T08:00:00Z",
                "ends_at": "2026-11-09T08:00:00Z",
                "winner": {
                    "player_id": str(DANA_ID),
                    "display_name": "Dana R.",
                    "points": 21,
                    "is_me": False,
                },
                "me": {"rank": 2, "points": 18},
            },
            {
                "id": str(NOBODY_SCORED.id),
                "starts_at": "2026-10-26T08:00:00Z",
                "ends_at": "2026-11-02T08:00:00Z",
                "winner": None,
                "me": None,
            },
        ],
    }


def test_marks_my_win(client: TestClient, repo: FakeWeeksRepo):
    repo.weeks = [
        PastWeek(
            id=DANA_WON.id,
            starts_at=START,
            ends_at=START + timedelta(days=7),
            rows=(LeaderboardEntry(BOB_ID, "Bob", 24, 20, 1),),
        )
    ]

    week = client.get("/past-weeks").json()["weeks"][0]

    assert week["winner"]["is_me"] is True
    assert week["me"] == {"rank": 1, "points": 24}


def test_shows_one_past_week(client: TestClient):
    body = client.get(f"/past-weeks/{DANA_WON.id}").json()

    assert body == {
        "id": str(DANA_WON.id),
        "starts_at": "2026-11-02T08:00:00Z",
        "ends_at": "2026-11-09T08:00:00Z",
        "rows": [
            {
                "player_id": str(DANA_ID),
                "display_name": "Dana R.",
                "points": 21,
                "count": 16,
                "rank": 1,
                "is_me": False,
            },
            {
                "player_id": str(BOB_ID),
                "display_name": "Bob",
                "points": 18,
                "count": 14,
                "rank": 2,
                "is_me": True,
            },
        ],
    }


def test_unknown_or_open_week_is_not_found(client: TestClient):
    response = client.get(f"/past-weeks/{uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}


def test_past_weeks_require_sign_in():
    client = TestClient(create_app())

    assert client.get("/past-weeks").status_code == 401
    assert client.get(f"/past-weeks/{uuid4()}").status_code == 401
