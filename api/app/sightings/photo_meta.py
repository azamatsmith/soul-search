import io
from dataclasses import dataclass

from PIL import ExifTags, Image, ImageOps, UnidentifiedImageError

MAX_PIXELS = 50_000_000
JPEG_QUALITY = 90


@dataclass(frozen=True)
class CleanPhoto:
    data: bytes
    latitude: float | None
    longitude: float | None


class InvalidPhoto(Exception):
    pass


def clean_photo(data: bytes, max_pixels: int = MAX_PIXELS) -> CleanPhoto:
    try:
        image = Image.open(io.BytesIO(data))
        if image.format != "JPEG":
            raise InvalidPhoto
        width, height = image.size
        if width * height > max_pixels:
            raise InvalidPhoto
        latitude, longitude = _location(image.getexif().get_ifd(ExifTags.IFD.GPSInfo))
        upright = ImageOps.exif_transpose(image).convert("RGB")
        out = io.BytesIO()
        upright.save(out, "JPEG", quality=JPEG_QUALITY)
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ) as error:
        raise InvalidPhoto from error
    return CleanPhoto(data=out.getvalue(), latitude=latitude, longitude=longitude)


def _location(gps: dict[int, object]) -> tuple[float | None, float | None]:
    latitude = _coordinate(gps.get(2), gps.get(1), "S", 90)
    longitude = _coordinate(gps.get(4), gps.get(3), "W", 180)
    if latitude is None or longitude is None:
        return None, None
    return latitude, longitude


def _coordinate(dms: object, ref: object, negative_ref: str, limit: float) -> float | None:
    if not isinstance(dms, tuple) or len(dms) != 3 or not isinstance(ref, str):
        return None
    try:
        degrees, minutes, seconds = (float(part) for part in dms)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    value = degrees + minutes / 60 + seconds / 3600
    if ref.strip().upper() == negative_ref:
        value = -value
    return value if -limit <= value <= limit else None
