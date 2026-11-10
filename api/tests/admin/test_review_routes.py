from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.admin.audit_repo import AuditEntry, get_audit_repo
from app.admin.review import Decision
from app.admin.review_repo import get_review_repo
from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from app.sightings.photo_store import get_photo_store
from app.sightings.scoring import Rules
from app.sightings.url_cache import SignedUrlCache, get_url_cache
from tests.admin.test_review import item
from tests.fakes import (
    FakeAttemptsRepo,
    FakeAuditRepo,
    FakePhotoStore,
    FakePlayersRepo,
    FakeReviewRepo,
)

ADMIN_ID = UUID("a1111111-1111-1111-1111-111111111111")
PLAYER_ID = UUID("b2222222-2222-2222-2222-222222222222")
ADMIN = CurrentUser(id=ADMIN_ID, email="alice@example.test")
PLAYER = CurrentUser(id=PLAYER_ID, email="bob@example.test")
PLAYERS = [
    Player(id=ADMIN_ID, display_name="Alice", is_admin=True, text_size="standard"),
    Player(id=PLAYER_ID, display_name="Bob", is_admin=False, text_size="standard"),
]
NOW = datetime(2030, 6, 12, 20, tzinfo=UTC)
RULES = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories=("Alien Green", "Racing stripes"),
    bonuses={},
)
FLAGGED = item()
FALSE_CALL = item(
    id=UUID("f6666666-6666-6666-6666-666666666666"),
    photo_path="b/false.jpg",
    taken_at=FLAGGED.taken_at - timedelta(hours=1),
    claim_type="regular",
    categories=(),
    points=-1,
    status="false_call",
    flagged=False,
    check_note="This didn't look like a Kia Soul.",
)


class Harness:
    def __init__(self, user: CurrentUser) -> None:
        self.review = FakeReviewRepo([FLAGGED, FALSE_CALL], RULES)
        self.audit = FakeAuditRepo()
        self.store = FakePhotoStore()
        self.store.uploads = {"b/photo.jpg": b"", "b/photo.thumb.jpg": b"", "b/false.jpg": b""}
        app = create_app()
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo(
            {"alice@example.test", "bob@example.test"}
        )
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo(PLAYERS)
        app.dependency_overrides[get_review_repo] = lambda: self.review
        app.dependency_overrides[get_audit_repo] = lambda: self.audit
        app.dependency_overrides[get_photo_store] = lambda: self.store
        app.dependency_overrides[get_url_cache] = SignedUrlCache
        app.dependency_overrides[get_now] = lambda: NOW
        self.client = TestClient(app)


@pytest.fixture
def admin() -> Harness:
    return Harness(ADMIN)


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/admin/review"),
        ("get", f"/admin/review/{FLAGGED.id}"),
        ("post", f"/admin/review/{FLAGGED.id}"),
    ],
)
def test_players_cannot_review(method: str, path: str):
    harness = Harness(PLAYER)

    response = harness.client.request(method, path, json={"action": "keep"})

    assert response.status_code == 403
    assert harness.review.resolved == {}


def test_queue_splits_flagged_photos_from_false_calls(admin: Harness):
    response = admin.client.get("/admin/review")

    assert response.status_code == 200
    body = response.json()
    assert [entry["id"] for entry in body["flagged"]] == [str(FLAGGED.id)]
    assert [entry["id"] for entry in body["false_calls"]] == [str(FALSE_CALL.id)]
    assert body["flagged"][0] == {
        "id": str(FLAGGED.id),
        "display_name": "Bob",
        "taken_at": "2030-06-12T18:00:00Z",
        "claim_type": "special",
        "categories": ["Alien Green"],
        "points": 2,
        "status": "counted",
        "check_note": "Color looks closer to light blue.",
        "verification_notes": "Kia Soul, color unclear.",
        "photo_url": "https://signed.test/b/photo.jpg?ttl=3600",
        "thumb_url": "https://signed.test/b/photo.thumb.jpg?ttl=3600",
    }


def test_queue_falls_back_to_the_photo_when_there_is_no_thumb(admin: Harness):
    false_call = admin.client.get("/admin/review").json()["false_calls"][0]

    assert false_call["thumb_url"] == "https://signed.test/b/false.jpg?ttl=3600"


def test_get_one_returns_the_item(admin: Harness):
    response = admin.client.get(f"/admin/review/{FALSE_CALL.id}")

    assert response.status_code == 200
    assert response.json()["status"] == "false_call"


def test_get_one_that_is_not_waiting_is_404(admin: Harness):
    response = admin.client.get("/admin/review/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404
    assert response.json() == {"error": "not_found"}


def test_change_to_regular_saves_and_records_history(admin: Harness):
    response = admin.client.post(f"/admin/review/{FLAGGED.id}", json={"action": "regular"})

    assert response.status_code == 204
    after = Decision(status="counted", claim_type="regular", categories=(), points=1)
    assert admin.review.resolved == {FLAGGED.id: (after, ADMIN_ID)}
    assert admin.audit.entries == [
        AuditEntry(
            admin_id=ADMIN_ID,
            type="photo",
            target_id=FLAGGED.id,
            before={
                "status": "counted",
                "claim_type": "special",
                "categories": ["Alien Green"],
                "points": 2,
                "flagged": True,
            },
            after={
                "status": "counted",
                "claim_type": "regular",
                "categories": [],
                "points": 1,
                "flagged": False,
            },
        )
    ]


def test_restore_as_special_uses_the_picked_category(admin: Harness):
    response = admin.client.post(
        f"/admin/review/{FALSE_CALL.id}", json={"action": "special", "category": "Racing stripes"}
    )

    assert response.status_code == 204
    decision, _ = admin.review.resolved[FALSE_CALL.id]
    assert decision == Decision(
        status="counted", claim_type="special", categories=("Racing stripes",), points=2
    )


@pytest.mark.parametrize("body", [{"action": "special"}, {"action": "special", "category": "Fins"}])
def test_special_needs_a_known_category(admin: Harness, body: dict[str, str]):
    response = admin.client.post(f"/admin/review/{FALSE_CALL.id}", json=body)

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_category"}
    assert admin.review.resolved == {}
    assert admin.audit.entries == []


def test_unknown_action_is_rejected(admin: Harness):
    response = admin.client.post(f"/admin/review/{FLAGGED.id}", json={"action": "delete"})

    assert response.status_code == 422


def test_reviewing_a_missing_photo_is_404(admin: Harness):
    response = admin.client.post(
        "/admin/review/00000000-0000-0000-0000-000000000000", json={"action": "keep"}
    )

    assert response.status_code == 404


def test_losing_a_race_to_another_admin_is_409(admin: Harness):
    admin.review.lose_race = True

    response = admin.client.post(f"/admin/review/{FLAGGED.id}", json={"action": "keep"})

    assert response.status_code == 409
    assert response.json() == {"error": "already_reviewed"}
    assert admin.audit.entries == []


def test_keep_records_the_cleared_flag(admin: Harness):
    admin.client.post(f"/admin/review/{FLAGGED.id}", json={"action": "keep"})

    entry = admin.audit.entries[0]
    assert entry.before and entry.after
    assert (entry.before["flagged"], entry.after["flagged"]) == (True, False)
    assert entry.after["points"] == FLAGGED.points
