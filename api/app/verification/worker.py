import logging
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Protocol

from app.sightings.photo_store import StorageUnavailable
from app.verification.claude_checker import CheckFailed, PhotoChecker
from app.verification.outcome import decide
from app.verification.repo import PendingSighting, VerificationRepo

BATCH_SIZE = 5
MAX_ATTEMPTS = 8
BACKOFF = (
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=6),
)

log = logging.getLogger(__name__)


class PhotoSource(Protocol):
    def download(self, path: str) -> bytes: ...


def verify_due(
    repo: VerificationRepo,
    store: PhotoSource,
    checker: PhotoChecker,
    clock: Callable[[], datetime],
) -> int:
    due = repo.claim_due(clock(), BATCH_SIZE)
    repo.commit()
    for sighting in due:
        _verify(repo, store, checker, sighting, clock)
        repo.commit()
    return len(due)


def _verify(
    repo: VerificationRepo,
    store: PhotoSource,
    checker: PhotoChecker,
    sighting: PendingSighting,
    clock: Callable[[], datetime],
) -> None:
    try:
        result = checker.check(store.download(sighting.photo_path), sighting.claim)
    except CheckFailed as error:
        _fail(repo, sighting, str(error), error.retryable, clock())
        return
    except StorageUnavailable as error:
        _fail(repo, sighting, str(error), True, clock())
        return
    except Exception as error:
        log.exception("Unexpected error checking sighting %s", sighting.id)
        _fail(repo, sighting, f"Unexpected error: {type(error).__name__}", True, clock())
        return
    repo.save_outcome(sighting.id, decide(sighting.claim, result), clock())


def _fail(
    repo: VerificationRepo,
    sighting: PendingSighting,
    error: str,
    retryable: bool,
    now: datetime,
) -> None:
    if not retryable or sighting.attempts >= MAX_ATTEMPTS:
        log.warning("Giving up on sighting %s: %s", sighting.id, error)
        repo.give_up(sighting.id, error, now)
        return
    delay = BACKOFF[min(sighting.attempts, len(BACKOFF)) - 1]
    repo.schedule_retry(sighting.id, error, now + delay)
