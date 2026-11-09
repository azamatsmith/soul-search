from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import jwt
from fastapi import Depends, Header

from app.config import get_settings
from app.errors import ApiError

ASYMMETRIC_ALGORITHMS = {"ES256", "RS256"}


@dataclass(frozen=True)
class CurrentUser:
    id: UUID
    email: str


class TokenVerifier:
    def __init__(self, resolve_key: Callable[[str], object], hs256_secret: str | None) -> None:
        self._resolve_key = resolve_key
        self._hs256_secret = hs256_secret

    def verify(self, token: str) -> CurrentUser:
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
            key = self._key_for(token, algorithm)
            claims = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience="authenticated",
                options={"require": ["exp", "sub", "aud"]},
            )
            return CurrentUser(id=UUID(claims["sub"]), email=claims.get("email", ""))
        except (jwt.PyJWTError, ValueError) as error:
            raise ApiError(401, "unauthenticated") from error

    def _key_for(self, token: str, algorithm: str | None) -> object:
        if algorithm == "HS256" and self._hs256_secret:
            return self._hs256_secret
        if algorithm in ASYMMETRIC_ALGORITHMS:
            return self._resolve_key(token)
        raise jwt.InvalidAlgorithmError(f"unsupported algorithm {algorithm}")


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")


def get_token_verifier() -> TokenVerifier:
    settings = get_settings()
    client = _jwks_client(settings.supabase_url)
    return TokenVerifier(
        resolve_key=lambda token: client.get_signing_key_from_jwt(token).key,
        hs256_secret=settings.supabase_jwt_secret,
    )


def get_current_user(
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise ApiError(401, "unauthenticated")
    return verifier.verify(token.strip())
