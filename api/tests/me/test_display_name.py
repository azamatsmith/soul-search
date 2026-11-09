import pytest

from app.me.display_name import DisplayNameError, validate_display_name


def test_trims_and_accepts():
    assert validate_display_name("  Mom K. ") == "Mom K."


def test_allows_apostrophe_and_hyphen():
    assert validate_display_name("O'Neil-Smith") == "O'Neil-Smith"


@pytest.mark.parametrize(
    ("raw", "code"),
    [
        ("H", "too_short"),
        ("   ", "too_short"),
        (" H ", "too_short"),
        ("A" * 21, "invalid"),
        ("Mom 🚗", "invalid"),
        ("Bob\tSmith", "invalid"),
    ],
)
def test_rejects(raw: str, code: str):
    with pytest.raises(DisplayNameError) as caught:
        validate_display_name(raw)

    assert caught.value.code == code


def test_twenty_characters_allowed():
    assert validate_display_name("A" * 20) == "A" * 20
