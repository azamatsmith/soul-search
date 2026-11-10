from dataclasses import replace
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.sightings.photo_store import StorageUnavailable, get_photo_store
from app.sightings.repo import Period, get_sightings_repo
from app.sightings.scoring import Rules
from tests.fakes import EMPTY_STANDING, FakeAttemptsRepo, FakePhotoStore, FakeSightingsRepo

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
        self.store = FakePhotoStore()
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: BOB
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo({BOB.email})
        app.dependency_overrides[get_sightings_repo] = lambda: repo
        app.dependency_overrides[get_photo_store] = lambda: self.store
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


def test_standing_before_any_sighting(harness: Harness):
    body = harness.client.get("/me/standing").json()

    assert body == {
        "points": 0,
        "count": 0,
        "rank": None,
        "total_players": 3,
        "next_rank": None,
        "points_behind_next": None,
        "last_photo_url": None,
    }


def test_standing_signs_last_photo(harness: Harness):
    harness.repo.standings[BOB_ID] = replace(
        EMPTY_STANDING,
        points=5,
        count=4,
        rank=2,
        next_rank=1,
        points_behind_next=3,
        last_photo_path=f"{BOB_ID}/s.jpg",
    )

    body = harness.client.get("/me/standing").json()

    assert body["last_photo_url"] == f"https://signed.test/{BOB_ID}/s.jpg?ttl=3600"
    assert (body["points"], body["rank"], body["points_behind_next"]) == (5, 2, 3)


def test_standing_still_loads_when_storage_is_down(harness: Harness):
    harness.repo.standings[BOB_ID] = replace(EMPTY_STANDING, last_photo_path="p.jpg")
    harness.store.fail = StorageUnavailable("down")

    response = harness.client.get("/me/standing")

    assert response.status_code == 200
    assert response.json()["last_photo_url"] is None


def test_endpoints_require_sign_in():
    client = TestClient(create_app())

    assert client.get("/period").status_code == 401
    assert client.get("/me/standing").status_code == 401
