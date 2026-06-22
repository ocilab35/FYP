"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import {
  Activity,
  Bot,
  Calendar,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Video,
} from "lucide-react";
import { useRef } from "react";

function FloatingCard({
  children,
  className,
  delay = 0,
  floatY = 8,
  reduceMotion = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  floatY?: number;
  reduceMotion?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {reduceMotion ? (
        children
      ) : (
        <motion.div
          animate={{ y: [0, -floatY, 0] }}
          transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}

export function HeroDashboardMockup() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]), { stiffness: 120, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]), { stiffness: 120, damping: 20 });

  const onMove = (e: React.MouseEvent) => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div
      ref={ref}
      className="relative mx-auto w-full max-w-[540px] lg:max-w-none perspective-[1200px]"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative rounded-2xl border border-white/60 bg-white/80 p-1 shadow-[0_32px_80px_-20px_rgba(15,40,80,0.22)] backdrop-blur-xl"
      >
        <div className="rounded-[calc(1rem-2px)] border border-border/50 bg-gradient-to-b from-white to-[oklch(0.98_0.005_240)] p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Patient Dashboard
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                Next Appointment
              </div>
              <p className="mt-2 text-sm font-semibold text-foreground">Dr. Sarah Ahmed</p>
              <p className="text-xs text-muted-foreground">Cardiology · Today, 9:00 AM</p>
              <motion.div
                className="mt-3 inline-flex items-center gap-1 rounded-full bg-[oklch(0.72_0.12_155/0.15)] px-2 py-0.5 text-[10px] font-medium text-[oklch(0.35_0.08_155)]"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.2 }}
              >
                <Video className="h-3 w-3" />
                Telemedicine ready
              </motion.div>
            </div>

            <div className="rounded-xl border border-border/60 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                Health Overview
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { label: "Vitals", value: 92 },
                  { label: "Recovery", value: 78 },
                ].map((bar) => (
                  <div key={bar.label}>
                    <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                      <span>{bar.label}</span>
                      <span>{bar.value}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[oklch(0.35_0.12_250)] to-[oklch(0.55_0.1_195)]"
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.value}%` }}
                        transition={{ duration: 1.2, delay: 0.8 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <motion.div
            className="mt-3 rounded-xl border border-[oklch(0.55_0.1_195/0.2)] bg-[oklch(0.55_0.1_195/0.06)] p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.35_0.12_250)] text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">AI Doctor — Symptom Analysis</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Preliminary assessment complete</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                  <motion.div
                    className="h-full rounded-full bg-[oklch(0.72_0.12_155)]"
                    initial={{ width: 0 }}
                    animate={{ width: "84%" }}
                    transition={{ duration: 1.4, delay: 1 }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">84% confidence · Cardiology suggested</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <FloatingCard
        className="absolute -left-2 top-8 z-10 sm:-left-8 lg:-left-12"
        delay={0.35}
        floatY={6}
        reduceMotion={!!reduceMotion}
      >
        <div className="flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <ShieldCheck className="h-4 w-4 text-[oklch(0.72_0.12_155)]" />
          <div>
            <p className="text-[11px] font-semibold text-foreground">Blockchain Verified</p>
            <p className="text-[10px] text-muted-foreground">MRI Report · SHA-256</p>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard
        className="absolute -right-1 bottom-16 z-10 sm:-right-6 lg:-right-10"
        delay={0.55}
        floatY={10}
        reduceMotion={!!reduceMotion}
      >
        <div className="rounded-xl border border-white/70 bg-white/90 px-3.5 py-2.5 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold">Live vitals synced</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-[oklch(0.72_0.12_155)]">
            <CheckCircle2 className="h-3 w-3" />
            Secure & encrypted
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="absolute right-4 -top-4 z-10 sm:right-8" delay={0.75} floatY={5} reduceMotion={!!reduceMotion}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[oklch(0.35_0.12_250)] text-white shadow-lg">
          <Sparkles className="h-4 w-4" />
        </div>
      </FloatingCard>
    </div>
  );
}
