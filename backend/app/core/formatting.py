"""Shared display formatting helpers."""

from datetime import date, datetime, time

from app.core.timezone_utils import to_hospital_local


def format_time_12h(t: time) -> str:
    """Format a time as 12-hour clock with AM/PM, e.g. 14:30 → 2:30 PM."""
    hour = t.hour % 12 or 12
    period = "AM" if t.hour < 12 else "PM"
    return f"{hour}:{t.minute:02d} {period}"


def format_time_range_12h(start: time, end: time) -> str:
    """Format a time range in 12-hour clock, e.g. 2:00 PM - 2:30 PM."""
    return f"{format_time_12h(start)} - {format_time_12h(end)}"


def format_slot_datetime(target_date: date, slot_time: time) -> str:
    """Format appointment date and time for notifications, e.g. 15 June 2026 at 2:30 PM."""
    return f"{target_date.strftime('%d %B %Y')} at {format_time_12h(slot_time)}"


def format_datetime_12h(dt: datetime) -> str:
    """Format a datetime for display in hospital-local time."""
    local = to_hospital_local(dt)
    return f"{local.strftime('%B %d, %Y')} at {format_time_12h(local.time())}"
