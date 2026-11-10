import pytest

from app.sightings.scoring import InvalidClaim, Rules, points_for

WEEKLY = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories=("Alien Green", "Racing stripes", "Brown paint"),
    bonuses={},
)
BROWN_WEEK = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories=WEEKLY.categories,
    bonuses={"Brown paint": 3},
)


def test_regular_earns_regular_points():
    assert points_for(WEEKLY, "regular", []) == 1


def test_special_earns_special_points_once_for_several_categories():
    assert points_for(WEEKLY, "special", ["Alien Green", "Racing stripes"]) == 2


def test_category_bonus_beats_special_points():
    assert points_for(BROWN_WEEK, "special", ["Brown paint", "Alien Green"]) == 3


def test_bonus_only_applies_to_its_category():
    assert points_for(BROWN_WEEK, "special", ["Alien Green"]) == 2


@pytest.mark.parametrize(
    ("claim_type", "categories"),
    [
        ("special", []),
        ("special", ["Purple"]),
        ("regular", ["Alien Green"]),
        ("special", ["Alien Green", "Alien Green"]),
        ("other", []),
    ],
    ids=["special-without-category", "unknown-category", "regular-with-category", "dupe", "type"],
)
def test_invalid_claims_are_rejected(claim_type: str, categories: list[str]):
    with pytest.raises(InvalidClaim):
        points_for(WEEKLY, claim_type, categories)
