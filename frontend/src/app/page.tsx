"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Calendar,
  Link2,
  Shield,
  Stethoscope,
  Users,
} from "lucide-react";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { BrandLogo } from "@/components/landing/brand-logo";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/shared/page-transition";
import { LinkButton } from "@/components/shared/link-button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Stethoscope,
    title: "Expert Consultations",
    description: "Connect with verified specialists for virtual and in-person appointments.",
  },
  {
    icon: Bot,
    title: "AI Doctor Assistant",
    description: "Preliminary symptom analysis, risk assessment, and specialist recommendations.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Book, track, and manage appointments with real-time availability.",
  },
  {
    icon: Shield,
    title: "Secure Health Records",
    description: "Encrypted medical history, prescriptions, and blockchain-verified documents.",
  },
  {
    icon: Link2,
    title: "Blockchain Verification",
    description: "Tamper-evident hashes anchor records and prescriptions on-chain.",
  },
];

const stats = [
  { value: "500+", label: "Verified Doctors" },
  { value: "50K+", label: "Patients Served" },
  { value: "98%", label: "Satisfaction Rate" },
  { value: "24/7", label: "AI Support" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <HeroSection />

      {/* Stats */}
      <section className="border-y bg-white/80 py-12 backdrop-blur-sm">
        <StaggerContainer className="mx-auto max-w-7xl px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <StaggerItem key={stat.label} className="text-center">
              <motion.p
                className="text-3xl md:text-4xl font-bold text-primary"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                {stat.value}
              </motion.p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </section>

      {/* Features */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need for modern healthcare
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              A complete ecosystem designed for patients, doctors, clinics, and healthcare organizations.
            </p>
          </FadeIn>
          <StaggerContainer className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <Card className="h-full border border-border/60 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 group bg-white/80">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-[oklch(0.35_0.12_250)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md">
                      <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section id="about" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[oklch(0.35_0.12_250)] p-8 md:p-16 text-center text-white relative overflow-hidden shadow-[0_24px_64px_rgba(15,40,80,0.25)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_120%,oklch(0.55_0.1_195/0.35),transparent)]" />
            <FadeIn className="relative">
              <Users className="h-12 w-12 mx-auto mb-6 opacity-80" aria-hidden="true" />
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Virtual Hospital Today</h2>
              <p className="text-white/80 max-w-xl mx-auto mb-8 text-lg">
                Whether you&apos;re a patient seeking care, a doctor expanding your practice,
                or a healthcare organization — Virtual Hospital has you covered.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <LinkButton size="lg" variant="secondary" href="/register?role=patient" className="h-12 px-8">
                  Register as Patient
                </LinkButton>
                <LinkButton size="lg" variant="outline" href="/register?role=doctor" className="h-12 px-8 bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Register as Doctor
                </LinkButton>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="border-t py-10 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <BrandLogo />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Contact</p>
              <p>support@virtualhospital.com</p>
              <p>+1 (800) 555-0199</p>
            </div>
          </div>
          <p className="mt-8 text-sm text-muted-foreground text-center md:text-left">
            &copy; {new Date().getFullYear()} Virtual Hospital. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
