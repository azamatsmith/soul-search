import hmac
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.clock import get_now
from app.config import get_settings
from app.errors import ApiError
from app.weeks.repo import WeeksRepo, get_weeks_repo

router = APIRouter()


def require_close_out_secret(
    x_close_out_secret: Annotated[str, Header()] = "",
) -> None:
    expected = get_settings().close_out_secret.encode()
    if not hmac.compare_digest(x_close_out_secret.encode(), expected):
        raise ApiError(401, "invalid_secret")


class CloseOutOut(BaseModel):
    closed: list[UUID]
    current_week_id: UUID


@router.post("/close-out", dependencies=[Depends(require_close_out_secret)])
def close_out(
    now: Annotated[datetime, Depends(get_now)],
    repo: Annotated[WeeksRepo, Depends(get_weeks_repo)],
) -> CloseOutOut:
    result = repo.close_ended(now)
    return CloseOutOut(closed=list(result.closed), current_week_id=result.current_week_id)
