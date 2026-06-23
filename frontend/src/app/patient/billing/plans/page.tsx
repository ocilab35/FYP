"use client";

import { motion } from "framer-motion";
import { Bot, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSubscriptionCheckout, getErrorMessage } from "@/lib/api";

const FEATURES = [
  "Unlimited AI Doctor Chat",
  "AI Health Risk Analysis",
  "Drug Interaction Detection",
  "AI Report Summarization",
  "AI Health Insights Dashboard",
];

export default function BillingPlansPage() {
  const [loading, setLoading] = useState(false);

  const subscribe = async () => {
    setLoading(true);
    try {
      const session = await createSubscriptionCheckout();
      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      } else {
        toast.error("Could not create checkout session");
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        role="patient"
        title="Subscription Plans"
        description="Unlock AI-powered healthcare services with a monthly subscription."
      />

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="overflow-hidden border-2 border-[oklch(0.35_0.12_250)]/20 shadow-lg">
          <div className="bg-gradient-to-br from-[oklch(0.35_0.12_250)] to-[oklch(0.45_0.14_250)] px-6 py-8 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/80">Most Popular</p>
                <CardTitle className="text-2xl text-white">AI Doctor Plan</CardTitle>
              </div>
            </div>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-bold">PKR 2,000</span>
              <span className="text-white/70">/ month</span>
            </div>
          </div>
          <CardHeader>
            <p className="text-sm text-muted-foreground">30-day access to all AI healthcare features</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              onClick={subscribe}
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecting to checkout...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Subscribe Now</>
              )}
            </Button>
            <p className="text-center text-[10px] text-muted-foreground">
              Secure payment powered by Polar. Sandbox test mode supported.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
