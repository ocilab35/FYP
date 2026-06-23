"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyCheckout, getErrorMessage } from "@/lib/api";

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const checkoutId = params.get("checkout_id");
  const type = params.get("type");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!checkoutId) {
      setStatus("error");
      setMessage("Missing checkout reference.");
      return;
    }
    verifyCheckout(checkoutId)
      .then((result) => {
        setStatus("success");
        if (result.payment_type === "appointment") {
          setMessage("Your appointment has been booked and payment confirmed.");
        } else {
          setMessage("Your AI Doctor subscription is now active.");
        }
      })
      .catch((e) => {
        setStatus("error");
        setMessage(getErrorMessage(e));
      });
  }, [checkoutId]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full">
        <Card className="border-0 shadow-xl">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-[oklch(0.35_0.12_250)]" />
                <p className="text-muted-foreground">Verifying your payment...</p>
              </>
            )}
            {status === "success" && (
              <>
                <CheckCircle className="h-14 w-14 text-emerald-600" />
                <h1 className="text-2xl font-bold">Payment Successful</h1>
                <p className="text-muted-foreground">{message}</p>
                <div className="mt-4 flex gap-3">
                  {type === "appointment" ? (
                    <LinkButton href="/patient/appointments" className="rounded-xl">
                      View Appointments
                    </LinkButton>
                  ) : (
                    <LinkButton href="/patient/ai-doctor" className="rounded-xl">
                      Open AI Doctor
                    </LinkButton>
                  )}
                  <LinkButton href="/patient/billing/history" variant="outline" className="rounded-xl">
                    Payment History
                  </LinkButton>
                </div>
              </>
            )}
            {status === "error" && (
              <>
                <XCircle className="h-14 w-14 text-red-500" />
                <h1 className="text-2xl font-bold">Verification Failed</h1>
                <p className="text-muted-foreground">{message}</p>
                <Button onClick={() => router.push("/patient/billing/failed")} variant="outline" className="rounded-xl mt-4">
                  Go to Failed Page
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
