from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import UUID

from app.sightings.scoring import InvalidClaim, Rules, points_for

Action = Literal["keep", "regular", "category", "false_call"]


@dataclass(frozen=True)
class ReviewItem:
    id: UUID
    player_id: UUID
    display_name: str
    photo_path: str
    taken_at: datetime
    claim_type: str
    categories: tuple[str, ...]
    points: int
    status: str
    flagged: bool
    check_note: str | None
    verification_notes: str | None
    week_id: UUID | None
    challenge_id: UUID | None


@dataclass(frozen=True)
class Decision:
    status: str
    claim_type: str
    categories: tuple[str, ...]
    points: int


def decide(item: ReviewItem, action: Action, category: str | None, rules: Rules) -> Decision:
    if action == "keep":
        return Decision(item.status, item.claim_type, item.categories, item.points)
    if action == "regular":
        return Decision("counted", "regular", (), rules.regular)
    if action == "false_call":
        return Decision("false_call", item.claim_type, item.categories, rules.false_call)
    if category is None:
        raise InvalidClaim
    categories = (category,)
    claim_type = rules.category_claim
    return Decision("counted", claim_type, categories, points_for(rules, claim_type, categories))
