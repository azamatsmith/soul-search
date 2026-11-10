import pytest

from app.verification.outcome import CheckResult, Claim, decide, normalize_plate

REGULAR = Claim(claim_type="regular", categories=(), points=1, false_call_points=-1)
SPECIAL = Claim(
    claim_type="special", categories=("Racing stripes",), points=2, false_call_points=-1
)


def result(**overrides) -> CheckResult:
    values = {
        "is_kia_soul": "yes",
        "categories": {},
        "player_note": "",
        "reasoning": "Boxy hatchback with a Kia badge.",
        "plate_number": None,
        "plate_state": None,
    }
    values.update(overrides)
    return CheckResult(**values)


def test_confirmed_regular_is_counted_without_a_note():
    outcome = decide(REGULAR, result())

    assert outcome.status == "counted"
    assert outcome.flagged is False
    assert outcome.points == 1
    assert outcome.check_note is None
    assert outcome.verification_notes == "Boxy hatchback with a Kia badge."


def test_confirmed_special_with_matching_categories_is_counted():
    outcome = decide(SPECIAL, result(categories={"Racing stripes": "yes"}))

    assert (outcome.status, outcome.flagged, outcome.points) == ("counted", False, 2)


def test_not_a_soul_becomes_a_false_call_with_the_false_call_points():
    claim = Claim(claim_type="special", categories=("Brown paint",), points=5, false_call_points=-3)

    outcome = decide(
        claim, result(is_kia_soul="no", player_note="This looks like a Honda Element.")
    )

    assert outcome.status == "false_call"
    assert outcome.flagged is False
    assert outcome.points == -3
    assert outcome.check_note == "This looks like a Honda Element."


def test_unsure_soul_still_counts_but_is_flagged():
    outcome = decide(REGULAR, result(is_kia_soul="unsure", player_note="Car was too far away."))

    assert (outcome.status, outcome.flagged, outcome.points) == ("counted", True, 1)
    assert outcome.check_note == "Car was too far away."


@pytest.mark.parametrize("verdict", ["no", "unsure"])
def test_special_that_looks_ordinary_keeps_points_and_is_flagged(verdict: str):
    outcome = decide(
        SPECIAL,
        result(
            categories={"Racing stripes": verdict}, player_note="Wasn't sure about the stripes."
        ),
    )

    assert (outcome.status, outcome.flagged, outcome.points) == ("counted", True, 2)
    assert outcome.check_note == "Wasn't sure about the stripes."


def test_missing_category_verdict_is_treated_as_unsure():
    outcome = decide(SPECIAL, result(categories={}))

    assert outcome.flagged is True


def test_flagged_without_a_model_note_gets_a_default_note():
    outcome = decide(REGULAR, result(is_kia_soul="unsure", player_note="  "))

    assert outcome.check_note == "We weren't sure about this one, so a person will take a look."


def test_false_call_without_a_model_note_gets_a_default_note():
    outcome = decide(REGULAR, result(is_kia_soul="no"))

    assert outcome.check_note == "This didn't look like a Kia Soul."


def test_long_player_notes_are_trimmed():
    outcome = decide(REGULAR, result(is_kia_soul="unsure", player_note="x" * 500))

    assert outcome.check_note is not None
    assert len(outcome.check_note) <= 200


def test_plate_is_carried_onto_the_outcome():
    outcome = decide(REGULAR, result(plate_number="8abc-123", plate_state="ca"))

    assert (outcome.plate_number, outcome.plate_state) == ("8ABC123", "CA")


@pytest.mark.parametrize(
    ("number", "state", "expected"),
    [
        ("8ABC123", "CA", ("8ABC123", "CA")),
        (" 8abc 123 ", " ca ", ("8ABC123", "CA")),
        ("SOUL-4U", "WA", ("SOUL4U", "WA")),
        ("8ABC123", None, ("8ABC123", None)),
        ("8ABC123", "ZZ", ("8ABC123", None)),
        ("8ABC123", "California", ("8ABC123", None)),
        (None, "CA", (None, None)),
        ("", "CA", (None, None)),
        ("8AB?123", "CA", (None, None)),
        ("8ABC1234X", "CA", (None, None)),
    ],
)
def test_normalize_plate(number, state, expected):
    assert normalize_plate(number, state) == expected
