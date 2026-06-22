"""Hospital-local timezone helpers for appointment scheduling."""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings

# Pakistan Standard Time — no DST
_PKT = timezone(timedelta(hours=5))


def hospital_tz():
    try:
        return ZoneInfo(settings.APP_TIMEZONE)
    except Exception:
        return _PKT


def hospital_now() -> datetime:
    return datetime.now(hospital_tz())


def combine_local_date_time(target_date: date, slot_time: time) -> datetime:
    """Combine a calendar date and wall-clock time in the hospital timezone."""
    return datetime.combine(target_date, slot_time, tzinfo=hospital_tz())


def to_hospital_local(dt: datetime) -> datetime:
    """Convert an aware datetime to hospital-local wall clock."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=hospital_tz())
    return dt.astimezone(hospital_tz())
