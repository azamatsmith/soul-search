import time
from typing import Annotated
from uuid import UUID

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.tokens import CurrentUser, TokenVerifier, get_current_user, get_token_verifier
from app.errors import ApiError, register_error_handler

USER_ID = "b2222222-2222-2222-2222-222222222222"
HS_SECRET = "test-jwt-secret-with-at-least-32-characters"


@pytest.fixture
def es_key() -> ec.EllipticCurvePrivateKey:
    return ec.generate_private_key(ec.SECP256R1())


def claims(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "sub": USER_ID,
        "email": "bob@example.test",
        "aud": "authenticated",
        "exp": int(time.time()) + 600,
    }
    base.update(overrides)
    return {key: value for key, value in base.items() if value is not None}


def verifier_for(key: ec.EllipticCurvePrivateKey, hs_secret: str | None = None) -> TokenVerifier:
    return TokenVerifier(resolve_key=lambda _token: key.public_key(), hs256_secret=hs_secret)


def assert_rejected(verifier: TokenVerifier, token: str) -> None:
    with pytest.raises(ApiError) as caught:
        verifier.verify(token)
    assert caught.value.status == 401
    assert caught.value.code == "unauthenticated"


def test_valid_es256_token(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(), es_key, algorithm="ES256")

    user = verifier_for(es_key).verify(token)

    assert user == CurrentUser(id=UUID(USER_ID), email="bob@example.test")


def test_valid_hs256_token_with_secret(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(), HS_SECRET, algorithm="HS256")

    user = verifier_for(es_key, HS_SECRET).verify(token)

    assert user.id == UUID(USER_ID)


def test_hs256_rejected_without_secret(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(), HS_SECRET, algorithm="HS256")

    assert_rejected(verifier_for(es_key), token)


def test_expired_token_401(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(exp=int(time.time()) - 10), es_key, algorithm="ES256")

    assert_rejected(verifier_for(es_key), token)


def test_wrong_audience_401(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(aud="anon"), es_key, algorithm="ES256")

    assert_rejected(verifier_for(es_key), token)


def test_bad_signature_401(es_key: ec.EllipticCurvePrivateKey):
    other_key = ec.generate_private_key(ec.SECP256R1())
    token = jwt.encode(claims(), other_key, algorithm="ES256")

    assert_rejected(verifier_for(es_key), token)


def test_missing_sub_401(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(sub=None), es_key, algorithm="ES256")

    assert_rejected(verifier_for(es_key), token)


def test_unsupported_algorithm_401(es_key: ec.EllipticCurvePrivateKey):
    token = jwt.encode(claims(), None, algorithm="none")

    assert_rejected(verifier_for(es_key, HS_SECRET), token)


@pytest.mark.parametrize("header", [None, "Token abc", "Bearer ", "Bearer not-a-jwt"])
def test_missing_or_malformed_header_401(es_key: ec.EllipticCurvePrivateKey, header: str | None):
    app = FastAPI()
    register_error_handler(app)
    app.dependency_overrides[get_token_verifier] = lambda: verifier_for(es_key)

    @app.get("/whoami")
    def whoami(user: Annotated[CurrentUser, Depends(get_current_user)]) -> str:
        return str(user.id)

    headers = {} if header is None else {"Authorization": header}
    response = TestClient(app).get("/whoami", headers=headers)

    assert response.status_code == 401
    assert response.json() == {"error": "unauthenticated"}
