from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.sightings.photo_store import StorageUnavailable
from app.verification.claude_checker import CheckFailed
from app.verification.outcome import CheckResult, Claim
from app.verification.repo import PendingSighting
from app.verification.worker import MAX_ATTEMPTS, verify_due
from tests.fakes import FakePhotoChecker, FakePhotoStore, FakeVerificationRepo

NOW = datetime(2026, 11, 10, 18, tzinfo=UTC)
CLAIM = Claim(claim_type="regular", categories=(), points=1, false_call_points=-1)
NOT_A_SOUL = CheckResult(
    is_kia_soul="no",
    categories={},
    player_note="That's a Honda Element.",
    reasoning="Boxy, but a Honda badge.",
    plate_number=None,
    plate_state=None,
)


def pending(attempts: int = 1) -> PendingSighting:
    sighting_id = uuid4()
    return PendingSighting(
        id=sighting_id, photo_path=f"p/{sighting_id}.jpg", claim=CLAIM, attempts=attempts
    )


def setup(*sightings: PendingSighting):
    repo = FakeVerificationRepo(list(sightings))
    store = FakePhotoStore()
    for sighting in sightings:
        store.uploads[sighting.photo_path] = b"photo-" + sighting.photo_path.encode()
    checker = FakePhotoChecker(NOT_A_SOUL)
    return repo, store, checker


def run(repo, store, checker) -> int:
    return verify_due(repo, store, checker, lambda: NOW)


def test_checks_each_due_photo_and_saves_the_outcome():
    first, second = pending(), pending()
    repo, store, checker = setup(first, second)

    assert run(repo, store, checker) == 2

    assert checker.checked == [
        (b"photo-" + first.photo_path.encode(), CLAIM),
        (b"photo-" + second.photo_path.encode(), CLAIM),
    ]
    outcome = repo.outcomes[first.id]
    assert (outcome.status, outcome.points) == ("false_call", -1)
    assert outcome.check_note == "That's a Honda Element."
    assert second.id in repo.outcomes


def test_commits_the_claim_and_each_result():
    repo, store, checker = setup(pending(), pending())

    run(repo, store, checker)

    assert repo.commits == 3


def test_nothing_due_does_nothing():
    repo, store, checker = setup()

    assert run(repo, store, checker) == 0
    assert checker.checked == []


@pytest.mark.parametrize(
    ("attempts", "delay"),
    [
        (1, timedelta(minutes=1)),
        (2, timedelta(minutes=5)),
        (3, timedelta(minutes=30)),
        (4, timedelta(hours=2)),
        (5, timedelta(hours=6)),
        (MAX_ATTEMPTS - 1, timedelta(hours=6)),
    ],
)
def test_retryable_failures_back_off(attempts: int, delay: timedelta):
    sighting = pending(attempts)
    repo, store, checker = setup(sighting)
    checker.fail = CheckFailed("Claude API 529", retryable=True)

    run(repo, store, checker)

    assert repo.retries[sighting.id] == ("Claude API 529", NOW + delay)
    assert repo.outcomes == {}


def test_storage_failures_are_retried():
    sighting = pending()
    repo, store, checker = setup(sighting)
    store.fail = StorageUnavailable("GET photo returned 503")

    run(repo, store, checker)

    assert repo.retries[sighting.id] == ("GET photo returned 503", NOW + timedelta(minutes=1))


def test_gives_up_after_the_last_attempt():
    sighting = pending(MAX_ATTEMPTS)
    repo, store, checker = setup(sighting)
    checker.fail = CheckFailed("Claude API 529", retryable=True)

    run(repo, store, checker)

    assert repo.gave_up == {sighting.id: "Claude API 529"}
    assert repo.retries == {}


def test_gives_up_at_once_on_a_failure_that_will_not_change():
    sighting = pending()
    repo, store, checker = setup(sighting)
    checker.fail = CheckFailed("Claude declined to check the photo", retryable=False)

    run(repo, store, checker)

    assert repo.gave_up == {sighting.id: "Claude declined to check the photo"}


def test_an_unexpected_error_on_one_photo_does_not_stop_the_others():
    first, second = pending(), pending()
    repo, store, checker = setup(first, second)
    del store.uploads[first.photo_path]

    assert run(repo, store, checker) == 2

    assert first.id in repo.retries
    assert second.id in repo.outcomes
