from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.admin.review import Decision, ReviewItem, decide
from app.sightings.scoring import InvalidClaim, Rules

RULES = Rules(
    regular=1,
    special=2,
    false_call=-1,
    categories={"Alien Green": 2, "Racing stripes": 2},
)
CHALLENGE_RULES = Rules(regular=1, special=None, false_call=-1, categories={"Brown paint": 3})


def item(**overrides: object) -> ReviewItem:
    fields: dict = {
        "id": UUID("d4444444-4444-4444-4444-444444444444"),
        "player_id": UUID("b2222222-2222-2222-2222-222222222222"),
        "display_name": "Bob",
        "photo_path": "b/photo.jpg",
        "taken_at": datetime(2030, 6, 12, 18, tzinfo=UTC),
        "claim_type": "special",
        "categories": ("Alien Green",),
        "points": 2,
        "status": "counted",
        "flagged": True,
        "check_note": "Color looks closer to light blue.",
        "verification_notes": "Kia Soul, color unclear.",
        "week_id": UUID("e5555555-5555-5555-5555-555555555555"),
        "challenge_id": None,
    }
    return ReviewItem(**(fields | overrides))


def test_keep_leaves_the_claim_and_points():
    assert decide(item(points=5), "keep", None, RULES) == Decision(
        status="counted", claim_type="special", categories=("Alien Green",), points=5
    )


def test_keep_on_a_false_call_keeps_it():
    false_call = item(status="false_call", flagged=False, points=-1)

    assert decide(false_call, "keep", None, RULES) == Decision(
        status="false_call", claim_type="special", categories=("Alien Green",), points=-1
    )


def test_regular_counts_with_regular_points():
    assert decide(item(), "regular", None, RULES) == Decision(
        status="counted", claim_type="regular", categories=(), points=1
    )


def test_false_call_keeps_the_claim_with_false_call_points():
    assert decide(item(), "false_call", None, RULES) == Decision(
        status="false_call", claim_type="special", categories=("Alien Green",), points=-1
    )


def test_category_restores_a_special_claim_in_a_week():
    regular_false_call = item(claim_type="regular", categories=(), status="false_call", points=-1)

    assert decide(regular_false_call, "category", "Racing stripes", RULES) == Decision(
        status="counted", claim_type="special", categories=("Racing stripes",), points=2
    )


def test_category_restores_a_challenge_claim_during_a_challenge():
    regular_false_call = item(claim_type="regular", categories=(), status="false_call", points=-1)

    assert decide(regular_false_call, "category", "Brown paint", CHALLENGE_RULES) == Decision(
        status="counted", claim_type="challenge", categories=("Brown paint",), points=3
    )


@pytest.mark.parametrize("category", [None, "Fins"])
def test_category_needs_a_known_category(category: str | None):
    with pytest.raises(InvalidClaim):
        decide(item(), "category", category, RULES)
