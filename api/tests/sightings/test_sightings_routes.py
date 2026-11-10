from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.sightings.repo import Period, get_sightings_repo
from app.sightings.scoring import Rules
from tests.fakes import FakeAttemptsRepo, FakeSightingsRepo

NOW = datetime(2026, 11, 10, 18, tzinfo=UTC)
BOB_ID = UUID("b2222222-2222-2222-2222-222222222222")
BOB = CurrentUser(id=BOB_ID, email="bob@example.test")
RULES = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories=("Alien Green", "Brown paint"),
    bonuses={"Brown paint": 3},
)
WEEK = Period(
    kind="week",
    id=UUID("11111111-1111-1111-1111-111111111111"),
    name=None,
    starts_at=datetime(2026, 11, 9, 8, tzinfo=UTC),
    ends_at=datetime(2026, 11, 16, 8, tzinfo=UTC),
    closed=False,
    rules=RULES,
)


class Harness:
    def __init__(self, repo: FakeSightingsRepo) -> None:
        self.repo = repo
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: BOB
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo({BOB.email})
        app.dependency_overrides[get_sightings_repo] = lambda: repo
        app.dependency_overrides[get_now] = lambda: NOW
        self.client = TestClient(app)


@pytest.fixture
def harness() -> Harness:
    return Harness(FakeSightingsRepo(WEEK))


def test_get_period_returns_rules(harness: Harness):
    body = harness.client.get("/period").json()

    assert body == {
        "kind": "week",
        "id": str(WEEK.id),
        "name": None,
        "starts_at": "2026-11-09T08:00:00Z",
        "ends_at": "2026-11-16T08:00:00Z",
        "rules": {
            "regular": 1,
            "special": 2,
            "false_call": -1,
            "categories": ["Alien Green", "Brown paint"],
            "bonuses": {"Brown paint": 3},
        },
    }
    assert harness.repo.period_requests == [NOW]


def test_get_period_names_a_running_challenge():
    challenge = replace(WEEK, kind="challenge", name="Brown Week")

    body = Harness(FakeSightingsRepo(challenge)).client.get("/period").json()

    assert (body["kind"], body["name"]) == ("challenge", "Brown Week")


def test_endpoints_require_sign_in():
    client = TestClient(create_app())

    assert client.get("/period").status_code == 401
