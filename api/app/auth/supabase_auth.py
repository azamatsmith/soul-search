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
        self._ensure_user(email)
        response = self._post("/otp", {"email": email, "create_user": False})
        if response.status_code == 429:
            raise TooSoon
        if response.is_error:
            raise _unavailable(response)

    def verify_code(self, email: str, code: str) -> AuthSession | None:
        response = self._post("/verify", {"type": "email", "email": email, "token": code})
        if response.status_code in REJECTED_STATUSES:
            return None
        if response.is_error:
            raise _unavailable(response)
        body = response.json()
        return AuthSession(
            access_token=body["access_token"],
            refresh_token=body["refresh_token"],
            expires_in=body["expires_in"],
            expires_at=body["expires_at"],
        )

    def _ensure_user(self, email: str) -> None:
        response = self._post("/admin/users", {"email": email, "email_confirm": True})
        if response.status_code == 422 and _error_code(response) == "email_exists":
            return
        if response.is_error:
            raise _unavailable(response)

    def _post(self, path: str, payload: dict[str, object]) -> httpx.Response:
        try:
            return self._client.post(path, json=payload)
        except httpx.HTTPError as error:
            raise AuthUnavailable(f"POST {error.request.url} failed: {error}") from error


def _error_code(response: httpx.Response) -> str | None:
    try:
        body = response.json()
    except ValueError:
        return None
    return body.get("error_code") if isinstance(body, dict) else None


def _unavailable(response: httpx.Response) -> AuthUnavailable:
    request = response.request
    reason = f"{request.method} {request.url} returned {response.status_code}"
    code = _error_code(response)
    return AuthUnavailable(f"{reason} ({code})" if code else reason)


def get_supabase_auth() -> SupabaseAuth:
    settings = get_settings()
    return SupabaseAuth(settings.supabase_url, settings.supabase_secret_key)
