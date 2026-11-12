from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest

from app.admin.challenges import Challenge, ChallengeDraft, ChallengeRules, validate_draft
from app.errors import ApiError

NOW = datetime(2026, 11, 12, 20, tzinfo=UTC)
CATEGORIES = ("Alien Green", "Brown paint")
RULES = ChallengeRules(regular=1, false_call=-1, categories={"Brown paint": 3})
DRAFT = ChallengeDraft(
    name="Brown Week",
    starts_at=NOW + timedelta(days=1),
    ends_at=NOW + timedelta(days=4),
    rules=RULES,
)
STARTED = Challenge(
    id=uuid4(),
    name="Brown Week",
    starts_at=NOW - timedelta(hours=1),
    ends_at=NOW + timedelta(days=2),
    rules=RULES,
)


def error_code(draft: ChallengeDraft, existing: Challenge | None = None) -> str:
    with pytest.raises(ApiError) as err:
        validate_draft(draft, CATEGORIES, NOW, existing)
    return err.value.code


def test_valid_draft_is_returned_with_trimmed_name():
    result = validate_draft(replace(DRAFT, name="  Brown Week "), CATEGORIES, NOW)

    assert result == DRAFT


@pytest.mark.parametrize("name", ["   ", "x" * 41])
def test_name_must_be_1_to_40_characters(name: str):
    assert error_code(replace(DRAFT, name=name)) == "invalid_name"


def test_name_of_40_characters_is_allowed():
    assert validate_draft(replace(DRAFT, name="x" * 40), CATEGORIES, NOW).name == "x" * 40


def test_end_must_be_after_start():
    assert error_code(replace(DRAFT, ends_at=DRAFT.starts_at)) == "invalid_times"


@pytest.mark.parametrize(
    "rules",
    [
        replace(RULES, regular=0),
        replace(RULES, regular=11),
        replace(RULES, false_call=1),
        replace(RULES, false_call=-11),
    ],
)
def test_points_outside_a4_ranges_are_rejected(rules: ChallengeRules):
    assert error_code(replace(DRAFT, rules=rules)) == "invalid_points"


@pytest.mark.parametrize(
    "categories",
    [{"Purple": 3}, {"brown paint": 3}, {"Brown paint": 0}, {"Brown paint": 11}],
)
def test_category_must_be_a_weekly_category_in_range(categories: dict[str, int]):
    draft = replace(DRAFT, rules=replace(RULES, categories=categories))

    assert error_code(draft) == "invalid_category"


def test_challenge_without_categories_is_allowed():
    draft = replace(DRAFT, rules=replace(RULES, categories={}))

    assert validate_draft(draft, CATEGORIES, NOW).rules.categories == {}


def test_started_challenge_cannot_move_its_start():
    draft = replace(DRAFT, starts_at=STARTED.starts_at + timedelta(minutes=1))

    assert error_code(draft, STARTED) == "start_locked"


def test_start_locked_compares_instants():
    pacific_start = STARTED.starts_at.astimezone(ZoneInfo("America/Los_Angeles"))
    draft = replace(DRAFT, starts_at=pacific_start)

    assert validate_draft(draft, CATEGORIES, NOW, STARTED).starts_at == STARTED.starts_at


def test_started_challenge_end_cannot_be_in_the_past():
    draft = replace(DRAFT, starts_at=STARTED.starts_at, ends_at=NOW)

    assert error_code(draft, STARTED) == "invalid_times"


def test_unstarted_challenge_can_move_its_start():
    upcoming = replace(STARTED, starts_at=NOW + timedelta(hours=2))

    assert validate_draft(DRAFT, CATEGORIES, NOW, upcoming) == DRAFT


def test_rules_round_trip_json():
    assert ChallengeRules.from_json(RULES.to_json()) == RULES


def test_rules_json_lists_categories_with_points():
    assert RULES.to_json() == {
        "regular": 1,
        "false_call": -1,
        "categories": [{"name": "Brown paint", "points": 3}],
    }
