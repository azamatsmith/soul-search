from datetime import datetime, timedelta

from app.sightings.photo_store import PhotoStore, StorageUnavailable

REFRESH_MARGIN = timedelta(minutes=10)
SIGNED_URL_SECONDS = 3600


class SignedUrlCache:
    def __init__(self) -> None:
        self._urls: dict[str, tuple[str, datetime]] = {}

    def get(self, path: str, now: datetime) -> str | None:
        cached = self._urls.get(path)
        if cached is None or cached[1] - now <= REFRESH_MARGIN:
            return None
        return cached[0]

    def put(self, path: str, url: str, expires_at: datetime, now: datetime) -> None:
        self._urls = {p: c for p, c in self._urls.items() if c[1] > now}
        self._urls[path] = (url, expires_at)


_cache = SignedUrlCache()


def get_url_cache() -> SignedUrlCache:
    return _cache


def cached_signed_urls(
    store: PhotoStore, cache: SignedUrlCache, paths: list[str], now: datetime
) -> dict[str, str | None]:
    urls = {p: cache.get(p, now) for p in paths}
    fresh = _signed_urls(store, [p for p, url in urls.items() if url is None])
    expires_at = now + timedelta(seconds=SIGNED_URL_SECONDS)
    for path, url in fresh.items():
        if url:
            cache.put(path, url, expires_at, now)
    return urls | {p: url for p, url in fresh.items() if url}


def _signed_urls(store: PhotoStore, paths: list[str]) -> dict[str, str | None]:
    try:
        return store.signed_urls(paths, SIGNED_URL_SECONDS)
    except StorageUnavailable:
        return {}
