"use client";

import { useEffect, useState } from "react";
import { getHospitalNow } from "@/lib/format";

/** Re-render every 30s so join-room buttons appear/disappear at slot boundaries. */
export function useHospitalClock(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => getHospitalNow());

  useEffect(() => {
    setNow(getHospitalNow());
    const id = window.setInterval(() => setNow(getHospitalNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
