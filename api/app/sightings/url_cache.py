from datetime import datetime, timedelta

REFRESH_MARGIN = timedelta(minutes=10)


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
