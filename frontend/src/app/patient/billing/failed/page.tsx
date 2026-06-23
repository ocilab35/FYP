"use client";

import { XCircle } from "lucide-react";
import { LinkButton } from "@/components/shared/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard";

export default function PaymentFailedPage() {
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <PageHeader role="patient" title="Payment Failed" description="Your payment could not be completed." />
      <Card className="border-red-200/50">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <XCircle className="h-14 w-14 text-red-500" />
          <p className="text-muted-foreground">
            No charges were made. Your appointment slot was not reserved. Please try again.
          </p>
          <div className="flex gap-3">
            <LinkButton href="/patient/doctors" className="rounded-xl">
              Find Doctors
            </LinkButton>
            <LinkButton href="/patient/billing/plans" variant="outline" className="rounded-xl">
              View Plans
            </LinkButton>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
