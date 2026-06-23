"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/dashboard";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentHistory, getErrorMessage, PaymentRecord } from "@/lib/api";
import { toast } from "sonner";

export default function BillingHistoryPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentHistory()
      .then(setPayments)
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader role="patient" title="Payment History" description="Subscription and appointment payment records." />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : payments.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No payments yet</p>
      ) : (
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <CreditCard className="h-5 w-5 text-[oklch(0.35_0.12_250)]" />
                </div>
                <div>
                  <p className="font-medium capitalize">{p.payment_type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.created_at), "PPP p")}
                    {p.transaction_id && ` · ${p.transaction_id.slice(0, 12)}...`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">PKR {p.amount.toLocaleString()}</p>
                <StatusBadge status={p.payment_status} type="generic" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
