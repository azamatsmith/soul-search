import re
from typing import Literal

NAME_PATTERN = re.compile(r"[A-Za-z0-9 .'-]{2,20}")
MIN_LENGTH = 2


class DisplayNameError(Exception):
    def __init__(self, code: Literal["too_short", "invalid"]) -> None:
        super().__init__(code)
        self.code = code


def validate_display_name(raw: str) -> str:
    name = raw.strip()
    if len(name) < MIN_LENGTH:
        raise DisplayNameError("too_short")
    if not NAME_PATTERN.fullmatch(name):
        raise DisplayNameError("invalid")
    return name
