import { format, parse } from "date-fns";

const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Karachi";

/** Convert API datetime to hospital-local wall clock for display. */
export function toHospitalDate(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

/** Current time in the hospital timezone (for slot window checks). */
export function getHospitalNow(): Date {
  return toHospitalDate(new Date());
}

/** Convert 24-hour time string (HH:mm or HH:mm:ss) to 12-hour display, e.g. 14:30 → 2:30 PM */
export function formatTime12h(value: string): string {
  const normalized = value.length === 5 ? `${value}:00` : value.slice(0, 8);
  const parsed = parse(normalized, "HH:mm:ss", new Date());
  return format(parsed, "h:mm a");
}

/** Format a time range in 12-hour clock, e.g. 2:00 PM - 2:30 PM */
export function formatTimeRange12h(start: string, end: string): string {
  return `${formatTime12h(start)} - ${formatTime12h(end)}`;
}

/** Format date + time in 12-hour clock, e.g. Jun 15, 2026 at 2:30 PM */
export function formatDateTime12h(value: Date | string, datePattern = "PPP"): string {
  const date = toHospitalDate(value);
  return `${format(date, datePattern)} at ${format(date, "h:mm a")}`;
}

/** Long date + 12-hour time, e.g. Monday, June 15, 2026 at 2:30 PM */
export function formatDateTimeLong12h(value: Date | string): string {
  const date = toHospitalDate(value);
  return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
}

/** Full weekday date + 12-hour time */
export function formatDateTimeFull12h(value: Date | string): string {
  const date = toHospitalDate(value);
  return format(date, "PPPP 'at' h:mm a");
}

/** Time only from an appointment datetime in hospital timezone. */
export function formatAppointmentTime12h(value: Date | string): string {
  return format(toHospitalDate(value), "h:mm a");
}

/** Date and time for admin activity logs */
export function formatTimestamp12h(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d, yyyy h:mm a");
}
