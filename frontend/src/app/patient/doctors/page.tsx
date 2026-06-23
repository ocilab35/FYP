"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Search, Star, MapPin, Clock } from "lucide-react";
import { DashboardCard, PageHeader } from "@/components/dashboard";
import { SlotPicker } from "@/components/scheduling/slot-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api, AvailableSlot, createAppointmentCheckout, DoctorSearch, getErrorMessage } from "@/lib/api";
import { formatTimeRange12h } from "@/lib/format";
import { toast } from "sonner";

export default function FindDoctorsPage() {
  const searchParams = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [bookingDoctor, setBookingDoctor] = useState<DoctorSearch | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [bookingReason, setBookingReason] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const fetchDoctors = (q?: string) => {
    setLoading(true);
    api.get("/patients/doctors", { params: { q: q || undefined, page_size: 20 } })
      .then((res) => setDoctors(res.data.data?.items || []))
      .catch(() => toast.error("Failed to load doctors"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const spec = searchParams.get("specialization");
    if (spec) {
      setSearch(spec);
      fetchDoctors(spec);
    } else {
      fetchDoctors();
    }
  }, [searchParams]);

  const openBooking = (doc: DoctorSearch) => {
    setBookingDoctor(doc);
    setBookingDate("");
    setSelectedSlot(null);
    setBookingReason("");
    setBookingSuccess(false);
  };

  const closeBooking = () => {
    setBookingDoctor(null);
    setBookingSuccess(false);
  };

  const handleBook = async () => {
    if (!bookingDoctor || !bookingDate || !selectedSlot) {
      toast.error("Please select a date and time slot");
      return;
    }
    setBooking(true);
    try {
      const session = await createAppointmentCheckout({
        doctor_id: bookingDoctor.id,
        appointment_date: bookingDate,
        start_time: selectedSlot.start_time,
        reason: bookingReason || undefined,
      });
      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      } else {
        toast.error("Could not create payment session");
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        role="patient"
        title="Find Doctors"
        description="Browse specialists and book from real-time available slots."
      />

      <DashboardCard padding="md" className="max-w-xl border-border/60">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or specialization..."
            className="h-11 rounded-xl border-border/70 pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchDoctors(search)}
            aria-label="Search doctors"
          />
        </div>
      </DashboardCard>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {doctors.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="h-full rounded-2xl border-border/60 shadow-[0_4px_20px_rgba(15,40,80,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,40,80,0.1)]">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">Dr. {doc.first_name} {doc.last_name}</h3>
                      <p className="text-sm text-primary font-medium">{doc.specialization}</p>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{doc.rating}</span>
                    </div>
                  </div>
                  {doc.hospital_affiliation && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                      <MapPin className="h-3.5 w-3.5" />{doc.hospital_affiliation}
                    </p>
                  )}
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
                    <Clock className="h-3.5 w-3.5" />{doc.experience_years} years · PKR {doc.consultation_fee.toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {doc.expertise_tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <Button size="sm" className="h-10 w-full rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]" onClick={() => openBooking(doc)}>
                    Book Appointment
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!bookingDoctor} onOpenChange={(o) => !o && closeBooking()}>
        <DialogContent className="max-w-lg">
          {bookingSuccess ? (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="h-16 w-16 text-accent mx-auto" />
              <h3 className="text-xl font-bold">Booking Confirmed!</h3>
              <p className="text-muted-foreground text-sm">
                Your appointment with Dr. {bookingDoctor?.last_name} on {bookingDate} at {selectedSlot ? formatTimeRange12h(selectedSlot.start_time, selectedSlot.end_time) : ""} has been confirmed.
              </p>
              <Button onClick={closeBooking} className="gradient-medical border-0 text-white">Done</Button>
            </div>
          ) : bookingDoctor && (
            <>
              <DialogHeader>
                <DialogTitle>Book with Dr. {bookingDoctor.first_name} {bookingDoctor.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <SlotPicker
                  doctorId={bookingDoctor.id}
                  selectedDate={bookingDate}
                  onDateChange={setBookingDate}
                  selectedSlot={selectedSlot}
                  onSlotSelect={setSelectedSlot}
                />
                <div className="space-y-2">
                  <Label htmlFor="appt-reason">Reason for visit (optional)</Label>
                  <Input
                    id="appt-reason"
                    placeholder="Describe your concern"
                    value={bookingReason}
                    onChange={(e) => setBookingReason(e.target.value)}
                  />
                </div>
                <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-medium">Consultation Fee</p>
                  <p className="text-lg font-bold text-[oklch(0.35_0.12_250)]">
                    PKR {bookingDoctor.consultation_fee.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Payment required before appointment is confirmed. Slot reserved only after successful payment.
                  </p>
                </div>
                <Button
                  className="w-full gradient-medical border-0 text-white h-11"
                  onClick={handleBook}
                  disabled={booking || !selectedSlot}
                >
                  {booking ? "Redirecting to payment..." : selectedSlot ? `Pay & Book · ${formatTimeRange12h(selectedSlot.start_time, selectedSlot.end_time)}` : "Select a slot"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
