from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.admin.audit_repo import AuditEntry, AuditRepo, get_audit_repo
from app.admin.guard import get_admin_user
from app.admin.review import Action, Decision, ReviewItem, decide
from app.admin.review_repo import ReviewRepo, get_review_repo
from app.auth.tokens import CurrentUser
from app.clock import get_now
from app.errors import ApiError
from app.sightings.photo_store import PhotoStore, get_photo_store, thumb_path
from app.sightings.routes import RulesOut, rules_out
from app.sightings.scoring import InvalidClaim
from app.sightings.url_cache import SignedUrlCache, cached_signed_urls, get_url_cache

router = APIRouter(prefix="/admin/review")

Admin = Annotated[CurrentUser, Depends(get_admin_user)]
Audit = Annotated[AuditRepo, Depends(get_audit_repo)]
Review = Annotated[ReviewRepo, Depends(get_review_repo)]
Store = Annotated[PhotoStore, Depends(get_photo_store)]
UrlCache = Annotated[SignedUrlCache, Depends(get_url_cache)]
Now = Annotated[datetime, Depends(get_now)]


class ReviewItemOut(BaseModel):
    id: UUID
    display_name: str
    taken_at: datetime
    claim_type: str
    categories: list[str]
    points: int
    status: str
    check_note: str | None
    verification_notes: str | None
    photo_url: str | None
    thumb_url: str | None


class ReviewDetailOut(ReviewItemOut):
    rules: RulesOut


class ReviewQueueOut(BaseModel):
    flagged: list[ReviewItemOut]
    false_calls: list[ReviewItemOut]


class ReviewBody(BaseModel):
    action: Action
    category: str | None = None


def items_out(
    items: tuple[ReviewItem, ...], store: PhotoStore, cache: SignedUrlCache, now: datetime
) -> list[ReviewItemOut]:
    paths = [i.photo_path for i in items]
    urls = cached_signed_urls(store, cache, paths + [thumb_path(p) for p in paths], now)
    return [
        ReviewItemOut(
            id=i.id,
            display_name=i.display_name,
            taken_at=i.taken_at,
            claim_type=i.claim_type,
            categories=list(i.categories),
            points=i.points,
            status=i.status,
            check_note=i.check_note,
            verification_notes=i.verification_notes,
            photo_url=urls.get(i.photo_path),
            thumb_url=urls.get(thumb_path(i.photo_path)) or urls.get(i.photo_path),
        )
        for i in items
    ]


def snapshot(decision: Decision, flagged: bool) -> dict[str, object]:
    return {
        "status": decision.status,
        "claim_type": decision.claim_type,
        "categories": list(decision.categories),
        "points": decision.points,
        "flagged": flagged,
    }


def waiting_item(review: ReviewRepo, sighting_id: UUID) -> ReviewItem:
    item = review.find(sighting_id)
    if item is None:
        raise ApiError(404, "not_found")
    return item


@router.get("")
def get_queue(
    _admin: Admin, review: Review, store: Store, cache: UrlCache, now: Now
) -> ReviewQueueOut:
    items = review.queue()
    flagged = tuple(i for i in items if i.status != "false_call")
    false_calls = tuple(i for i in items if i.status == "false_call")
    return ReviewQueueOut(
        flagged=items_out(flagged, store, cache, now),
        false_calls=items_out(false_calls, store, cache, now),
    )


@router.get("/{sighting_id}")
def get_item(
    sighting_id: UUID, _admin: Admin, review: Review, store: Store, cache: UrlCache, now: Now
) -> ReviewDetailOut:
    item = waiting_item(review, sighting_id)
    (out,) = items_out((item,), store, cache, now)
    return ReviewDetailOut(**out.model_dump(), rules=rules_out(review.rules_for(item)))


@router.post("/{sighting_id}", status_code=204)
def post_review(
    sighting_id: UUID, body: ReviewBody, admin: Admin, review: Review, audit: Audit
) -> Response:
    item = waiting_item(review, sighting_id)
    try:
        decision = decide(item, body.action, body.category, review.rules_for(item))
    except InvalidClaim as error:
        raise ApiError(422, "invalid_category") from error
    if not review.resolve(item.id, decision, admin.id):
        raise ApiError(409, "already_reviewed")
    before = Decision(item.status, item.claim_type, item.categories, item.points)
    audit.record(
        AuditEntry(
            admin_id=admin.id,
            type="photo",
            target_id=item.id,
            before=snapshot(before, item.flagged),
            after=snapshot(decision, False),
        )
    )
    return Response(status_code=204)
