from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.sightings.photo_store import PhotoStore, StorageUnavailable, get_photo_store
from app.sightings.repo import Period, SightingsRepo, get_sightings_repo

SIGNED_URL_SECONDS = 3600

router = APIRouter()

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Repo = Annotated[SightingsRepo, Depends(get_sightings_repo)]
Store = Annotated[PhotoStore, Depends(get_photo_store)]
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


class StandingOut(BaseModel):
    points: int
    count: int
    rank: int | None
    total_players: int
    next_rank: int | None
    points_behind_next: int | None
    last_photo_url: str | None


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


@router.get("/me/standing")
def get_standing(user: User, repo: Repo, store: Store, now: Now) -> StandingOut:
    standing = repo.standing(user.id, repo.period_at(now))
    photo_url = None
    if standing.last_photo_path:
        try:
            photo_url = store.signed_url(standing.last_photo_path, SIGNED_URL_SECONDS)
        except StorageUnavailable:
            photo_url = None
    return StandingOut(
        points=standing.points,
        count=standing.count,
        rank=standing.rank,
        total_players=standing.total_players,
        next_rank=standing.next_rank,
        points_behind_next=standing.points_behind_next,
        last_photo_url=photo_url,
    )
