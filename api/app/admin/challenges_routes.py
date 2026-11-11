from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from pydantic import AwareDatetime, BaseModel

from app.admin.audit_repo import AuditEntry, AuditRepo, get_audit_repo
from app.admin.challenges import Challenge, ChallengeDraft, ChallengeRules, validate_draft
from app.admin.challenges_repo import (
    ChallengeOverlaps,
    ChallengesRepo,
    Winner,
    get_challenges_repo,
)
from app.admin.guard import get_admin_user
from app.admin.rules_repo import PointRulesRepo, get_point_rules_repo
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.errors import ApiError

router = APIRouter(prefix="/admin/challenges")

Admin = Annotated[CurrentUser, Depends(get_admin_user)]
Audit = Annotated[AuditRepo, Depends(get_audit_repo)]
Challenges = Annotated[ChallengesRepo, Depends(get_challenges_repo)]
Rules = Annotated[PointRulesRepo, Depends(get_point_rules_repo)]
Now = Annotated[datetime, Depends(get_now)]


class RulesBody(BaseModel):
    regular: int
    special: int
    false_call: int
    bonuses: dict[str, int] = {}


class ChallengeBody(BaseModel):
    name: str
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    rules: RulesBody


class ChallengeOut(BaseModel):
    id: UUID
    name: str
    starts_at: datetime
    ends_at: datetime
    rules: RulesBody


class ChallengeDetailOut(ChallengeOut):
    started: bool


class WinnerOut(BaseModel):
    display_name: str
    points: int


class FinishedChallengeOut(ChallengeOut):
    winner: WinnerOut | None


class ChallengesOut(BaseModel):
    running: list[ChallengeOut]
    upcoming: list[ChallengeOut]
    finished: list[FinishedChallengeOut]


def challenge_out(challenge: Challenge) -> ChallengeOut:
    return ChallengeOut(
        id=challenge.id,
        name=challenge.name,
        starts_at=challenge.starts_at,
        ends_at=challenge.ends_at,
        rules=RulesBody(
            regular=challenge.rules.regular,
            special=challenge.rules.special,
            false_call=challenge.rules.false_call,
            bonuses=dict(challenge.rules.bonuses),
        ),
    )


def finished_out(challenge: Challenge, winner: Winner | None) -> FinishedChallengeOut:
    return FinishedChallengeOut(
        **challenge_out(challenge).model_dump(),
        winner=WinnerOut(display_name=winner.display_name, points=winner.points)
        if winner
        else None,
    )


def history_json(challenge: Challenge) -> dict[str, object]:
    return challenge_out(challenge).model_dump(mode="json", exclude={"id"})


def to_draft(body: ChallengeBody) -> ChallengeDraft:
    return ChallengeDraft(
        name=body.name,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        rules=ChallengeRules(
            regular=body.rules.regular,
            special=body.rules.special,
            false_call=body.rules.false_call,
            bonuses=body.rules.bonuses,
        ),
    )


def checked_draft(
    body: ChallengeBody,
    challenges: ChallengesRepo,
    rules: PointRulesRepo,
    now: datetime,
    existing: Challenge | None = None,
) -> ChallengeDraft:
    draft = validate_draft(to_draft(body), rules.get().categories, now, existing)
    clash = challenges.overlapping(draft.starts_at, draft.ends_at, existing and existing.id)
    if clash:
        raise ApiError(422, "overlaps", name=clash)
    return draft


@contextmanager
def reporting_overlaps() -> Iterator[None]:
    try:
        yield
    except ChallengeOverlaps as clash:
        raise ApiError(422, "overlaps", name=clash.name) from None


def found(challenges: ChallengesRepo, challenge_id: UUID) -> Challenge:
    challenge = challenges.get(challenge_id)
    if challenge is None:
        raise ApiError(404, "not_found")
    return challenge


@router.get("")
def list_challenges(_admin: Admin, challenges: Challenges, now: Now) -> ChallengesOut:
    listing = challenges.list(now)
    return ChallengesOut(
        running=[challenge_out(c) for c in listing.running],
        upcoming=[challenge_out(c) for c in listing.upcoming],
        finished=[finished_out(c, winner) for c, winner in listing.finished],
    )


@router.get("/{challenge_id}")
def get_challenge(
    challenge_id: UUID, _admin: Admin, challenges: Challenges, now: Now
) -> ChallengeDetailOut:
    challenge = found(challenges, challenge_id)
    return ChallengeDetailOut(
        **challenge_out(challenge).model_dump(), started=challenge.starts_at <= now
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_challenge(
    body: ChallengeBody, admin: Admin, challenges: Challenges, rules: Rules, audit: Audit, now: Now
) -> ChallengeOut:
    with reporting_overlaps():
        created = challenges.create(checked_draft(body, challenges, rules, now), admin.id)
    audit.record(
        AuditEntry(
            admin_id=admin.id,
            type="challenge",
            target_id=created.id,
            before=None,
            after=history_json(created),
        )
    )
    return challenge_out(created)


@router.put("/{challenge_id}")
def update_challenge(
    challenge_id: UUID,
    body: ChallengeBody,
    admin: Admin,
    challenges: Challenges,
    rules: Rules,
    audit: Audit,
    now: Now,
) -> ChallengeOut:
    existing = found(challenges, challenge_id)
    with reporting_overlaps():
        updated = challenges.update(
            challenge_id, checked_draft(body, challenges, rules, now, existing)
        )
    audit.record(
        AuditEntry(
            admin_id=admin.id,
            type="challenge",
            target_id=challenge_id,
            before=history_json(existing),
            after=history_json(updated),
        )
    )
    return challenge_out(updated)


@router.delete("/{challenge_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_challenge(
    challenge_id: UUID, admin: Admin, challenges: Challenges, audit: Audit
) -> Response:
    existing = found(challenges, challenge_id)
    challenges.delete(challenge_id)
    audit.record(
        AuditEntry(
            admin_id=admin.id,
            type="challenge",
            target_id=challenge_id,
            before=history_json(existing),
            after=None,
        )
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
