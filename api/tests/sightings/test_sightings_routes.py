import io
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.auth.attempts_repo import get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.clock import get_now
from app.main import create_app
from app.me.players_repo import Player, get_players_repo
from app.sightings.photo_store import StorageUnavailable, get_photo_store
from app.sightings.repo import (
    Leaderboard,
    LeaderboardEntry,
    LoggedSighting,
    Period,
    Sighting,
    get_sightings_repo,
)
from app.sightings.scoring import Rules
from app.sightings.url_cache import SignedUrlCache, get_url_cache
from app.verification.runner import get_verification_runner
from tests.fakes import (
    EMPTY_STANDING,
    FakeAttemptsRepo,
    FakePhotoStore,
    FakePlayersRepo,
    FakeSightingsRepo,
)
from tests.sightings.photos import SEATTLE, jpeg

NOW = datetime(2026, 11, 10, 18, tzinfo=UTC)
BOB_ID = UUID("b2222222-2222-2222-2222-222222222222")
BOB = CurrentUser(id=BOB_ID, email="bob@example.test")
BOB_PLAYER = Player(id=BOB_ID, display_name="Bob", is_admin=False, text_size="standard")
ALICE_ID = UUID("a1111111-1111-1111-1111-111111111111")
RULES = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories={"Alien Green": 2, "Brown paint": 2},
)
BROWN_WEEK_RULES = Rules(regular=1, special=None, false_call=-1, categories={"Brown paint": 3})
WEEK = Period(
    kind="week",
    id=UUID("11111111-1111-1111-1111-111111111111"),
    name=None,
    starts_at=datetime(2026, 11, 9, 8, tzinfo=UTC),
    ends_at=datetime(2026, 11, 16, 8, tzinfo=UTC),
    closed=False,
    rules=RULES,
)
JPEG = jpeg()


class Harness:
    def __init__(self, repo: FakeSightingsRepo) -> None:
        self.repo = repo
        self.store = FakePhotoStore()
        self.url_cache = SignedUrlCache()
        self.verification_runs = 0
        app = create_app()
        self.app = app
        app.dependency_overrides[get_url_cache] = lambda: self.url_cache
        app.dependency_overrides[get_current_user] = lambda: BOB
        app.dependency_overrides[get_attempts_repo] = lambda: FakeAttemptsRepo({BOB.email})
        app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo([BOB_PLAYER])
        app.dependency_overrides[get_sightings_repo] = lambda: repo
        app.dependency_overrides[get_photo_store] = lambda: self.store
        app.dependency_overrides[get_now] = lambda: NOW
        app.dependency_overrides[get_verification_runner] = lambda: self.run_verification
        self.client = TestClient(app)

    def run_verification(self) -> None:
        self.verification_runs += 1

    def post(self, *, photo: bytes = JPEG, content_type: str = "image/jpeg", **fields: object):
        data: dict[str, object] = {
            "id": str(uuid4()),
            "claim_type": "regular",
            "taken_at": (NOW - timedelta(minutes=1)).isoformat(),
            **fields,
        }
        files = {"photo": ("photo.jpg", photo, content_type)}
        return self.client.post("/sightings", data=data, files=files)


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
            "categories": [
                {"name": "Alien Green", "points": 2},
                {"name": "Brown paint", "points": 2},
            ],
        },
    }
    assert harness.repo.period_requests == [NOW]


def test_get_period_names_a_running_challenge_and_its_categories():
    challenge = replace(WEEK, kind="challenge", name="Brown Week", rules=BROWN_WEEK_RULES)

    body = Harness(FakeSightingsRepo(challenge)).client.get("/period").json()

    assert (body["kind"], body["name"]) == ("challenge", "Brown Week")
    assert body["rules"] == {
        "regular": 1,
        "special": None,
        "false_call": -1,
        "categories": [{"name": "Brown paint", "points": 3}],
    }


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
    harness.store.uploads[f"{BOB_ID}/s.jpg"] = JPEG
    harness.store.uploads[f"{BOB_ID}/s.thumb.jpg"] = JPEG

    body = harness.client.get("/me/standing").json()

    assert body["last_photo_url"] == f"https://signed.test/{BOB_ID}/s.thumb.jpg?ttl=3600"
    assert (body["points"], body["rank"], body["points_behind_next"]) == (5, 2, 3)


def test_standing_falls_back_to_the_full_photo_without_smaller_sizes(harness: Harness):
    harness.repo.standings[BOB_ID] = replace(EMPTY_STANDING, rank=1, last_photo_path="p.jpg")
    harness.store.uploads["p.jpg"] = JPEG

    body = harness.client.get("/me/standing").json()

    assert body["last_photo_url"] == "https://signed.test/p.jpg?ttl=3600"


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
    assert client.get("/leaderboard?scope=week").status_code == 401
    assert client.get("/sightings").status_code == 401


def test_post_regular_sighting_uploads_and_scores(harness: Harness):
    sighting_id = uuid4()

    response = harness.post(id=str(sighting_id), latitude="47.6", longitude="-122.3")

    assert response.status_code == 201
    body = response.json()
    assert body["sighting"]["id"] == str(sighting_id)
    assert body["sighting"]["points"] == 1
    assert body["sighting"]["status"] == "waiting_review"
    assert body["period_points"] == 1
    path = f"{BOB_ID}/{sighting_id}.jpg"
    assert list(harness.store.uploads) == [
        path,
        f"{BOB_ID}/{sighting_id}.thumb.jpg",
        f"{BOB_ID}/{sighting_id}.display.jpg",
    ]
    (new,) = harness.repo.inserted
    assert (new.photo_path, new.week_id, new.challenge_id) == (path, WEEK.id, None)
    assert (new.latitude, new.longitude) == (47.6, -122.3)


def test_post_strips_exif_and_keeps_its_location(harness: Harness):
    harness.post(photo=jpeg(gps=SEATTLE))

    (new,) = harness.repo.inserted
    assert new.latitude == pytest.approx(47.6)
    assert new.longitude == pytest.approx(-122.33)
    assert len(harness.store.uploads) == 3
    for stored in harness.store.uploads.values():
        assert dict(Image.open(io.BytesIO(stored)).getexif()) == {}


def test_post_prefers_phone_location_over_exif(harness: Harness):
    harness.post(photo=jpeg(gps=SEATTLE), latitude="45.5", longitude="-122.6")

    (new,) = harness.repo.inserted
    assert (new.latitude, new.longitude) == (45.5, -122.6)


def test_post_special_uses_special_points(harness: Harness):
    response = harness.post(claim_type="special", categories=["Brown paint"])

    assert response.json()["sighting"]["points"] == 2
    assert harness.repo.inserted[0].categories == ("Brown paint",)


def test_post_challenge_category_uses_its_points():
    challenge = replace(WEEK, kind="challenge", name="Brown Week", rules=BROWN_WEEK_RULES)
    harness = Harness(FakeSightingsRepo(challenge))

    response = harness.post(claim_type="challenge", categories=["Brown paint"])

    assert response.json()["sighting"]["points"] == 3
    assert harness.repo.inserted[0].claim_type == "challenge"


def test_post_special_during_a_challenge_is_rejected():
    challenge = replace(WEEK, kind="challenge", name="Brown Week", rules=BROWN_WEEK_RULES)
    harness = Harness(FakeSightingsRepo(challenge))

    response = harness.post(claim_type="special", categories=["Brown paint"])

    assert response.json() == {"error": "invalid_claim"}
    assert harness.repo.inserted == []


def test_post_during_challenge_tags_challenge():
    challenge = replace(WEEK, kind="challenge", name="Brown Week")
    harness = Harness(FakeSightingsRepo(challenge))

    harness.post()

    (new,) = harness.repo.inserted
    assert (new.week_id, new.challenge_id) == (None, challenge.id)


def test_post_for_closed_week_falls_into_current_period():
    closed = replace(WEEK, id=uuid4(), closed=True)
    harness = Harness(FakeSightingsRepo(closed, closed_fallback=WEEK))
    taken_at = NOW - timedelta(days=8)

    harness.post(taken_at=taken_at.isoformat())

    assert harness.repo.period_requests == [taken_at, NOW]
    assert harness.repo.inserted[0].week_id == WEEK.id


def test_post_for_ended_challenge_falls_into_current_period():
    ended = replace(
        WEEK,
        kind="challenge",
        id=uuid4(),
        name="Thanksgiving Dash",
        ends_at=NOW - timedelta(minutes=30),
    )
    harness = Harness(FakeSightingsRepo(ended, closed_fallback=WEEK))
    taken_at = NOW - timedelta(hours=1)

    harness.post(taken_at=taken_at.isoformat())

    assert harness.repo.period_requests == [taken_at, NOW]
    (new,) = harness.repo.inserted
    assert (new.week_id, new.challenge_id) == (WEEK.id, None)


def test_post_same_id_again_returns_existing_without_reupload(harness: Harness):
    sighting_id = str(uuid4())
    harness.post(id=sighting_id)
    harness.store.uploads.clear()

    response = harness.post(id=sighting_id, claim_type="special", categories=["Alien Green"])

    assert response.status_code == 200
    assert response.json()["sighting"]["points"] == 1
    assert harness.store.uploads == {}
    assert len(harness.repo.inserted) == 1


def test_post_starts_verification_once_per_new_sighting(harness: Harness):
    sighting_id = str(uuid4())

    harness.post(id=sighting_id)
    harness.post(id=sighting_id)

    assert harness.verification_runs == 1


def test_post_does_not_verify_when_the_upload_fails(harness: Harness):
    harness.store.fail = StorageUnavailable("down")

    harness.post()

    assert harness.verification_runs == 0


def test_post_response_never_includes_plate_or_admin_notes(harness: Harness):
    sighting = harness.post().json()["sighting"]

    assert set(sighting) == {
        "id",
        "taken_at",
        "claim_type",
        "categories",
        "points",
        "status",
        "flagged",
    }


def test_post_with_another_players_id_is_rejected(harness: Harness):
    taken = uuid4()
    harness.repo.sightings[taken] = Sighting(
        id=taken,
        player_id=ALICE_ID,
        photo_path=f"{ALICE_ID}/{taken}.jpg",
        taken_at=NOW,
        claim_type="regular",
        categories=(),
        points=1,
        status="counted",
        flagged=False,
    )

    response = harness.post(id=str(taken))

    assert response.status_code == 409
    assert response.json() == {"error": "conflict"}
    assert harness.store.uploads == {}


@pytest.mark.parametrize(
    "fields",
    [
        {"claim_type": "special"},
        {"claim_type": "special", "categories": ["Purple"]},
        {"claim_type": "regular", "categories": ["Alien Green"]},
        {"claim_type": "special", "categories": ["Alien Green", "Brown paint"]},
    ],
    ids=["no-category", "unknown-category", "regular-with-category", "several-categories"],
)
def test_post_invalid_claim_is_rejected(harness: Harness, fields: dict[str, object]):
    response = harness.post(**fields)

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_claim"}
    assert harness.store.uploads == {}


@pytest.mark.parametrize(
    ("photo", "content_type"),
    [
        (b"GIF89a", "image/jpeg"),
        (JPEG, "image/png"),
        (b"", "image/jpeg"),
        (b"\xff\xd8\xff\xe0broken", "image/jpeg"),
    ],
    ids=["not-jpeg-bytes", "wrong-type", "empty", "corrupt-jpeg"],
)
def test_post_non_jpeg_is_rejected(harness: Harness, photo: bytes, content_type: str):
    response = harness.post(photo=photo, content_type=content_type)

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_photo"}


def test_post_oversized_photo_is_rejected(harness: Harness):
    response = harness.post(photo=JPEG + b"0" * (8 * 1024 * 1024))

    assert response.status_code == 413
    assert response.json() == {"error": "photo_too_large"}


@pytest.mark.parametrize(
    "fields",
    [
        {"taken_at": (NOW + timedelta(minutes=10)).isoformat()},
        {"taken_at": "2026-11-10T10:00:00"},
        {"latitude": "47.6"},
        {"latitude": "91", "longitude": "0"},
        {"latitude": "0", "longitude": "-181"},
    ],
    ids=["future", "naive-time", "lat-only", "lat-range", "lng-range"],
)
def test_post_invalid_fields_are_rejected(harness: Harness, fields: dict[str, object]):
    response = harness.post(**fields)

    assert response.status_code == 422
    assert harness.repo.inserted == []


def test_post_storage_down_returns_502_and_saves_nothing(harness: Harness):
    harness.store.fail = StorageUnavailable("down")

    response = harness.post()

    assert response.status_code == 502
    assert response.json() == {"error": "storage_unavailable"}
    assert harness.repo.inserted == []


def test_post_without_player_is_rejected():
    harness = Harness(FakeSightingsRepo(WEEK))
    harness.client.app.dependency_overrides[get_players_repo] = lambda: FakePlayersRepo()

    response = harness.post()

    assert response.status_code == 404
    assert response.json() == {"error": "no_player"}


def test_post_then_standing_includes_the_new_photo(harness: Harness):
    harness.post()

    body = harness.client.get("/me/standing").json()

    assert body["last_photo_url"].startswith(f"https://signed.test/{BOB_ID}/")
    assert body["points"] == 1


def entry(player_id: UUID, name: str, points: int, rank: int) -> LeaderboardEntry:
    return LeaderboardEntry(
        player_id=player_id, display_name=name, points=points, count=points, rank=rank
    )


WEEK_BOARD = Leaderboard(
    rows=(entry(ALICE_ID, "Alice", 5, 1), entry(BOB_ID, "Bob", 3, 2)), total_players=23
)


def test_leaderboard_week_returns_rows_and_bounds(harness: Harness):
    harness.repo.leaderboards[WEEK.id] = WEEK_BOARD

    body = harness.client.get("/leaderboard?scope=week").json()

    assert body == {
        "scope": "week",
        "name": None,
        "starts_at": "2026-11-09T08:00:00Z",
        "ends_at": "2026-11-16T08:00:00Z",
        "total_players": 23,
        "rows": [
            {
                "player_id": str(ALICE_ID),
                "display_name": "Alice",
                "points": 5,
                "count": 5,
                "rank": 1,
                "is_me": False,
            },
            {
                "player_id": str(BOB_ID),
                "display_name": "Bob",
                "points": 3,
                "count": 3,
                "rank": 2,
                "is_me": True,
            },
        ],
    }


def test_leaderboard_week_uses_week_even_during_challenge():
    repo = FakeSightingsRepo(replace(WEEK, kind="challenge", id=uuid4(), name="Brown Week"))
    repo.week = WEEK
    repo.leaderboards[WEEK.id] = WEEK_BOARD

    body = Harness(repo).client.get("/leaderboard?scope=week").json()

    assert (body["starts_at"], len(body["rows"])) == ("2026-11-09T08:00:00Z", 2)


def test_leaderboard_all_has_no_bounds(harness: Harness):
    harness.repo.leaderboards[None] = Leaderboard(
        rows=(entry(BOB_ID, "Bob", 40, 1),), total_players=23
    )

    body = harness.client.get("/leaderboard?scope=all").json()

    assert (body["scope"], body["starts_at"], body["ends_at"]) == ("all", None, None)
    assert [row["points"] for row in body["rows"]] == [40]


def test_leaderboard_challenge_returns_the_running_challenge():
    challenge = replace(WEEK, kind="challenge", id=uuid4(), name="Brown Week")
    repo = FakeSightingsRepo(challenge)
    repo.leaderboards[challenge.id] = WEEK_BOARD

    body = Harness(repo).client.get("/leaderboard?scope=challenge").json()

    assert (body["scope"], body["name"], body["starts_at"]) == (
        "challenge",
        "Brown Week",
        "2026-11-09T08:00:00Z",
    )
    assert [row["points"] for row in body["rows"]] == [5, 3]


def test_leaderboard_challenge_is_404_without_one(harness: Harness):
    response = harness.client.get("/leaderboard?scope=challenge")

    assert response.status_code == 404
    assert response.json() == {"error": "no_challenge"}


@pytest.mark.parametrize("query", ["?scope=month", ""])
def test_leaderboard_rejects_unknown_scope(harness: Harness, query: str):
    response = harness.client.get(f"/leaderboard{query}")

    assert response.status_code == 422
    assert response.json() == {"error": "invalid_request"}


def logged(player_id: UUID, name: str, **changes: object) -> LoggedSighting:
    sighting_id = uuid4()
    base = LoggedSighting(
        id=sighting_id,
        player_id=player_id,
        display_name=name,
        photo_path=f"{player_id}/{sighting_id}.jpg",
        taken_at=NOW - timedelta(hours=1),
        claim_type="regular",
        categories=(),
        points=1,
        status="counted",
        flagged=False,
        check_note=None,
        challenge_name=None,
    )
    return replace(base, **changes)


def store_photo(
    harness: Harness, sighting: LoggedSighting, *, thumb: bool = True, display: bool = True
) -> None:
    harness.store.uploads[sighting.photo_path] = JPEG
    if thumb:
        harness.store.uploads[sighting.photo_path.replace(".jpg", ".thumb.jpg")] = JPEG
    if display:
        harness.store.uploads[sighting.photo_path.replace(".jpg", ".display.jpg")] = JPEG


def test_sightings_lists_the_week_with_thumbnails(harness: Harness):
    mine = logged(BOB_ID, "Bob")
    theirs = logged(ALICE_ID, "Alice", status="false_call", points=-1, check_note="not a Soul")
    harness.repo.logs = [mine, theirs]
    store_photo(harness, mine)
    store_photo(harness, theirs)

    body = harness.client.get("/sightings").json()

    assert body["starts_at"] == "2026-11-09T08:00:00Z"
    assert body["ends_at"] == "2026-11-16T08:00:00Z"
    first, second = body["sightings"]
    assert first["id"] == str(mine.id)
    assert first["is_me"] is True
    assert first["display_name"] == "Bob"
    assert first["thumb_url"] == f"https://signed.test/{BOB_ID}/{mine.id}.thumb.jpg?ttl=3600"
    assert first["photo_url"] == f"https://signed.test/{BOB_ID}/{mine.id}.display.jpg?ttl=3600"
    assert second["is_me"] is False
    assert second["status"] == "false_call"
    assert second["check_note"] == "not a Soul"


def test_sightings_log_returns_challenge_name(harness: Harness):
    harness.repo.logs = [
        logged(BOB_ID, "Bob", challenge_name="Brown Week"),
        logged(ALICE_ID, "Alice"),
    ]

    body = harness.client.get("/sightings").json()

    assert [s["challenge_name"] for s in body["sightings"]] == ["Brown Week", None]


def test_sightings_mine_filters_to_the_caller(harness: Harness):
    harness.repo.logs = [logged(BOB_ID, "Bob"), logged(ALICE_ID, "Alice")]

    body = harness.client.get("/sightings?mine=true").json()

    assert [s["player_id"] for s in body["sightings"]] == [str(BOB_ID)]


def test_sightings_falls_back_to_the_display_copy_without_thumbnail(harness: Harness):
    old = logged(BOB_ID, "Bob")
    harness.repo.logs = [old]
    store_photo(harness, old, thumb=False)

    (item,) = harness.client.get("/sightings").json()["sightings"]

    assert item["thumb_url"] == f"https://signed.test/{BOB_ID}/{old.id}.display.jpg?ttl=3600"
    assert item["photo_url"] == item["thumb_url"]


def test_sightings_falls_back_to_full_photo_without_other_sizes(harness: Harness):
    old = logged(BOB_ID, "Bob")
    harness.repo.logs = [old]
    store_photo(harness, old, thumb=False, display=False)

    (item,) = harness.client.get("/sightings").json()["sightings"]

    assert item["thumb_url"] == f"https://signed.test/{BOB_ID}/{old.id}.jpg?ttl=3600"
    assert item["photo_url"] == item["thumb_url"]


def test_sightings_still_load_when_storage_is_down(harness: Harness):
    harness.repo.logs = [logged(BOB_ID, "Bob")]
    harness.store.fail = StorageUnavailable("down")

    response = harness.client.get("/sightings")

    assert response.status_code == 200
    (item,) = response.json()["sightings"]
    assert item["thumb_url"] is None
    assert item["photo_url"] is None


def test_sightings_never_include_admin_notes(harness: Harness):
    harness.repo.logs = [logged(BOB_ID, "Bob")]

    (item,) = harness.client.get("/sightings").json()["sightings"]

    assert "verification_notes" not in item
    assert "photo_path" not in item


def test_sightings_reuse_signed_urls_between_refreshes(harness: Harness):
    sighting = logged(BOB_ID, "Bob")
    harness.repo.logs = [sighting]
    store_photo(harness, sighting)
    first = harness.client.get("/sightings").json()["sightings"][0]

    harness.store.fail = StorageUnavailable("down")
    again = harness.client.get("/sightings").json()["sightings"][0]

    assert again["thumb_url"] == first["thumb_url"]
    assert again["photo_url"] == first["photo_url"]
    assert again["photo_url"] is not None


def test_sightings_re_sign_urls_close_to_expiry(harness: Harness):
    sighting = logged(BOB_ID, "Bob")
    harness.repo.logs = [sighting]
    store_photo(harness, sighting)
    harness.client.get("/sightings")

    harness.store.fail = StorageUnavailable("down")
    harness.app.dependency_overrides[get_now] = lambda: NOW + timedelta(minutes=51)
    later = harness.client.get("/sightings").json()["sightings"][0]["thumb_url"]

    assert later is None
