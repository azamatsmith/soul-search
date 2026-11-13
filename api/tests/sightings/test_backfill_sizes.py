import io

import pytest
from PIL import Image

from app.sightings.backfill_sizes import BackfillResult, backfill, run
from app.sightings.photo_store import StorageUnavailable
from tests.fakes import FakePhotoStore
from tests.sightings.photos import jpeg

ORIGINAL = jpeg(size=(3200, 2400))


def store_with(*paths: str) -> FakePhotoStore:
    store = FakePhotoStore()
    for path in paths:
        store.uploads[path] = ORIGINAL
    return store


def test_creates_only_the_missing_sizes():
    store = store_with("p/a.jpg", "p/a.thumb.jpg", "p/b.jpg")
    old_thumb = store.uploads["p/a.thumb.jpg"]

    result = backfill(["p/a.jpg", "p/b.jpg"], store)

    assert result == BackfillResult(checked=2, created=3, failed=0)
    assert store.uploads["p/a.thumb.jpg"] is old_thumb
    assert Image.open(io.BytesIO(store.uploads["p/a.display.jpg"])).size == (1600, 1200)
    assert Image.open(io.BytesIO(store.uploads["p/b.thumb.jpg"])).size == (256, 192)
    assert "p/b.display.jpg" in store.uploads


def test_a_second_run_creates_nothing():
    store = store_with("p/a.jpg")
    backfill(["p/a.jpg"], store)
    before = dict(store.uploads)

    result = backfill(["p/a.jpg"], store)

    assert result == BackfillResult(checked=1, created=0, failed=0)
    assert store.uploads == before


def test_dry_run_counts_without_uploading():
    store = store_with("p/a.jpg")

    result = backfill(["p/a.jpg"], store, dry_run=True)

    assert result == BackfillResult(checked=1, created=2, failed=0)
    assert list(store.uploads) == ["p/a.jpg"]


def test_redo_thumbnails_rewrites_existing_thumbnails():
    store = store_with("p/a.jpg", "p/a.thumb.jpg", "p/a.display.jpg")

    result = backfill(["p/a.jpg"], store, redo_thumbnails=True)

    assert result == BackfillResult(checked=1, created=1, failed=0)
    assert Image.open(io.BytesIO(store.uploads["p/a.thumb.jpg"])).size == (256, 192)


def test_a_missing_or_broken_original_fails_and_the_run_continues():
    store = store_with("p/ok.jpg")
    store.uploads["p/broken.jpg"] = b"not a photo"

    result = backfill(["p/gone.jpg", "p/broken.jpg", "p/ok.jpg"], store)

    assert result == BackfillResult(checked=3, created=2, failed=2)
    assert "p/ok.display.jpg" in store.uploads


def test_run_reports_counts_and_exit_code(capsys: pytest.CaptureFixture[str]):
    assert run(["p/a.jpg"], store_with("p/a.jpg"), []) == 0
    assert capsys.readouterr().out.strip() == "Checked 1 photos, created 2 sizes, 0 failed."

    assert run(["p/gone.jpg"], store_with(), []) == 1
    assert capsys.readouterr().out.strip() == "Checked 1 photos, created 0 sizes, 1 failed."


def test_run_dry_run_says_what_it_would_do(capsys: pytest.CaptureFixture[str]):
    run(["p/a.jpg"], store_with("p/a.jpg"), ["--dry-run", "--redo-thumbnails"])

    assert capsys.readouterr().out.strip() == (
        "Dry run: checked 1 photos, would create 2 sizes, 0 failed."
    )


def test_run_stops_when_storage_is_down(capsys: pytest.CaptureFixture[str]):
    store = store_with("p/a.jpg")
    store.fail = StorageUnavailable("down")

    assert run(["p/a.jpg"], store, []) == 1
    assert "Storage is unavailable" in capsys.readouterr().out
