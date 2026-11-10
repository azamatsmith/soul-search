from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class Rules:
    regular: int
    special: int
    false_call: int
    categories: tuple[str, ...]
    bonuses: Mapping[str, int]
