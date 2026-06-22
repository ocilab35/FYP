import type { Appointment } from "@/lib/api";
import { formatAppointmentTime12h, getHospitalNow, toHospitalDate } from "@/lib/format";

const JOINABLE_STATUSES = new Set(["approved", "confirmed", "active"]);

export function getAppointmentWindow(appointment: Appointment): { start: Date; end: Date } {
  const start = toHospitalDate(appointment.scheduled_at);
  const end = new Date(start.getTime() + appointment.duration_minutes * 60 * 1000);
  return { start, end };
}

/** True when the appointment is approved and current time is within [start, end). */
export function canJoinConsultationRoom(appointment: Appointment, now = getHospitalNow()): boolean {
  if (!JOINABLE_STATUSES.has(appointment.status.toLowerCase())) {
    return false;
  }
  const { start, end } = getAppointmentWindow(appointment);
  return now.getTime() >= start.getTime() && now.getTime() < end.getTime();
}

export function isConsultationRoomUpcoming(appointment: Appointment, now = getHospitalNow()): boolean {
  if (!JOINABLE_STATUSES.has(appointment.status.toLowerCase())) {
    return false;
  }
  const { start } = getAppointmentWindow(appointment);
  return now.getTime() < start.getTime();
}

export function isConsultationRoomEnded(appointment: Appointment, now = getHospitalNow()): boolean {
  const { end } = getAppointmentWindow(appointment);
  return now.getTime() >= end.getTime();
}

export function getConsultationRoomMessage(appointment: Appointment, now = getHospitalNow()): string | null {
  if (!JOINABLE_STATUSES.has(appointment.status.toLowerCase())) {
    return null;
  }
  if (canJoinConsultationRoom(appointment, now)) {
    return null;
  }
  const { start, end } = getAppointmentWindow(appointment);
  if (now.getTime() < start.getTime()) {
    return `Room opens at ${formatAppointmentTime12h(start)}`;
  }
  if (now.getTime() >= end.getTime()) {
    return `Slot ended at ${formatAppointmentTime12h(end)}`;
  }
  return null;
}

export function isConsultationListed(appointment: Appointment): boolean {
  return ["approved", "confirmed", "active", "completed"].includes(appointment.status.toLowerCase());
}
