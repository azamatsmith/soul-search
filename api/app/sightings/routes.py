from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    Query,
    Response,
    UploadFile,
    status,
)
from pydantic import BaseModel

from app.auth.allowed_user import get_allowed_user
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.errors import ApiError
from app.me.players_repo import PlayersRepo, get_players_repo
from app.sightings.photo_meta import CleanPhoto, InvalidPhoto, clean_photo
from app.sightings.photo_store import (
    PhotoStore,
    StorageUnavailable,
    display_path,
    get_photo_store,
    thumb_path,
)
from app.sightings.repo import (
    LoggedSighting,
    NewSighting,
    Period,
    Sighting,
    SightingsRepo,
    get_sightings_repo,
)
from app.sightings.scoring import InvalidClaim, Rules, points_for
from app.sightings.url_cache import (
    SIGNED_URL_SECONDS,
    SignedUrlCache,
    cached_signed_urls,
    get_url_cache,
)
from app.verification.runner import get_verification_runner

MAX_PHOTO_BYTES = 8 * 1024 * 1024
MAX_CLOCK_SKEW = timedelta(minutes=5)

router = APIRouter()

User = Annotated[CurrentUser, Depends(get_allowed_user)]
Repo = Annotated[SightingsRepo, Depends(get_sightings_repo)]
Store = Annotated[PhotoStore, Depends(get_photo_store)]
Players = Annotated[PlayersRepo, Depends(get_players_repo)]
Now = Annotated[datetime, Depends(get_now)]
UrlCache = Annotated[SignedUrlCache, Depends(get_url_cache)]
Verify = Annotated[Callable[[], None], Depends(get_verification_runner)]


class CategoryOut(BaseModel):
    name: str
    points: int


class RulesOut(BaseModel):
    regular: int
    special: int | None
    false_call: int
    categories: list[CategoryOut]


def rules_out(rules: Rules) -> RulesOut:
    return RulesOut(
        regular=rules.regular,
        special=rules.special,
        false_call=rules.false_call,
        categories=[CategoryOut(name=n, points=p) for n, p in rules.categories.items()],
    )


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


class SightingOut(BaseModel):
    id: UUID
    taken_at: datetime
    claim_type: str
    categories: list[str]
    points: int
    status: str
    flagged: bool


class LeaderboardRowOut(BaseModel):
    player_id: UUID
    display_name: str
    points: int
    count: int
    rank: int
    is_me: bool


class LeaderboardOut(BaseModel):
    scope: Literal["week", "all", "challenge"]
    name: str | None
    starts_at: datetime | None
    ends_at: datetime | None
    total_players: int
    rows: list[LeaderboardRowOut]


class LoggedSightingOut(BaseModel):
    id: UUID
    player_id: UUID
    display_name: str
    is_me: bool
    taken_at: datetime
    claim_type: str
    categories: list[str]
    points: int
    status: str
    flagged: bool
    check_note: str | None
    challenge_name: str | None
    thumb_url: str | None
    photo_url: str | None


class SightingsLogOut(BaseModel):
    starts_at: datetime
    ends_at: datetime
    sightings: list[LoggedSightingOut]


class PostSightingOut(BaseModel):
    sighting: SightingOut
    period_points: int


def period_out(period: Period) -> PeriodOut:
    return PeriodOut(
        kind=period.kind,
        id=period.id,
        name=period.name,
        starts_at=period.starts_at,
        ends_at=period.ends_at,
        rules=rules_out(period.rules),
    )


def sighting_out(sighting: Sighting) -> SightingOut:
    return SightingOut(
        id=sighting.id,
        taken_at=sighting.taken_at,
        claim_type=sighting.claim_type,
        categories=list(sighting.categories),
        points=sighting.points,
        status=sighting.status,
        flagged=sighting.flagged,
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


def _leaderboard_period(repo: SightingsRepo, scope: str, now: datetime) -> Period | None:
    if scope == "all":
        return None
    if scope == "week":
        return repo.week_at(now)
    period = repo.period_at(now)
    if period.kind != "challenge":
        raise ApiError(404, "no_challenge")
    return period


@router.get("/leaderboard")
def get_leaderboard(
    user: User,
    repo: Repo,
    now: Now,
    scope: Annotated[Literal["week", "all", "challenge"], Query()],
) -> LeaderboardOut:
    period = _leaderboard_period(repo, scope, now)
    board = repo.leaderboard(period)
    return LeaderboardOut(
        scope=scope,
        name=period.name if period else None,
        starts_at=period.starts_at if period else None,
        ends_at=period.ends_at if period else None,
        total_players=board.total_players,
        rows=[
            LeaderboardRowOut(
                player_id=row.player_id,
                display_name=row.display_name,
                points=row.points,
                count=row.count,
                rank=row.rank,
                is_me=row.player_id == user.id,
            )
            for row in board.rows
        ],
    )


@router.get("/sightings")
def get_sightings(
    user: User, repo: Repo, store: Store, cache: UrlCache, now: Now, mine: bool = False
) -> SightingsLogOut:
    week = repo.week_at(now)
    log = repo.week_log(week, user.id if mine else None)
    paths = [s.photo_path for s in log]
    urls = cached_signed_urls(store, cache, paths + [thumb_path(p) for p in paths], now)
    return SightingsLogOut(
        starts_at=week.starts_at,
        ends_at=week.ends_at,
        sightings=[_logged_out(s, user.id, urls) for s in log],
    )


def _logged_out(
    sighting: LoggedSighting, me: UUID, urls: dict[str, str | None]
) -> LoggedSightingOut:
    photo_url = urls.get(sighting.photo_path)
    return LoggedSightingOut(
        id=sighting.id,
        player_id=sighting.player_id,
        display_name=sighting.display_name,
        is_me=sighting.player_id == me,
        taken_at=sighting.taken_at,
        claim_type=sighting.claim_type,
        categories=list(sighting.categories),
        points=sighting.points,
        status=sighting.status,
        flagged=sighting.flagged,
        check_note=sighting.check_note,
        challenge_name=sighting.challenge_name,
        thumb_url=urls.get(thumb_path(sighting.photo_path)) or photo_url,
        photo_url=photo_url,
    )


def _read_photo(photo: UploadFile) -> CleanPhoto:
    data = photo.file.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise ApiError(413, "photo_too_large")
    if photo.content_type != "image/jpeg":
        raise ApiError(422, "invalid_photo")
    try:
        return clean_photo(data)
    except InvalidPhoto as error:
        raise ApiError(422, "invalid_photo") from error


def _check_location(latitude: float | None, longitude: float | None) -> None:
    if (latitude is None) != (longitude is None):
        raise ApiError(422, "invalid_request")


def _accepts_photos(period: Period, now: datetime) -> bool:
    if period.kind == "challenge":
        return now < period.ends_at
    return not period.closed


def _post_result(repo: SightingsRepo, sighting: Sighting, period: Period) -> PostSightingOut:
    standing = repo.standing(sighting.player_id, period)
    return PostSightingOut(sighting=sighting_out(sighting), period_points=standing.points)


@router.post("/sightings", status_code=status.HTTP_201_CREATED)
def post_sighting(
    user: User,
    players: Players,
    repo: Repo,
    store: Store,
    now: Now,
    response: Response,
    background: BackgroundTasks,
    verify: Verify,
    sighting_id: Annotated[UUID, Form(alias="id")],
    photo: Annotated[UploadFile, File()],
    claim_type: Annotated[str, Form()],
    taken_at: Annotated[datetime, Form()],
    categories: Annotated[list[str] | None, Form()] = None,
    latitude: Annotated[float | None, Form(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Form(ge=-180, le=180)] = None,
) -> PostSightingOut:
    if taken_at.tzinfo is None or taken_at > now + MAX_CLOCK_SKEW:
        raise ApiError(422, "invalid_request")
    _check_location(latitude, longitude)
    cleaned = _read_photo(photo)
    if latitude is None:
        latitude, longitude = cleaned.latitude, cleaned.longitude
    if players.get(user.id) is None:
        raise ApiError(404, "no_player")

    existing = repo.find(sighting_id)
    if existing:
        if existing.player_id != user.id:
            raise ApiError(409, "conflict")
        response.status_code = status.HTTP_200_OK
        return _post_result(repo, existing, repo.period_at(now))

    period = repo.period_at(taken_at)
    if not _accepts_photos(period, now):
        period = repo.period_at(now)
    try:
        points = points_for(period.rules, claim_type, categories or [])
    except InvalidClaim as error:
        raise ApiError(422, "invalid_claim") from error

    path = f"{user.id}/{sighting_id}.jpg"
    try:
        store.upload(path, cleaned.data)
        store.upload(thumb_path(path), cleaned.thumbnail)
        store.upload(display_path(path), cleaned.display)
    except StorageUnavailable as error:
        raise ApiError(502, "storage_unavailable") from error

    sighting = repo.insert(
        NewSighting(
            id=sighting_id,
            player_id=user.id,
            photo_path=path,
            taken_at=taken_at,
            claim_type=claim_type,
            categories=tuple(categories or []),
            points=points,
            latitude=latitude,
            longitude=longitude,
            week_id=period.id if period.kind == "week" else None,
            challenge_id=period.id if period.kind == "challenge" else None,
        )
    )
    if sighting.player_id != user.id:
        raise ApiError(409, "conflict")
    background.add_task(verify)
    return _post_result(repo, sighting, period)
