from collections.abc import Mapping

import httpx

from app.config import get_settings

BUCKET = "photos"


def thumb_path(photo_path: str) -> str:
    return f"{photo_path.removesuffix('.jpg')}.thumb.jpg"


def display_path(photo_path: str) -> str:
    return f"{photo_path.removesuffix('.jpg')}.display.jpg"


class StorageUnavailable(Exception):
    pass


class PhotoStore:
    def __init__(
        self, base_url: str, secret_key: str, transport: httpx.BaseTransport | None = None
    ) -> None:
        self._storage_url = f"{base_url}/storage/v1"
        self._client = httpx.Client(
            base_url=self._storage_url,
            headers={"apikey": secret_key, "Authorization": f"Bearer {secret_key}"},
            timeout=20,
            transport=transport,
        )

    def upload(self, path: str, photo: bytes) -> None:
        self._send(
            "POST",
            f"/object/{BUCKET}/{path}",
            content=photo,
            headers={"Content-Type": "image/jpeg", "x-upsert": "true"},
        )

    def download(self, path: str) -> bytes:
        return self._send("GET", f"/object/{BUCKET}/{path}").content

    def signed_urls(self, paths: list[str], expires_in: int) -> dict[str, str | None]:
        if not paths:
            return {}
        response = self._send(
            "POST", f"/object/sign/{BUCKET}", json={"expiresIn": expires_in, "paths": paths}
        )
        return {
            item["path"]: f"{self._storage_url}{item['signedURL']}" if item["signedURL"] else None
            for item in response.json()
        }

    def _send(
        self,
        method: str,
        path: str,
        *,
        content: bytes | None = None,
        headers: dict[str, str] | None = None,
        json: Mapping[str, object] | None = None,
    ) -> httpx.Response:
        try:
            response = self._client.request(
                method, path, content=content, headers=headers, json=json
            )
        except httpx.HTTPError as error:
            raise StorageUnavailable(f"{method} {error.request.url} failed: {error}") from error
        if response.is_error:
            request = response.request
            raise StorageUnavailable(
                f"{request.method} {request.url} returned {response.status_code}"
            )
        return response


def get_photo_store() -> PhotoStore:
    settings = get_settings()
    return PhotoStore(settings.supabase_url, settings.supabase_secret_key)
