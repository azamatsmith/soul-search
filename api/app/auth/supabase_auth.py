from dataclasses import dataclass

import httpx

from app.config import get_settings

REJECTED_STATUSES = {400, 401, 403}


@dataclass(frozen=True)
class AuthSession:
    access_token: str
    refresh_token: str
    expires_in: int
    expires_at: int


class TooSoon(Exception):
    pass


class AuthUnavailable(Exception):
    pass


class SupabaseAuth:
    def __init__(
        self, base_url: str, secret_key: str, transport: httpx.BaseTransport | None = None
    ) -> None:
        self._client = httpx.Client(
            base_url=f"{base_url}/auth/v1",
            headers={"apikey": secret_key},
            timeout=10,
            transport=transport,
        )

    def send_code(self, email: str) -> None:
        response = self._post("/otp", {"email": email, "create_user": True})
        if response.status_code == 429:
            raise TooSoon
        if response.is_error:
            raise AuthUnavailable(f"send failed with {response.status_code}")

    def verify_code(self, email: str, code: str) -> AuthSession | None:
        response = self._post("/verify", {"type": "email", "email": email, "token": code})
        if response.status_code in REJECTED_STATUSES:
            return None
        if response.is_error:
            raise AuthUnavailable(f"verify failed with {response.status_code}")
        body = response.json()
        return AuthSession(
            access_token=body["access_token"],
            refresh_token=body["refresh_token"],
            expires_in=body["expires_in"],
            expires_at=body["expires_at"],
        )

    def _post(self, path: str, payload: dict[str, object]) -> httpx.Response:
        try:
            return self._client.post(path, json=payload)
        except httpx.HTTPError as error:
            raise AuthUnavailable(str(error)) from error


def get_supabase_auth() -> SupabaseAuth:
    settings = get_settings()
    return SupabaseAuth(settings.supabase_url, settings.supabase_secret_key)
