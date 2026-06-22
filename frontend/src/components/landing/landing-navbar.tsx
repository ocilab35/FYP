"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { BrandLogo } from "@/components/landing/brand-logo";
import { LinkButton } from "@/components/shared/link-button";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", href: "#top" },
  { label: "Doctors", href: "/register?role=doctor" },
  { label: "Appointments", href: "/register?role=patient" },
  { label: "AI Doctor", href: "/patient/ai-doctor" },
  { label: "Features", href: "#features" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
] as const;

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("Home");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 24);
  });

  useEffect(() => {
    const sections = NAV_ITEMS.filter((i) => i.href.startsWith("#")).map((i) => ({
      id: i.href.slice(1),
      label: i.label,
    }));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          const match = sections.find((s) => s.id === visible[0].target.id);
          if (match) setActive(match.label);
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const NavLink = ({ item, mobile = false }: { item: (typeof NAV_ITEMS)[number]; mobile?: boolean }) => {
    const isHash = item.href.startsWith("#");
    const isActive = active === item.label && isHash;
    const className = cn(
      "relative text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 py-0.5",
      mobile ? "block py-3 text-base" : "",
      isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
    );

    const content = (
      <>
        {item.label}
        {isActive && !mobile && (
          <motion.span
            layoutId="nav-indicator"
            className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </>
    );

    if (isHash) {
      return (
        <a href={item.href} className={className} onClick={() => mobile && setMobileOpen(false)}>
          {content}
        </a>
      );
    }
    return (
      <Link href={item.href} className={className} onClick={() => mobile && setMobileOpen(false)}>
        {item.label}
      </Link>
    );
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-white/40 bg-white/70 shadow-[0_8px_32px_rgba(15,40,80,0.06)] backdrop-blur-xl backdrop-saturate-150"
          : "border-b border-transparent bg-white/40 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandLogo size="md" />

        <nav className="hidden lg:flex items-center gap-7" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.label} item={item} />
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2.5">
          <LinkButton variant="ghost" href="/login" className="text-sm font-medium">
            Login
          </LinkButton>
          <LinkButton
            href="/register"
            className="relative overflow-hidden bg-[oklch(0.35_0.12_250)] text-white shadow-[0_4px_14px_rgba(15,40,80,0.25)] hover:bg-[oklch(0.32_0.12_250)] border-0"
          >
            Get Started
          </LinkButton>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            }
          />
          <SheetContent side="right" className="w-[min(100vw-2rem,320px)] pt-10">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.label} item={item} mobile />
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3 border-t pt-6">
              <LinkButton variant="outline" href="/login" className="w-full">
                Login
              </LinkButton>
              <LinkButton href="/register" className="w-full bg-primary text-primary-foreground border-0">
                Get Started
              </LinkButton>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
