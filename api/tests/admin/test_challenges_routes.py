from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import get_audit_repo
from app.admin.challenges import Challenge, ChallengeRules
from app.admin.challenges_repo import ChallengeList, Winner, get_challenges_repo
from app.admin.rules_repo import PointRules, get_point_rules_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from tests.fakes import (
    FakeAttemptsRepo,
    FakeAuditRepo,
    FakeChallengesRepo,
    FakePlayersRepo,
    FakePointRulesRepo,
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
RULES = ChallengeRules(regular=1, false_call=-1, categories={"Brown paint": 3})
RULES_JSON = {
    "regular": 1,
    "false_call": -1,
    "categories": [{"name": "Brown paint", "points": 3}],
}
UPCOMING = Challenge(
    id=UUID("c3333333-3333-3333-3333-333333333333"),
    name="Brown Week",
    starts_at=NOW + timedelta(days=1),
    ends_at=NOW + timedelta(days=4),
    rules=RULES,
)
STARTED = Challenge(
    id=UUID("d4444444-4444-4444-4444-444444444444"),
    name="Thanksgiving Dash",
    starts_at=NOW - timedelta(hours=1),
    ends_at=NOW + timedelta(hours=3),
    rules=RULES,
)
BODY = {
    "name": " Brown Week ",
    "starts_at": "2026-11-13T17:00:00Z",
    "ends_at": "2026-11-16T07:59:00Z",
    "rules": RULES_JSON,
}
SAVED_JSON = {
    "name": "Brown Week",
    "starts_at": "2026-11-13T17:00:00Z",
    "ends_at": "2026-11-16T07:59:00Z",
    "rules": RULES_JSON,
}


class Harness:
    def __init__(
        self,
        user: CurrentUser,
        overlap: str | None = None,
        listing: ChallengeList | None = None,
    ) -> None:
        self.challenges = FakeChallengesRepo((UPCOMING, STARTED), overlap, listing)
        self.audit = FakeAuditRepo()
        rules = PointRules(
            regular=1, special=2, false_call=-1, categories=("Alien Green", "Brown paint")
        )
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(
            {"alice@example.test", "bob@example.test"}
        )
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_challenges_repo] = lambda: self.challenges
        app.dependency_overrides[get_point_rules_repo] = lambda: FakePointRulesRepo(rules)
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        app.dependency_overrides[get_now] = lambda: NOW
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/admin/challenges"),
        ("post", "/admin/challenges"),
        ("get", f"/admin/challenges/{UPCOMING.id}"),
        ("put", f"/admin/challenges/{UPCOMING.id}"),
        ("delete", f"/admin/challenges/{UPCOMING.id}"),
    ],
)
def test_non_admin_gets_403_on_every_route(method: str, path: str):
    harness = Harness(PLAYER)

    response = harness.client.request(method, path, json=BODY)

    assert response.status_code == 403
    assert harness.challenges.created == []
    assert harness.challenges.updated == []
    assert harness.challenges.deleted == []


def test_list_returns_buckets_and_winner():
    finished = Challenge(
        uuid4(), "Stripe Hunt", NOW - timedelta(days=9), NOW - timedelta(days=3), RULES
    )
    listing = ChallengeList(
        running=(STARTED,),
        upcoming=(UPCOMING,),
        finished=((finished, Winner("Marcus T.", 14)),),
    )
    harness = Harness(ADMIN, listing=listing)

    body = harness.client.get("/admin/challenges").json()

    assert [c["name"] for c in body["running"]] == ["Thanksgiving Dash"]
    assert body["upcoming"][0] == {
        "id": str(UPCOMING.id),
        "name": "Brown Week",
        "starts_at": "2026-11-13T20:00:00Z",
        "ends_at": "2026-11-16T20:00:00Z",
        "rules": RULES_JSON,
    }
    assert body["finished"][0]["winner"] == {"display_name": "Marcus T.", "points": 14}


def test_create_returns_201_and_records_history(admin: Harness):
    response = admin.client.post("/admin/challenges", json=BODY)

    assert response.status_code == 201
    created = response.json()
    assert created == {"id": created["id"], **SAVED_JSON}
    ((draft, admin_id),) = admin.challenges.created
    assert (draft.name, admin_id) == ("Brown Week", ADMIN_ID)
    (entry,) = admin.audit.entries
    assert entry.type == "challenge"
    assert entry.target_id == UUID(created["id"])
    assert entry.before is None
    assert entry.after == SAVED_JSON


def test_create_rejects_overlap_with_its_name():
    harness = Harness(ADMIN, overlap="Thanksgiving Dash")

    response = harness.client.post("/admin/challenges", json=BODY)

    assert response.status_code == 422
    assert response.json() == {"error": "overlaps", "name": "Thanksgiving Dash"}
    assert harness.challenges.created == []
    assert harness.audit.entries == []


def test_create_passes_settings_categories_to_validation(admin: Harness):
    body = {**BODY, "rules": {**RULES_JSON, "categories": [{"name": "Purple", "points": 3}]}}

    response = admin.client.post("/admin/challenges", json=body)

    assert response.json() == {"error": "invalid_category"}


def test_create_rejects_a_repeated_category(admin: Harness):
    brown = {"name": "Brown paint", "points": 3}
    body = {**BODY, "rules": {**RULES_JSON, "categories": [brown, brown]}}

    response = admin.client.post("/admin/challenges", json=body)

    assert response.json() == {"error": "invalid_category"}
    assert admin.challenges.created == []


def test_naive_datetimes_are_rejected(admin: Harness):
    response = admin.client.post(
        "/admin/challenges", json={**BODY, "starts_at": "2026-11-13T09:00:00"}
    )

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def test_update_started_challenge_cannot_move_start(admin: Harness):
    response = admin.client.put(f"/admin/challenges/{STARTED.id}", json=BODY)

    assert response.json() == {"error": "start_locked"}
    assert admin.challenges.updated == []


def test_update_checks_overlap_excluding_itself(admin: Harness):
    admin.client.put(f"/admin/challenges/{UPCOMING.id}", json=BODY)

    assert admin.challenges.overlap_requests[0][2] == UPCOMING.id


def test_update_records_before_and_after(admin: Harness):
    response = admin.client.put(f"/admin/challenges/{UPCOMING.id}", json=BODY)

    assert response.status_code == 200
    assert response.json() == {"id": str(UPCOMING.id), **SAVED_JSON}
    (entry,) = admin.audit.entries
    assert entry.before is not None
    assert entry.before["starts_at"] == "2026-11-13T20:00:00Z"
    assert entry.after == SAVED_JSON


@pytest.mark.parametrize(("challenge", "started"), [(UPCOMING, False), (STARTED, True)])
def test_get_detail_reports_started(admin: Harness, challenge: Challenge, started: bool):
    body = admin.client.get(f"/admin/challenges/{challenge.id}").json()

    assert body["name"] == challenge.name
    assert body["started"] is started


@pytest.mark.parametrize("method", ["get", "put", "delete"])
def test_unknown_id_is_404_for_get_put_delete(admin: Harness, method: str):
    response = admin.client.request(method, f"/admin/challenges/{uuid4()}", json=BODY)

    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}
    assert admin.audit.entries == []


def test_delete_returns_204_and_records_history(admin: Harness):
    response = admin.client.delete(f"/admin/challenges/{UPCOMING.id}")

    assert response.status_code == 204
    assert admin.challenges.deleted == [UPCOMING.id]
    (entry,) = admin.audit.entries
    assert entry.after is None
    assert entry.before is not None
    assert entry.before["name"] == "Brown Week"


@pytest.mark.parametrize(("method", "path"), [("post", ""), ("put", f"/{UPCOMING.id}")])
def test_database_overlap_is_reported_as_overlaps(method: str, path: str):
    harness = Harness(ADMIN)
    harness.challenges.write_conflict = "Thanksgiving Dash"

    response = harness.client.request(method, f"/admin/challenges{path}", json=BODY)

    assert response.status_code == 422
    assert response.json() == {"error": "overlaps", "name": "Thanksgiving Dash"}
    assert harness.audit.entries == []
