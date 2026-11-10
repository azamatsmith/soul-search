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
    if len(set(categories)) != len(categories):
        raise InvalidClaim
    if claim_type == "regular" and not categories:
        return rules.regular
    if claim_type != "special" or not categories:
        raise InvalidClaim
    if any(category not in rules.categories for category in categories):
        raise InvalidClaim
    bonuses = [rules.bonuses[c] for c in categories if c in rules.bonuses]
    return max([rules.special, *bonuses])
