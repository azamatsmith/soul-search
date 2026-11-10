import logging
from dataclasses import asdict, replace
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.auth.attempts_repo import AttemptsRepo, get_attempts_repo
from app.auth.lockout import (
    AttemptState,
    code_expired,
    is_locked,
    register_failure,
    register_success,
    tries_left,
)
from app.auth.supabase_auth import AuthUnavailable, SupabaseAuth, TooSoon, get_supabase_auth
from app.clock import get_now
from app.errors import ApiError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth")

Attempts = Annotated[AttemptsRepo, Depends(get_attempts_repo)]
Auth = Annotated[SupabaseAuth, Depends(get_supabase_auth)]
Now = Annotated[datetime, Depends(get_now)]


Email = Annotated[str, Field(min_length=3, max_length=254)]


class SendCodeBody(BaseModel):
    email: Email


def normalize_email(raw: str) -> str:
    return raw.strip().lower()


def iso(moment: datetime) -> str:
    return moment.astimezone(UTC).isoformat().replace("+00:00", "Z")


def locked_error(state: AttemptState) -> ApiError:
    assert state.locked_until is not None
    return ApiError(423, "locked", locked_until=iso(state.locked_until))


def load_unlocked(attempts: AttemptsRepo, email: str, now: datetime) -> AttemptState:
    if not attempts.is_allowed(email):
        raise ApiError(403, "not_allowed")
    state = attempts.load_for_update(email)
    if is_locked(state, now):
        raise locked_error(state)
    return state


@router.post("/send-code", status_code=204)
def send_code(body: SendCodeBody, attempts: Attempts, auth: Auth, now: Now) -> Response:
    email = normalize_email(body.email)
    state = load_unlocked(attempts, email, now)
    try:
        auth.send_code(email)
    except TooSoon as error:
        raise ApiError(429, "too_soon") from error
    except AuthUnavailable as error:
        logger.warning("Supabase auth unavailable: %s", error)
        raise ApiError(502, "auth_unavailable") from error
    attempts.save(email, replace(state, code_sent_at=now), now)
    return Response(status_code=204)


class VerifyCodeBody(BaseModel):
    email: Email
    code: Annotated[str, Field(pattern=r"^\d{6}$")]


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    expires_at: int


@router.post("/verify-code")
def verify_code(body: VerifyCodeBody, attempts: Attempts, auth: Auth, now: Now) -> SessionResponse:
    email = normalize_email(body.email)
    state = load_unlocked(attempts, email, now)
    try:
        session = auth.verify_code(email, body.code)
    except AuthUnavailable as error:
        logger.warning("Supabase auth unavailable: %s", error)
        raise ApiError(502, "auth_unavailable") from error
    if session is not None:
        attempts.save(email, register_success(state), now)
        return SessionResponse(**asdict(session))
    expired = code_expired(state, now)
    state = register_failure(state, now)
    attempts.save(email, state, now)
    if is_locked(state, now):
        raise locked_error(state)
    if expired:
        raise ApiError(410, "expired")
    raise ApiError(401, "wrong_code", tries_left=tries_left(state))
