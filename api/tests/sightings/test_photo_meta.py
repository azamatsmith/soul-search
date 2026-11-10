import io

import pytest
from PIL import Image

from app.sightings.photo_meta import InvalidPhoto, clean_photo
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
