import asyncio
import logging
from collections.abc import Callable

import anthropic
import psycopg

from app.clock import get_now
from app.config import get_settings
from app.sightings.photo_store import get_photo_store
from app.verification.claude_checker import ClaudePhotoChecker
from app.verification.repo import PgVerificationRepo
from app.verification.worker import BATCH_SIZE, verify_due

SWEEP_SECONDS = 60.0
FIRST_SWEEP_SECONDS = 5.0

log = logging.getLogger(__name__)


def run_verification() -> None:
    try:
        settings = get_settings()
        checker = ClaudePhotoChecker(anthropic.Anthropic(api_key=settings.anthropic_api_key))
        store = get_photo_store()
        with psycopg.connect(settings.database_url, prepare_threshold=None) as conn:
            repo = PgVerificationRepo(conn)
            while verify_due(repo, store, checker, get_now) == BATCH_SIZE:
                pass
    except Exception:
        log.exception("Photo verification run failed")


def get_verification_runner() -> Callable[[], None]:
    return run_verification


async def sweep_forever(
    run: Callable[[], None],
    *,
    first_delay: float = FIRST_SWEEP_SECONDS,
    interval: float = SWEEP_SECONDS,
) -> None:
    await asyncio.sleep(first_delay)
    while True:
        try:
            await asyncio.to_thread(run)
        except Exception:
            log.exception("Photo verification sweep failed")
        await asyncio.sleep(interval)
