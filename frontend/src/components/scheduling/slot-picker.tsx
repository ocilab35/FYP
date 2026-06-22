"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatTimeRange12h } from "@/lib/format";
import { api, AvailableSlot, getErrorMessage } from "@/lib/api";

interface SlotPickerProps {
  doctorId: string;
  selectedDate: string;
  onDateChange: (date: string) => void;
  selectedSlot: AvailableSlot | null;
  onSlotSelect: (slot: AvailableSlot | null) => void;
}

export function SlotPicker({
  doctorId,
  selectedDate,
  onDateChange,
  selectedSlot,
  onSlotSelect,
}: SlotPickerProps) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = new Date().toISOString().split("T")[0];

  const uniqueSlots = useMemo(() => {
    const seen = new Set<string>();
    return slots.filter((slot) => {
      if (seen.has(slot.start_time)) return false;
      seen.add(slot.start_time);
      return true;
    });
  }, [slots]);

  useEffect(() => {
    if (!doctorId || !selectedDate) {
      setSlots([]);
      return;
    }
    setLoading(true);
    setError(null);
    onSlotSelect(null);
    api
      .get(`/patients/doctors/${doctorId}/available-slots`, { params: { date: selectedDate } })
      .then((res) => setSlots(res.data.data || []))
      .catch((e) => {
        setError(getErrorMessage(e));
        setSlots([]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, selectedDate]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="appt-date" className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Select Date
        </Label>
        <Input
          id="appt-date"
          type="date"
          min={minDate}
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Available Time Slots</Label>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : uniqueSlots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No available slots for this date. Try another day.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {uniqueSlots.map((slot) => {
              const isSelected = selectedSlot?.start_time === slot.start_time;
              return (
                <motion.button
                  key={`${slot.start_time}-${slot.end_time}`}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSlotSelect(isSelected ? null : slot)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                    isSelected
                      ? "gradient-medical text-white border-transparent shadow-md"
                      : "bg-muted/30 hover:bg-primary/10 hover:border-primary/30"
                  )}
                  aria-pressed={isSelected}
                >
                  {formatTimeRange12h(slot.start_time, slot.end_time)}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
