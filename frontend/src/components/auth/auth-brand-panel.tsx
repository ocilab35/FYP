"use client";

import { motion } from "framer-motion";
import { Bot, Calendar, ShieldCheck, Stethoscope, TrendingUp } from "lucide-react";
import { AuthTrustBadges } from "@/components/auth/auth-trust-badges";
import { BrandLogo } from "@/components/landing/brand-logo";

const STATS = [
  { value: "50K+", label: "Patients served" },
  { value: "500+", label: "Verified doctors" },
  { value: "99.9%", label: "Platform uptime" },
];

const FEATURES = [
  { icon: Bot, text: "AI-assisted triage & symptom analysis" },
  { icon: Calendar, text: "Seamless online appointment booking" },
  { icon: ShieldCheck, text: "Blockchain-verified medical records" },
  { icon: Stethoscope, text: "Secure telemedicine consultations" },
];

function FloatingStat({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

interface AuthBrandPanelProps {
  headline?: string;
  subheadline?: string;
}

export function AuthBrandPanel({
  headline = "Your complete digital healthcare ecosystem",
  subheadline = "Secure access to AI-powered care, verified records, and enterprise-grade telemedicine — built for modern healthcare teams.",
}: AuthBrandPanelProps) {
  return (
    <div className="relative hidden overflow-hidden bg-[oklch(0.28_0.1_250)] lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,oklch(0.55_0.1_195/0.35),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_100%,oklch(0.72_0.12_155/0.15),transparent_55%)]" />
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 p-10 xl:p-14">
        <BrandLogo variant="light" size="lg" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.65 }}
          className="mt-14 max-w-lg"
        >
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white xl:text-4xl">
            {headline}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70 xl:text-lg">{subheadline}</p>
        </motion.div>

        <motion.ul
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.35 } } }}
          className="mt-10 space-y-3"
        >
          {FEATURES.map(({ icon: Icon, text }) => (
            <motion.li
              key={text}
              variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
              className="flex items-center gap-3 text-sm text-white/85"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {text}
            </motion.li>
          ))}
        </motion.ul>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-10"
        >
          <AuthTrustBadges />
        </motion.div>
      </div>

      {/* Visual cluster */}
      <div className="relative z-10 flex-1 px-10 pb-10 xl:px-14 xl:pb-14">
        <div className="relative mx-auto h-full max-w-md">
          <FloatingStat className="absolute left-0 top-4 z-20" delay={0.5}>
            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-md">
              <div className="flex items-center gap-2 text-white">
                <TrendingUp className="h-4 w-4 text-[oklch(0.72_0.12_155)]" />
                <span className="text-xs font-semibold">Health analytics</span>
              </div>
              <p className="mt-1 text-[10px] text-white/60">Real-time vitals dashboard</p>
            </div>
          </FloatingStat>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.7 }}
            className="absolute inset-x-4 top-16 rounded-2xl border border-white/25 bg-white/10 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-white/50">
                Care overview
              </span>
              <span className="rounded-full bg-[oklch(0.72_0.12_155/0.2)] px-2 py-0.5 text-[10px] font-medium text-[oklch(0.85_0.08_155)]">
                Active
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {STATS.map((stat, i) => (
                <div key={stat.label} className="rounded-lg bg-white/5 p-3 text-center">
                  <motion.p
                    className="text-lg font-bold text-white"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="mt-0.5 text-[9px] leading-tight text-white/50">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-white/80" />
                <span className="text-xs font-medium text-white/90">AI Doctor session ready</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[oklch(0.55_0.1_195)]"
                  initial={{ width: 0 }}
                  animate={{ width: "76%" }}
                  transition={{ delay: 1, duration: 1.2 }}
                />
              </div>
            </div>
          </motion.div>

          <FloatingStat className="absolute bottom-8 right-0 z-20" delay={0.65}>
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 backdrop-blur-md">
              <ShieldCheck className="h-4 w-4 text-[oklch(0.72_0.12_155)]" />
              <div>
                <p className="text-[11px] font-semibold text-white">Record verified</p>
                <p className="text-[10px] text-white/50">On-chain hash anchored</p>
              </div>
            </div>
          </FloatingStat>
        </div>
      </div>
    </div>
  );
}
