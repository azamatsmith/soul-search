from typing import Annotated

from fastapi import Depends

from app.auth.attempts_repo import AttemptsRepo, get_attempts_repo
from app.auth.tokens import CurrentUser, get_current_user
from app.errors import ApiError


def get_allowed_user(
    user: Annotated[CurrentUser, Depends(get_current_user)],
    attempts: Annotated[AttemptsRepo, Depends(get_attempts_repo)],
) -> CurrentUser:
    if not attempts.is_allowed(user.email.strip().lower()):
        raise ApiError(403, "not_allowed")
    return user
