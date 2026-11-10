import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

Verdict = Literal["yes", "no", "unsure"]

MAX_NOTE_LENGTH = 200
FLAGGED_NOTE = "We weren't sure about this one, so a person will take a look."
FALSE_CALL_NOTE = "This didn't look like a Kia Soul."
PLATE_PATTERN = re.compile(r"^[A-Z0-9]{2,8}$")
US_STATES = frozenset(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV "
    "NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split()
)


@dataclass(frozen=True)
class Claim:
    claim_type: str
    categories: tuple[str, ...]
    points: int
    false_call_points: int


@dataclass(frozen=True)
class CheckResult:
    is_kia_soul: Verdict
    categories: Mapping[str, Verdict]
    player_note: str
    reasoning: str
    plate_number: str | None
    plate_state: str | None


@dataclass(frozen=True)
class Outcome:
    status: Literal["counted", "false_call"]
    flagged: bool
    points: int
    check_note: str | None
    verification_notes: str
    plate_number: str | None
    plate_state: str | None


def decide(claim: Claim, result: CheckResult) -> Outcome:
    plate_number, plate_state = normalize_plate(result.plate_number, result.plate_state)
    if result.is_kia_soul == "no":
        status, flagged, points = "false_call", False, claim.false_call_points
        note = _note(result.player_note, FALSE_CALL_NOTE)
    else:
        status, points = "counted", claim.points
        flagged = result.is_kia_soul == "unsure" or any(
            result.categories.get(category, "unsure") != "yes" for category in claim.categories
        )
        note = _note(result.player_note, FLAGGED_NOTE) if flagged else None
    return Outcome(
        status=status,
        flagged=flagged,
        points=points,
        check_note=note,
        verification_notes=result.reasoning,
        plate_number=plate_number,
        plate_state=plate_state,
    )


def normalize_plate(number: str | None, state: str | None) -> tuple[str | None, str | None]:
    cleaned = re.sub(r"[\s-]", "", number or "").upper()
    if not PLATE_PATTERN.match(cleaned):
        return None, None
    code = (state or "").strip().upper()
    return cleaned, code if code in US_STATES else None


def _note(text: str, fallback: str) -> str:
    return (text.strip() or fallback)[:MAX_NOTE_LENGTH]
