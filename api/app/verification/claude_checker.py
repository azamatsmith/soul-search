import base64
import logging
from typing import Protocol

import anthropic
from pydantic import BaseModel

from app.verification.outcome import CheckResult, Claim, Verdict

MODEL = "claude-opus-5-5"
MAX_TOKENS = 16000

log = logging.getLogger(__name__)

SYSTEM = """\
You check photos for Soul Search, a family game where players photograph Kia Soul cars.
Each photo comes with the player's claim: Regular (any Kia Soul) or Special (a Soul with \
one or more named features).

Decide:
- is_kia_soul: "yes" if the main car is clearly a Kia Soul (any year), "no" if it is clearly \
another car or there is no car, "unsure" if it is too far, blurry, dark or cropped to tell.
- categories: for every claimed Special feature, "yes" if the car clearly has it, "no" if it \
clearly does not, "unsure" otherwise. Leave the list empty for a Regular claim.
- player_note: one short, friendly sentence a player sees when something is off, such as \
"Wasn't sure about the stripes." Plain words, no jargon. Never mention the license plate. \
Empty when everything checks out.
- reasoning: your full reasoning for an admin reviewing the photo.
- plate_number and plate_state: only when the Kia Soul's license plate is fully readable. \
Never guess and never give a partial plate; use null instead. Give the state as a \
two-letter US code only if the plate shows it clearly, otherwise null."""


class CategoryVerdict(BaseModel):
    category: str
    verdict: Verdict


class ModelVerdict(BaseModel):
    is_kia_soul: Verdict
    categories: list[CategoryVerdict]
    player_note: str
    reasoning: str
    plate_number: str | None
    plate_state: str | None


class CheckFailed(Exception):
    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class PhotoChecker(Protocol):
    def check(self, photo: bytes, claim: Claim) -> CheckResult: ...


class ClaudePhotoChecker:
    def __init__(self, client: anthropic.Anthropic) -> None:
        self._client = client

    def check(self, photo: bytes, claim: Claim) -> CheckResult:
        try:
            response = self._client.messages.parse(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM,
                output_config={"effort": "high"},
                output_format=ModelVerdict,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64.standard_b64encode(photo).decode(),
                                },
                            },
                            {"type": "text", "text": _claim_text(claim)},
                        ],
                    }
                ],
            )
        except anthropic.APIStatusError as error:
            retryable = error.status_code in (408, 409, 429) or error.status_code >= 500
            raise CheckFailed(f"Claude API {error.status_code}", retryable=retryable) from error
        except anthropic.APITimeoutError as error:
            log.warning("Photo check timed out")
            raise CheckFailed("Claude API timed out", retryable=True) from error
        except anthropic.APIConnectionError as error:
            message = _unreachable(error)
            log.warning("Photo check failed: %s", message)
            raise CheckFailed(message, retryable=True) from error

        if response.stop_reason == "refusal":
            log.warning("Photo check refused, request %s", response._request_id)
            raise CheckFailed("Claude declined to check the photo", retryable=False)
        verdict = response.parsed_output
        if verdict is None:
            raise CheckFailed(f"No verdict (stop reason {response.stop_reason})", retryable=True)
        return CheckResult(
            is_kia_soul=verdict.is_kia_soul,
            categories={item.category: item.verdict for item in verdict.categories},
            player_note=verdict.player_note,
            reasoning=verdict.reasoning,
            plate_number=verdict.plate_number,
            plate_state=verdict.plate_state,
        )


def _unreachable(error: anthropic.APIConnectionError) -> str:
    # Only the cause's type: its message can echo request headers, including the API key.
    cause = error.__cause__
    return f"Claude API unreachable ({type(cause).__name__})" if cause else "Claude API unreachable"


def _claim_text(claim: Claim) -> str:
    if claim.categories:
        features = "\n".join(f"- {category}" for category in claim.categories)
        return f"Claim: Special. Claimed features:\n{features}"
    return "Claim: Regular."
