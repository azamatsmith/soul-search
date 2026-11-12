from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import AuditEntry, get_audit_repo
from app.admin.scores_repo import PlayerScore, get_scores_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from app.sightings.repo import Period, get_sightings_repo
from app.sightings.scoring import Rules
from tests.fakes import (
    FakeAttemptsRepo,
    FakeAuditRepo,
    FakePlayersRepo,
    FakeScoresRepo,
    FakeSightingsRepo,
)

ADMIN_ID = UUID("a1111111-1111-1111-1111-111111111111")
PLAYER_ID = UUID("b2222222-2222-2222-2222-222222222222")
ADMIN = CurrentUser(id=ADMIN_ID, email="alice@example.test")
PLAYER = CurrentUser(id=PLAYER_ID, email="bob@example.test")
PLAYERS = [
    Player(id=ADMIN_ID, display_name="Alice", is_admin=True, text_size="standard"),
    Player(id=PLAYER_ID, display_name="Bob", is_admin=False, text_size="standard"),
]
NOW = datetime(2026, 11, 12, 20, tzinfo=UTC)
RULES = Rules(regular=1, special=2, false_call=-1, categories={})
WEEK = Period(
    kind="week",
    id=UUID("11111111-1111-1111-1111-111111111111"),
    name=None,
    starts_at=datetime(2026, 11, 9, 8, tzinfo=UTC),
    ends_at=datetime(2026, 11, 16, 8, tzinfo=UTC),
    closed=False,
    rules=RULES,
)
CHALLENGE = Period(
    kind="challenge",
    id=UUID("22222222-2222-2222-2222-222222222222"),
    name="Brown Week",
    starts_at=datetime(2026, 11, 12, 18, tzinfo=UTC),
    ends_at=datetime(2026, 11, 12, 22, tzinfo=UTC),
    closed=False,
    rules=RULES,
)
VALID = {"player_id": str(PLAYER_ID), "change": 3, "reason": " Lost uploads "}


class Harness:
    def __init__(self, user: CurrentUser, period: Period = WEEK) -> None:
        self.scores = FakeScoresRepo(
            [
                PlayerScore(id=ADMIN_ID, display_name="Alice", points=0),
                PlayerScore(id=PLAYER_ID, display_name="Bob", points=8),
            ]
        )
        self.audit = FakeAuditRepo()
        self.sightings = FakeSightingsRepo(period)
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(
            {"alice@example.test", "bob@example.test"}
        )
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_scores_repo] = lambda: self.scores
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        app.dependency_overrides[get_sightings_repo] = lambda: self.sightings
        app.dependency_overrides[get_now] = lambda: NOW
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


@pytest.mark.parametrize("method", ["get", "post"])
def test_players_cannot_adjust_scores(method: str):
    harness = Harness(PLAYER)

    response = harness.client.request(method, "/admin/scores", json=VALID)

    assert response.status_code == 403
    assert harness.scores.adjustments == []


def test_get_lists_players_for_the_week(admin: Harness):
    response = admin.client.get("/admin/scores")

    assert response.status_code == 200
    assert response.json() == {
        "period": {"kind": "week", "name": None},
        "players": [
            {"id": str(ADMIN_ID), "display_name": "Alice", "points": 0},
            {"id": str(PLAYER_ID), "display_name": "Bob", "points": 8},
        ],
    }
    assert admin.sightings.period_requests == [NOW]


def test_get_names_a_running_challenge():
    harness = Harness(ADMIN, CHALLENGE)

    period = harness.client.get("/admin/scores").json()["period"]

    assert period == {"kind": "challenge", "name": "Brown Week"}


def test_post_saves_the_adjustment_and_records_history(admin: Harness):
    response = admin.client.post("/admin/scores", json=VALID)

    assert response.status_code == 200
    assert response.json() == {"player_id": str(PLAYER_ID), "points": 11}
    assert admin.scores.adjustments == [(PLAYER_ID, ADMIN_ID, WEEK, 3, "Lost uploads")]
    assert admin.audit.entries == [
        AuditEntry(
            admin_id=ADMIN_ID,
            type="score",
            target_id=PLAYER_ID,
            before={"points": 8},
            after={"points": 11, "change": 3},
            reason="Lost uploads",
        )
    ]


def test_post_during_a_challenge_adjusts_the_challenge():
    harness = Harness(ADMIN, CHALLENGE)

    harness.client.post("/admin/scores", json={**VALID, "change": -2})

    assert harness.scores.adjustments == [(PLAYER_ID, ADMIN_ID, CHALLENGE, -2, "Lost uploads")]


@pytest.mark.parametrize("change", [0, 11, -11])
def test_post_rejects_changes_out_of_range(admin: Harness, change: int):
    response = admin.client.post("/admin/scores", json={**VALID, "change": change})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_change"}
    assert admin.scores.adjustments == []


@pytest.mark.parametrize("reason", ["   ", "x" * 201])
def test_post_needs_a_short_reason(admin: Harness, reason: str):
    response = admin.client.post("/admin/scores", json={**VALID, "reason": reason})

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_reason"}
    assert admin.audit.entries == []


def test_post_for_an_unknown_player_is_404(admin: Harness):
    response = admin.client.post(
        "/admin/scores", json={**VALID, "player_id": "00000000-0000-0000-0000-000000000000"}
    )

    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}
