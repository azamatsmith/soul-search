import httpx

from app.config import get_settings

BUCKET = "photos"


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

    def signed_url(self, path: str, expires_in: int) -> str:
        response = self._post(f"/object/sign/{BUCKET}/{path}", json={"expiresIn": expires_in})
        return f"{self._storage_url}{response.json()['signedURL']}"

    def _post(self, path: str, *, json: dict[str, object]) -> httpx.Response:
        try:
            response = self._client.post(path, json=json)
        except httpx.HTTPError as error:
            raise StorageUnavailable(f"POST {error.request.url} failed: {error}") from error
        if response.is_error:
            raise StorageUnavailable(f"POST {response.request.url} returned {response.status_code}")
        return response


def get_photo_store() -> PhotoStore:
    settings = get_settings()
    return PhotoStore(settings.supabase_url, settings.supabase_secret_key)
