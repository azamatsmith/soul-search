from datetime import UTC, datetime

import pytest

from app.sightings.periods import week_bounds


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


@pytest.mark.parametrize(
    ("at", "start", "end"),
    [
        (utc(2026, 11, 10, 12), utc(2026, 11, 9, 8), utc(2026, 11, 16, 8)),
        (utc(2026, 11, 9, 8), utc(2026, 11, 9, 8), utc(2026, 11, 16, 8)),
        (utc(2026, 11, 9, 7, 59), utc(2026, 11, 2, 8), utc(2026, 11, 9, 8)),
        (utc(2026, 11, 1, 20), utc(2026, 10, 26, 7), utc(2026, 11, 2, 8)),
        (utc(2027, 3, 10, 12), utc(2027, 3, 8, 8), utc(2027, 3, 15, 7)),
        (utc(2027, 3, 16, 12), utc(2027, 3, 15, 7), utc(2027, 3, 22, 7)),
    ],
    ids=["mid-week", "exact-start", "just-before", "fall-back-week", "spring-forward-week", "pdt"],
)
def test_week_bounds_are_pacific_mondays(at: datetime, start: datetime, end: datetime):
    assert week_bounds(at) == (start, end)
