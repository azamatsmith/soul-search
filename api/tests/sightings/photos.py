import io

from PIL import ExifTags, Image

GPS = ExifTags.IFD.GPSInfo
ORIENTATION = 0x0112


def jpeg(
    size: tuple[int, int] = (40, 20),
    gps: dict[int, object] | None = None,
    orientation: int | None = None,
) -> bytes:
    exif = Image.Exif()
    if gps:
        exif[GPS] = gps
    if orientation:
        exif[ORIENTATION] = orientation
    out = io.BytesIO()
    Image.new("RGB", size, "orange").save(out, "JPEG", exif=exif)
    return out.getvalue()


SEATTLE = {1: "N", 2: (47.0, 36.0, 0.0), 3: "W", 4: (122.0, 19.0, 48.0)}
