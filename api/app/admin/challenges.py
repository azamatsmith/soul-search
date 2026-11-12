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
    false_call: int
    categories: Mapping[str, int] = field(default_factory=dict)

    def to_json(self) -> dict[str, object]:
        return {
            "regular": self.regular,
            "false_call": self.false_call,
            "categories": [
                {"name": name, "points": points} for name, points in self.categories.items()
            ],
        }

    @classmethod
    def from_json(cls, data: Mapping[str, object]) -> "ChallengeRules":
        categories = cast(list[Mapping[str, object]], data["categories"])
        return cls(
            regular=cast(int, data["regular"]),
            false_call=cast(int, data["false_call"]),
            categories={cast(str, c["name"]): cast(int, c["points"]) for c in categories},
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
    if not (1 <= rules.regular <= MAX_POINTS and -MAX_POINTS <= rules.false_call <= 0):
        raise ApiError(422, "invalid_points")
    for category, points in rules.categories.items():
        if category not in categories or not 1 <= points <= MAX_POINTS:
            raise ApiError(422, "invalid_category")


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
