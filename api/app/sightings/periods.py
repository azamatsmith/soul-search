from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")


def week_bounds(at: datetime) -> tuple[datetime, datetime]:
    local_day = at.astimezone(PACIFIC).date()
    monday = local_day - timedelta(days=local_day.weekday())
    start = datetime.combine(monday, time(), PACIFIC)
    end = datetime.combine(monday + timedelta(days=7), time(), PACIFIC)
    return start.astimezone(UTC), end.astimezone(UTC)
