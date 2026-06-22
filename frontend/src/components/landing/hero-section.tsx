"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { HeroBackground } from "@/components/landing/hero-background";
import { HeroDashboardMockup } from "@/components/landing/hero-dashboard-mockup";
import { TrustBadges } from "@/components/landing/trust-badges";
import { LinkButton } from "@/components/shared/link-button";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative overflow-hidden pt-[4.25rem]"
      aria-labelledby="hero-heading"
    >
      <HeroBackground />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 py-16 md:py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
          <div className="max-w-xl lg:max-w-none">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-[oklch(0.55_0.1_195/0.25)] bg-white/70 px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                AI-Powered Healthcare Platform
              </span>
            </motion.div>

            <motion.h1
              id="hero-heading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease }}
              className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]"
            >
              Clinical excellence,{" "}
              <span className="bg-gradient-to-r from-[oklch(0.35_0.12_250)] via-[oklch(0.55_0.1_195)] to-[oklch(0.52_0.11_195)] bg-clip-text text-transparent">
                orchestrated by intelligence
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease }}
              className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Virtual Hospital unifies AI-assisted triage, telemedicine consultations,
              encrypted medical records, and blockchain-verified prescriptions — one
              enterprise platform for patients, doctors, and care teams.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease }}
              className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <LinkButton
                  size="lg"
                  href="/register?role=patient"
                  className={cn(
                    "group h-12 w-full sm:w-auto px-8 text-base font-medium",
                    "bg-[oklch(0.35_0.12_250)] text-white border-0",
                    "shadow-[0_8px_24px_rgba(15,40,80,0.22)]",
                    "hover:bg-[oklch(0.32_0.12_250)] hover:shadow-[0_12px_32px_rgba(15,40,80,0.28)]"
                  )}
                >
                  Book Appointment
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </LinkButton>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <LinkButton
                  size="lg"
                  variant="outline"
                  href="/patient/ai-doctor"
                  className="h-12 w-full sm:w-auto px-8 text-base font-medium border-border/80 bg-white/60 backdrop-blur-sm hover:bg-white"
                >
                  Try AI Doctor
                </LinkButton>
              </motion.div>
            </motion.div>

            <TrustBadges className="mt-8" />

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.5 }}
              className="mt-6 text-xs text-muted-foreground"
            >
              No credit card required · Enterprise-grade security · Built for modern care delivery
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.75, delay: 0.2, ease }}
            className="relative lg:pl-4"
          >
            <HeroDashboardMockup />
          </motion.div>
        </div>
      </div>

    </section>
  );
}
