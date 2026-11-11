from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from typing import cast
from uuid import UUID

from app.errors import ApiError

MAX_NAME_LENGTH = 40
MAX_POINTS = 10


@dataclass(frozen=True)
class ChallengeRules:
    regular: int
    special: int
    false_call: int
    bonuses: Mapping[str, int] = field(default_factory=dict)

    def to_json(self) -> dict[str, object]:
        return {
            "regular": self.regular,
            "special": self.special,
            "false_call": self.false_call,
            "bonuses": dict(self.bonuses),
        }

    @classmethod
    def from_json(cls, data: Mapping[str, object]) -> "ChallengeRules":
        return cls(
            regular=cast(int, data["regular"]),
            special=cast(int, data["special"]),
            false_call=cast(int, data["false_call"]),
            bonuses=dict(cast(Mapping[str, int], data.get("bonuses") or {})),
        )


@dataclass(frozen=True)
class ChallengeDraft:
    name: str
    starts_at: datetime
    ends_at: datetime
    rules: ChallengeRules


@dataclass(frozen=True)
class Challenge:
    id: UUID
    name: str
    starts_at: datetime
    ends_at: datetime
    rules: ChallengeRules


def _check_rules(rules: ChallengeRules, categories: Sequence[str]) -> None:
    in_range = (
        1 <= rules.regular <= MAX_POINTS
        and 1 <= rules.special <= MAX_POINTS
        and -MAX_POINTS <= rules.false_call <= 0
    )
    if not in_range:
        raise ApiError(422, "invalid_points")
    for category, bonus in rules.bonuses.items():
        if category not in categories or not 1 <= bonus <= MAX_POINTS:
            raise ApiError(422, "invalid_bonus")


def validate_draft(
    draft: ChallengeDraft,
    categories: Sequence[str],
    now: datetime,
    existing: Challenge | None = None,
) -> ChallengeDraft:
    name = draft.name.strip()
    if not 1 <= len(name) <= MAX_NAME_LENGTH:
        raise ApiError(422, "invalid_name")
    if draft.ends_at <= draft.starts_at:
        raise ApiError(422, "invalid_times")
    _check_rules(draft.rules, categories)
    if existing is not None and existing.starts_at <= now:
        if draft.starts_at != existing.starts_at:
            raise ApiError(422, "start_locked")
        if draft.ends_at <= now:
            raise ApiError(422, "invalid_times")
    return replace(draft, name=name)
