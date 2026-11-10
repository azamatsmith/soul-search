import base64
from types import SimpleNamespace
from typing import Any, cast

import anthropic
import httpx2
import pytest

from app.verification.claude_checker import (
    MODEL,
    CategoryVerdict,
    CheckFailed,
    ClaudePhotoChecker,
    ModelVerdict,
)
from app.verification.outcome import Claim

SPECIAL = Claim(
    claim_type="special",
    categories=("Racing stripes", "Brown paint"),
    points=2,
    false_call_points=-1,
)


class StubMessages:
    def __init__(self, response: object = None, error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.calls: list[dict[str, Any]] = []

    def parse(self, **kwargs: Any) -> object:
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


def checker_with(messages: StubMessages) -> ClaudePhotoChecker:
    client = cast(anthropic.Anthropic, SimpleNamespace(messages=messages))
    return ClaudePhotoChecker(client)


def response(verdict: ModelVerdict | None, stop_reason: str = "end_turn") -> object:
    return SimpleNamespace(parsed_output=verdict, stop_reason=stop_reason, _request_id="req_1")


VERDICT = ModelVerdict(
    is_kia_soul="yes",
    categories=[
        CategoryVerdict(category="Racing stripes", verdict="yes"),
        CategoryVerdict(category="Brown paint", verdict="unsure"),
    ],
    player_note="Wasn't sure about the paint.",
    reasoning="Kia Soul with two stripes; paint looks bronze in shade.",
    plate_number="8ABC123",
    plate_state=None,
)


def test_check_sends_the_photo_and_claim_to_claude():
    messages = StubMessages(response(VERDICT))

    checker_with(messages).check(b"\xff\xd8jpeg", SPECIAL)

    (call,) = messages.calls
    assert call["model"] == MODEL == "claude-opus-5-5"
    assert call["output_format"] is ModelVerdict
    assert call["output_config"] == {"effort": "high"}
    image, text = call["messages"][0]["content"]
    assert image["source"] == {
        "type": "base64",
        "media_type": "image/jpeg",
        "data": base64.standard_b64encode(b"\xff\xd8jpeg").decode(),
    }
    assert "Special" in text["text"]
    assert "Racing stripes" in text["text"]
    assert "Brown paint" in text["text"]


def test_regular_claim_lists_no_categories():
    messages = StubMessages(response(VERDICT))
    regular = Claim(claim_type="regular", categories=(), points=1, false_call_points=-1)

    checker_with(messages).check(b"jpeg", regular)

    text = messages.calls[0]["messages"][0]["content"][1]["text"]
    assert "Regular" in text
    assert "Racing stripes" not in text


def test_check_maps_the_verdict_to_a_check_result():
    result = checker_with(StubMessages(response(VERDICT))).check(b"jpeg", SPECIAL)

    assert result.is_kia_soul == "yes"
    assert result.categories == {"Racing stripes": "yes", "Brown paint": "unsure"}
    assert result.player_note == "Wasn't sure about the paint."
    assert result.reasoning == "Kia Soul with two stripes; paint looks bronze in shade."
    assert (result.plate_number, result.plate_state) == ("8ABC123", None)


def test_refusal_fails_without_retry():
    with pytest.raises(CheckFailed) as error:
        checker_with(StubMessages(response(None, stop_reason="refusal"))).check(b"j", SPECIAL)

    assert error.value.retryable is False


def test_missing_parsed_output_is_retried():
    with pytest.raises(CheckFailed) as error:
        checker_with(StubMessages(response(None, stop_reason="max_tokens"))).check(b"j", SPECIAL)

    assert error.value.retryable is True


def api_error(status: int) -> anthropic.APIStatusError:
    request = httpx2.Request("POST", "https://api.anthropic.test/v1/messages")
    return anthropic.APIStatusError(
        "boom", response=httpx2.Response(status, request=request), body=None
    )


@pytest.mark.parametrize(
    ("error", "retryable"),
    [
        (api_error(429), True),
        (api_error(529), True),
        (api_error(500), True),
        (api_error(400), False),
        (
            anthropic.APIConnectionError(
                request=httpx2.Request("POST", "https://api.anthropic.test/v1/messages")
            ),
            True,
        ),
    ],
)
def test_api_errors_become_check_failures(error: Exception, retryable: bool):
    with pytest.raises(CheckFailed) as failure:
        checker_with(StubMessages(error=error)).check(b"jpeg", SPECIAL)

    assert failure.value.retryable is retryable


REQUEST = httpx2.Request("POST", "https://api.anthropic.test/v1/messages")


def test_connection_failures_name_the_cause_without_its_message():
    error = anthropic.APIConnectionError(request=REQUEST)
    error.__cause__ = httpx2.LocalProtocolError("Illegal header value b'Bearer sk-ant-secret '")

    with pytest.raises(CheckFailed) as failure:
        checker_with(StubMessages(error=error)).check(b"jpeg", SPECIAL)

    assert str(failure.value) == "Claude API unreachable (LocalProtocolError)"
    assert "sk-ant" not in str(failure.value)


def test_timeouts_say_so():
    with pytest.raises(CheckFailed) as failure:
        checker_with(StubMessages(error=anthropic.APITimeoutError(request=REQUEST))).check(
            b"jpeg", SPECIAL
        )

    assert str(failure.value) == "Claude API timed out"
    assert failure.value.retryable is True
