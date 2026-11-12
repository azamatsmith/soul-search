from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Rules:
    regular: int
    special: int | None
    false_call: int
    categories: Mapping[str, int]

    @property
    def category_claim(self) -> str:
        return "special" if self.special is not None else "challenge"


class InvalidClaim(Exception):
    pass


def points_for(rules: Rules, claim_type: str, categories: Sequence[str]) -> int:
    if claim_type == "regular" and not categories:
        return rules.regular
    if claim_type != rules.category_claim or len(categories) != 1:
        raise InvalidClaim
    (category,) = categories
    if category not in rules.categories:
        raise InvalidClaim
    return rules.categories[category]
