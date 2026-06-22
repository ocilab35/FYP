"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api, DoctorAvailability, getErrorMessage } from "@/lib/api";
import { formatTime12h, formatTimeRange12h } from "@/lib/format";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function DoctorAvailabilityPage() {
  const [slots, setSlots] = useState<DoctorAvailability[]>([]);
  const [day, setDay] = useState("0");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [duration, setDuration] = useState("30");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [hasBreak, setHasBreak] = useState(true);

  const load = () => api.get("/doctors/availability").then((res) => setSlots(res.data.data || [])).catch((e) => toast.error(getErrorMessage(e)));
  useEffect(() => { load(); }, []);

  const addSlot = async () => {
    try {
      await api.post("/doctors/availability", {
        day_of_week: parseInt(day),
        start_time: start,
        end_time: end,
        slot_duration_minutes: parseInt(duration),
        break_times: hasBreak ? [{ start_time: breakStart, end_time: breakEnd }] : [],
      });
      toast.success("Schedule block added");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const removeSlot = async (id: string) => {
    try {
      await api.delete(`/doctors/availability/${id}`);
      toast.success("Schedule block removed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader role="doctor" title="Availability Schedule" description="Define working hours, breaks, and slot duration. Patients can only book generated slots." />

      <DashboardCard padding="none">
        <DashboardCardHeader title="Add Working Hours" />
        <DashboardCardBody className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={day} onValueChange={(v) => v && setDay(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Slot Duration (minutes)</Label>
              <Select value={duration} onValueChange={(v) => v && setDuration(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["15", "20", "30", "45", "60"].map((d) => (
                    <SelectItem key={d} value={d}>{d} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>End Time</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="has-break" checked={hasBreak} onChange={(e) => setHasBreak(e.target.checked)} />
              <Label htmlFor="has-break">Include break time</Label>
            </div>
            {hasBreak && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Break Start</Label><Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} /></div>
                <div className="space-y-2"><Label>Break End</Label><Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} /></div>
              </div>
            )}
          </div>
          <Button onClick={addSlot} className="w-full rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)] sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Schedule Block
          </Button>
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard padding="none">
        <DashboardCardHeader title="Current Schedule" />
        <DashboardCardBody>
          {slots.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No availability configured</p>
          ) : (
            <div className="space-y-3">
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 gap-4">
                  <div>
                    <p className="font-medium">{DAYS[s.day_of_week]}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime12h(s.start_time)} — {formatTime12h(s.end_time)} · {s.slot_duration_minutes} min slots
                    </p>
                    {s.break_times?.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {s.break_times.map((b, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            Break {formatTimeRange12h(b.start_time, b.end_time)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removeSlot(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
