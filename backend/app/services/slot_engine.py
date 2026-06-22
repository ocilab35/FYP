"""Slot generation engine — builds bookable windows from doctor availability."""

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.core.formatting import format_time_range_12h
from app.core.timezone_utils import combine_local_date_time, hospital_now


@dataclass(frozen=True)
class GeneratedSlot:
    start_time: time
    end_time: time
    duration_minutes: int

    @property
    def label(self) -> str:
        return format_time_range_12h(self.start_time, self.end_time)


def _parse_break(break_item: dict) -> tuple[time, time]:
    start = time.fromisoformat(break_item["start_time"])
    end = time.fromisoformat(break_item["end_time"])
    return start, end


def _overlaps_break(slot_start: time, slot_end: time, breaks: list) -> bool:
    for br in breaks:
        b_start, b_end = _parse_break(br)
        if slot_start < b_end and slot_end > b_start:
            return True
    return False


def _overlaps_booked(slot_start: time, slot_end: time, booked: list[tuple[time, time]]) -> bool:
    for b_start, b_end in booked:
        if slot_start < b_end and slot_end > b_start:
            return True
    return False


def generate_slots_for_availability(
    start_time: time,
    end_time: time,
    slot_duration_minutes: int,
    break_times: list,
    target_date: date,
    booked_ranges: list[tuple[time, time]],
    now: datetime | None = None,
) -> list[GeneratedSlot]:
    """Generate available slots for a single availability block on a given date."""
    if now is None:
        now = hospital_now()

    duration = timedelta(minutes=slot_duration_minutes)
    slots: list[GeneratedSlot] = []

    current_dt = combine_local_date_time(target_date, start_time)
    end_dt = combine_local_date_time(target_date, end_time)

    while current_dt + duration <= end_dt:
        slot_end_dt = current_dt + duration
        slot_start = current_dt.time()
        slot_end = slot_end_dt.time()

        in_break = _overlaps_break(slot_start, slot_end, break_times or [])
        is_booked = _overlaps_booked(slot_start, slot_end, booked_ranges)
        is_future = current_dt > now

        if not in_break and not is_booked and is_future:
            slots.append(
                GeneratedSlot(
                    start_time=slot_start,
                    end_time=slot_end,
                    duration_minutes=slot_duration_minutes,
                )
            )

        current_dt += duration

    return slots


def combine_date_time(target_date: date, slot_time: time) -> datetime:
    """Combine date + slot time as hospital-local datetime (stored as timestamptz in UTC)."""
    return combine_local_date_time(target_date, slot_time)
