import io

import pytest
from PIL import Image
from PIL.JpegImagePlugin import JpegImageFile

from app.sightings.photo_meta import InvalidPhoto, clean_photo, make_sizes
from tests.sightings.photos import SEATTLE, jpeg


def test_reads_gps_location():
    photo = clean_photo(jpeg(gps=SEATTLE))

    assert photo.latitude == pytest.approx(47.6)
    assert photo.longitude == pytest.approx(-122.33)


def test_south_and_east_are_signed():
    photo = clean_photo(jpeg(gps={1: "S", 2: (33.0, 52.0, 0.0), 3: "E", 4: (151.0, 12.0, 0.0)}))

    assert photo.latitude == pytest.approx(-33.8667, abs=1e-4)
    assert photo.longitude == pytest.approx(151.2)


def test_photo_without_gps_has_no_location():
    photo = clean_photo(jpeg())

    assert (photo.latitude, photo.longitude) == (None, None)


def test_out_of_range_gps_is_ignored():
    photo = clean_photo(jpeg(gps={**SEATTLE, 2: (95.0, 0.0, 0.0)}))

    assert (photo.latitude, photo.longitude) == (None, None)


def test_stored_photo_has_no_exif():
    photo = clean_photo(jpeg(gps=SEATTLE, orientation=6))

    stored = Image.open(io.BytesIO(photo.data))
    assert stored.format == "JPEG"
    assert dict(stored.getexif()) == {}


def test_orientation_is_applied_before_stripping():
    photo = clean_photo(jpeg(size=(40, 20), orientation=6))

    assert Image.open(io.BytesIO(photo.data)).size == (20, 40)


@pytest.mark.parametrize(
    "data", [b"\xff\xd8\xffnot really", b"GIF89a", b""], ids=["corrupt", "gif", "empty"]
)
def test_unreadable_photo_is_invalid(data: bytes):
    with pytest.raises(InvalidPhoto):
        clean_photo(data)


def test_png_is_invalid():
    out = io.BytesIO()
    Image.new("RGB", (4, 4)).save(out, "PNG")

    with pytest.raises(InvalidPhoto):
        clean_photo(out.getvalue())


def test_oversized_dimensions_are_invalid():
    with pytest.raises(InvalidPhoto):
        clean_photo(jpeg(size=(40, 20)), max_pixels=799)


def test_clean_photo_makes_a_small_upright_thumbnail():
    cleaned = clean_photo(jpeg(size=(4000, 3000), orientation=6))

    thumb = Image.open(io.BytesIO(cleaned.thumbnail))
    assert thumb.format == "JPEG"
    assert thumb.size == (192, 256)


def test_clean_photo_makes_an_upright_display_copy():
    cleaned = clean_photo(jpeg(size=(4000, 3000), orientation=6))

    display = Image.open(io.BytesIO(cleaned.display))
    assert display.format == "JPEG"
    assert display.size == (1200, 1600)


def test_clean_photo_does_not_upscale_small_photos():
    cleaned = clean_photo(jpeg(size=(200, 150)))

    assert Image.open(io.BytesIO(cleaned.thumbnail)).size == (200, 150)
    assert Image.open(io.BytesIO(cleaned.display)).size == (200, 150)


def test_make_sizes_resizes_a_stored_photo():
    sizes = make_sizes(jpeg(size=(3200, 2400)))

    assert Image.open(io.BytesIO(sizes.thumbnail)).size == (256, 192)
    assert Image.open(io.BytesIO(sizes.display)).size == (1600, 1200)


def test_make_sizes_decodes_large_photos_at_a_reduced_scale(monkeypatch: pytest.MonkeyPatch):
    drafts: list[tuple[str, tuple[int, int]]] = []
    real_draft = JpegImageFile.draft

    def recording_draft(self: JpegImageFile, mode: str, size: tuple[int, int]):  # type: ignore[no-untyped-def]
        drafts.append((mode, size))
        return real_draft(self, mode, size)

    monkeypatch.setattr(JpegImageFile, "draft", recording_draft)

    sizes = make_sizes(jpeg(size=(6400, 4800)))

    assert drafts[0] == ("RGB", (1600, 1600))
    assert Image.open(io.BytesIO(sizes.display)).size == (1600, 1200)
    assert Image.open(io.BytesIO(sizes.thumbnail)).size == (256, 192)


def test_make_sizes_rejects_a_broken_photo():
    with pytest.raises(InvalidPhoto):
        make_sizes(b"not a photo")
