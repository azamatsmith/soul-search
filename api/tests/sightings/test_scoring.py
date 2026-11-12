import pytest

from app.sightings.scoring import InvalidClaim, Rules, points_for

WEEKLY = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories={"Alien Green": 2, "Racing stripes": 2, "Brown paint": 2},
)
BROWN_WEEK = Rules(regular=1, special=None, false_call=-1, categories={"Brown paint": 3})


def test_regular_earns_regular_points():
    assert points_for(WEEKLY, "regular", []) == 1


def test_special_earns_special_points():
    assert points_for(WEEKLY, "special", ["Racing stripes"]) == 2


def test_challenge_category_earns_its_points():
    assert points_for(BROWN_WEEK, "challenge", ["Brown paint"]) == 3


def test_regular_during_a_challenge_earns_regular_points():
    assert points_for(BROWN_WEEK, "regular", []) == 1


@pytest.mark.parametrize(
    ("rules", "claim_type", "categories"),
    [
        (WEEKLY, "special", []),
        (WEEKLY, "special", ["Purple"]),
        (WEEKLY, "regular", ["Alien Green"]),
        (WEEKLY, "special", ["Alien Green", "Alien Green"]),
        (WEEKLY, "special", ["Alien Green", "Racing stripes"]),
        (WEEKLY, "other", []),
        (WEEKLY, "challenge", ["Brown paint"]),
        (BROWN_WEEK, "special", ["Brown paint"]),
        (BROWN_WEEK, "challenge", ["Alien Green"]),
        (BROWN_WEEK, "challenge", []),
    ],
    ids=[
        "special-without-category",
        "unknown-category",
        "regular-with-category",
        "dupe",
        "several-categories",
        "type",
        "challenge-claim-in-a-week",
        "special-during-a-challenge",
        "weekly-category-during-a-challenge",
        "challenge-without-category",
    ],
)
def test_invalid_claims_are_rejected(rules: Rules, claim_type: str, categories: list[str]):
    with pytest.raises(InvalidClaim):
        points_for(rules, claim_type, categories)
