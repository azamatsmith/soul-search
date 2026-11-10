from collections.abc import Mapping, Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class Rules:
    regular: int
    special: int
    false_call: int
    categories: tuple[str, ...]
    bonuses: Mapping[str, int]


class InvalidClaim(Exception):
    pass


def points_for(rules: Rules, claim_type: str, categories: Sequence[str]) -> int:
    if claim_type == "regular" and not categories:
        return rules.regular
    if claim_type != "special" or len(categories) != 1:
        raise InvalidClaim
    (category,) = categories
    if category not in rules.categories:
        raise InvalidClaim
    return max(rules.special, rules.bonuses.get(category, 0))
