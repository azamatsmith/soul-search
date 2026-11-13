import argparse
import logging
import sys
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from itertools import batched
from typing import Protocol

import psycopg

from app.config import get_settings
from app.sightings.photo_meta import InvalidPhoto, make_sizes
from app.sightings.photo_store import (
    StorageUnavailable,
    display_path,
    get_photo_store,
    thumb_path,
)

BATCH = 100
CHECK_SECONDS = 60

log = logging.getLogger(__name__)


class SizedStore(Protocol):
    def download(self, path: str) -> bytes: ...
    def upload(self, path: str, photo: bytes) -> None: ...
    def signed_urls(self, paths: list[str], expires_in: int) -> dict[str, str | None]: ...


@dataclass(frozen=True)
class BackfillResult:
    checked: int
    created: int
    failed: int


def backfill(
    paths: Iterable[str],
    store: SizedStore,
    *,
    dry_run: bool = False,
    redo_thumbnails: bool = False,
) -> BackfillResult:
    checked = created = failed = 0
    for chunk in batched(paths, BATCH):
        sized = [s for p in chunk for s in (p, thumb_path(p), display_path(p))]
        exists = store.signed_urls(sized, CHECK_SECONDS)
        for path in chunk:
            checked += 1
            if not exists.get(path):
                log.warning("Original photo is missing: %s", path)
                failed += 1
                continue
            needed = {
                thumb_path(path): redo_thumbnails or not exists.get(thumb_path(path)),
                display_path(path): not exists.get(display_path(path)),
            }
            targets = [target for target, need in needed.items() if need]
            if not targets:
                continue
            if dry_run:
                created += len(targets)
                continue
            try:
                sizes = make_sizes(store.download(path))
                files = {thumb_path(path): sizes.thumbnail, display_path(path): sizes.display}
                for target in targets:
                    store.upload(target, files[target])
            except (InvalidPhoto, StorageUnavailable):
                log.warning("Could not resize %s", path, exc_info=True)
                failed += 1
                continue
            created += len(targets)
    return BackfillResult(checked=checked, created=created, failed=failed)


def run(paths: Iterable[str], store: SizedStore, argv: Sequence[str]) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.sightings.backfill_sizes",
        description="Create missing thumbnail and display sizes for stored photos.",
    )
    parser.add_argument("--dry-run", action="store_true", help="count without uploading")
    parser.add_argument("--redo-thumbnails", action="store_true", help="rewrite every thumbnail")
    args = parser.parse_args(argv)
    try:
        result = backfill(paths, store, dry_run=args.dry_run, redo_thumbnails=args.redo_thumbnails)
    except StorageUnavailable as error:
        print(f"Storage is unavailable: {error}")
        return 1
    if args.dry_run:
        print(
            f"Dry run: checked {result.checked} photos, "
            f"would create {result.created} sizes, {result.failed} failed."
        )
    else:
        print(
            f"Checked {result.checked} photos, "
            f"created {result.created} sizes, {result.failed} failed."
        )
    return 1 if result.failed else 0


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO)
    with psycopg.connect(get_settings().database_url, prepare_threshold=None) as conn:
        rows = conn.execute("select photo_path from sightings order by taken_at").fetchall()
    return run([row[0] for row in rows], get_photo_store(), sys.argv[1:] if argv is None else argv)


if __name__ == "__main__":
    sys.exit(main())
