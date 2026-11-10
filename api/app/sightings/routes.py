from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.sightings.repo import Period, SightingsRepo, get_sightings_repo

router = APIRouter()

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Repo = Annotated[SightingsRepo, Depends(get_sightings_repo)]
Now = Annotated[datetime, Depends(get_now)]


class RulesOut(BaseModel):
    regular: int
    special: int
    false_call: int
    categories: list[str]
    bonuses: dict[str, int]


class PeriodOut(BaseModel):
    kind: Literal["week", "challenge"]
    id: UUID
    name: str | None
    starts_at: datetime
    ends_at: datetime
    rules: RulesOut


def period_out(period: Period) -> PeriodOut:
    rules = period.rules
    return PeriodOut(
        kind=period.kind,
        id=period.id,
        name=period.name,
        starts_at=period.starts_at,
        ends_at=period.ends_at,
        rules=RulesOut(
            regular=rules.regular,
            special=rules.special,
            false_call=rules.false_call,
            categories=list(rules.categories),
            bonuses=dict(rules.bonuses),
        ),
    )


@router.get("/period")
def get_period(_user: User, repo: Repo, now: Now) -> PeriodOut:
    return period_out(repo.period_at(now))
