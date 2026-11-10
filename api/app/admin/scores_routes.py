from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.admin.audit_repo import AuditEntry, AuditRepo, get_audit_repo
from app.admin.guard import get_admin_user
from app.admin.scores_repo import ScoresRepo, get_scores_repo
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.errors import ApiError
from app.sightings.repo import SightingsRepo, get_sightings_repo

router = APIRouter(prefix="/admin/scores")

Admin = Annotated[CurrentUser, Depends(get_admin_user)]
Audit = Annotated[AuditRepo, Depends(get_audit_repo)]
Scores = Annotated[ScoresRepo, Depends(get_scores_repo)]
Sightings = Annotated[SightingsRepo, Depends(get_sightings_repo)]
Now = Annotated[datetime, Depends(get_now)]

MAX_CHANGE = 10
MAX_REASON_LENGTH = 200


class ScorePeriodOut(BaseModel):
    kind: Literal["week", "challenge"]
    name: str | None


class PlayerScoreOut(BaseModel):
    id: UUID
    display_name: str
    points: int


class ScoresOut(BaseModel):
    period: ScorePeriodOut
    players: list[PlayerScoreOut]


class AdjustBody(BaseModel):
    player_id: UUID
    change: int
    reason: str


class AdjustedOut(BaseModel):
    player_id: UUID
    points: int


@router.get("")
def get_scores(_admin: Admin, scores: Scores, sightings: Sightings, now: Now) -> ScoresOut:
    period = sightings.period_at(now)
    return ScoresOut(
        period=ScorePeriodOut(kind=period.kind, name=period.name),
        players=[
            PlayerScoreOut(id=p.id, display_name=p.display_name, points=p.points)
            for p in scores.players(period)
        ],
    )


@router.post("")
def adjust_score(
    body: AdjustBody, admin: Admin, scores: Scores, sightings: Sightings, audit: Audit, now: Now
) -> AdjustedOut:
    if body.change == 0 or abs(body.change) > MAX_CHANGE:
        raise ApiError(422, "invalid_change")
    reason = body.reason.strip()
    if not 1 <= len(reason) <= MAX_REASON_LENGTH:
        raise ApiError(422, "invalid_reason")
    period = sightings.period_at(now)
    before = scores.points(body.player_id, period)
    if before is None:
        raise ApiError(404, "not_found")
    scores.adjust(body.player_id, admin.id, period, body.change, reason)
    after = before + body.change
    audit.record(
        AuditEntry(
            admin_id=admin.id,
            type="score",
            target_id=body.player_id,
            before={"points": before},
            after={"points": after, "change": body.change},
            reason=reason,
        )
    )
    return AdjustedOut(player_id=body.player_id, points=after)
