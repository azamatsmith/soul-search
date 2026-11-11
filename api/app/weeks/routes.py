import hmac
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.config import get_settings
from app.errors import ApiError
from app.sightings.repo import LeaderboardEntry
from app.sightings.routes import LeaderboardRowOut
from app.weeks.repo import PastWeek, WeeksRepo, get_weeks_repo

router = APIRouter()

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Repo = Annotated[WeeksRepo, Depends(get_weeks_repo)]


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


class WinnerOut(BaseModel):
    player_id: UUID
    display_name: str
    points: int
    is_me: bool


class MyResultOut(BaseModel):
    rank: int
    points: int


class PastWeekSummaryOut(BaseModel):
    id: UUID
    starts_at: datetime
    ends_at: datetime
    winner: WinnerOut | None
    me: MyResultOut | None


class PastWeeksOut(BaseModel):
    total_players: int
    weeks: list[PastWeekSummaryOut]


class PastWeekOut(BaseModel):
    id: UUID
    starts_at: datetime
    ends_at: datetime
    rows: list[LeaderboardRowOut]


def winner_out(week: PastWeek, user: CurrentUser) -> WinnerOut | None:
    if not week.rows:
        return None
    first = week.rows[0]
    return WinnerOut(
        player_id=first.player_id,
        display_name=first.display_name,
        points=first.points,
        is_me=first.player_id == user.id,
    )


def my_result_out(week: PastWeek, user: CurrentUser) -> MyResultOut | None:
    mine = next((row for row in week.rows if row.player_id == user.id), None)
    return MyResultOut(rank=mine.rank, points=mine.points) if mine else None


def row_out(row: LeaderboardEntry, user: CurrentUser) -> LeaderboardRowOut:
    return LeaderboardRowOut(
        player_id=row.player_id,
        display_name=row.display_name,
        points=row.points,
        count=row.count,
        rank=row.rank,
        is_me=row.player_id == user.id,
    )


@router.get("/past-weeks")
def list_past_weeks(user: User, repo: Repo) -> PastWeeksOut:
    past = repo.past()
    return PastWeeksOut(
        total_players=past.total_players,
        weeks=[
            PastWeekSummaryOut(
                id=week.id,
                starts_at=week.starts_at,
                ends_at=week.ends_at,
                winner=winner_out(week, user),
                me=my_result_out(week, user),
            )
            for week in past.weeks
        ],
    )


@router.get("/past-weeks/{week_id}")
def get_past_week(week_id: UUID, user: User, repo: Repo) -> PastWeekOut:
    week = repo.final(week_id)
    if week is None:
        raise ApiError(404, "not_found")
    return PastWeekOut(
        id=week.id,
        starts_at=week.starts_at,
        ends_at=week.ends_at,
        rows=[row_out(row, user) for row in week.rows],
    )
