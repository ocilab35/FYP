"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Settings,
  Stethoscope,
  Video,
  User,
  Users,
  X,
  Shield,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/landing/brand-logo";
import { roleNavMeta, roleThemes, type DashboardRole } from "@/components/dashboard/role-themes";
import { NotificationCenter } from "@/components/shared/notification-center";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

const navItems: Record<DashboardRole, { href: string; label: string; icon: React.ElementType }[]> = {
  patient: [
    { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/patient/doctors", label: "Find Doctors", icon: Stethoscope },
    { href: "/patient/appointments", label: "Appointments", icon: Calendar },
    { href: "/patient/consultations", label: "My Consultations", icon: Video },
    { href: "/patient/ai-doctor", label: "AI Doctor", icon: Bot },
    { href: "/patient/prescriptions", label: "Prescriptions", icon: ClipboardList },
    { href: "/patient/medical-records", label: "Medical Records", icon: Activity },
    { href: "/patient/medications", label: "Medications", icon: Pill },
    { href: "/patient/profile", label: "Health Profile", icon: User },
  ],
  doctor: [
    { href: "/doctor/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
    { href: "/doctor/availability", label: "Availability", icon: Settings },
    { href: "/doctor/profile", label: "Profile", icon: User },
  ],
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/doctors", label: "Doctor Approvals", icon: Stethoscope },
    { href: "/admin/appointments", label: "Appointments", icon: Calendar },
    { href: "/admin/ai-activity", label: "AI Activity", icon: Bot },
    { href: "/admin/blockchain", label: "Blockchain", icon: Shield },
  ],
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: DashboardRole;
}

const SIDEBAR_KEY = "vhms-sidebar-collapsed";

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const theme = roleThemes[role];
  const meta = roleNavMeta[role];
  const items = navItems[role];
  const isDarkSidebar = role !== "patient";

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const initials = user
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : "U";

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("flex flex-col gap-1", mobile ? "px-3" : "px-2")} aria-label="Main navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => mobile && setMobileOpen(false)}
            title={collapsed && !mobile ? item.label : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              theme.sidebarForeground,
              theme.sidebarHover,
              collapsed && !mobile && "justify-center px-2"
            )}
            aria-current={active ? "page" : undefined}
          >
            {active && (
              <motion.span
                layoutId={mobile ? "mobile-nav-active" : "desktop-nav-active"}
                className={cn(
                  "absolute inset-0 rounded-xl",
                  role === "patient" ? "bg-[oklch(0.55_0.1_195/0.12)]" : role === "doctor" ? "bg-white/10" : "bg-[oklch(0.72_0.12_155/0.12)]"
                )}
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon className={cn("relative h-4 w-4 shrink-0", active && theme.sidebarActiveFg)} aria-hidden="true" />
            {(!collapsed || mobile) && (
              <span className={cn("relative truncate", active && theme.sidebarActiveFg)}>{item.label}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <div className={cn("flex h-16 items-center border-b px-4", theme.sidebarBorder, collapsed && !mobile && "justify-center px-2")}>
        {(!collapsed || mobile) ? (
          <div className="min-w-0 flex-1">
            {role === "patient" ? (
              <BrandLogo size="sm" showText />
            ) : (
              <div>
                <p className={cn("text-sm font-semibold truncate", theme.sidebarForeground)}>Virtual Hospital</p>
                <p className={cn("text-[10px] uppercase tracking-widest", theme.sidebarMuted)}>{meta.portalTitle}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[oklch(0.35_0.12_250)] text-white text-xs font-bold">VH</div>
        )}
        {!mobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn("hidden lg:flex shrink-0 h-8 w-8", isDarkSidebar ? "text-slate-400 hover:text-white hover:bg-white/10" : "text-slate-500")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 overscroll-contain">
        {(!collapsed || mobile) && (
          <p className={cn("mb-3 px-4 text-[10px] font-semibold uppercase tracking-widest", theme.sidebarMuted)}>
            {meta.portalSubtitle}
          </p>
        )}
        <NavLinks mobile={mobile} />
      </div>

      <div className={cn("border-t p-3", theme.sidebarBorder)}>
        <div className={cn("flex items-center gap-3 rounded-xl p-2.5", isDarkSidebar ? "bg-white/5" : "bg-slate-50")}>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={cn("text-xs font-semibold", role === "patient" ? "bg-[oklch(0.35_0.12_250)] text-white" : "bg-[oklch(0.55_0.1_195)] text-white")}>
              {initials}
            </AvatarFallback>
          </Avatar>
          {(!collapsed || mobile) && (
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", theme.sidebarForeground)}>
                {user?.first_name} {user?.last_name}
              </p>
              <p className={cn("text-xs capitalize", theme.sidebarMuted)}>{role}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={cn("flex min-h-screen", theme.pageBg)} data-dashboard-role={role}>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className={cn("hidden lg:flex flex-col border-r shrink-0 overflow-hidden", theme.sidebar, theme.sidebarBorder)}
      >
        <SidebarContent />
      </motion.aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("sticky top-0 z-40 flex h-16 items-center gap-3 border-b px-4 lg:px-6", theme.headerBg)}>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              }
            />
            <SheetContent side="left" className={cn("w-[min(100vw-2rem,280px)] p-0", theme.sidebar, theme.sidebarBorder)}>
              <div className="flex h-16 items-center justify-between border-b px-4">
                <BrandLogo size="sm" showText={role === "patient"} variant={isDarkSidebar ? "light" : "dark"} />
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <SidebarContent mobile />
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden lg:block">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{theme.label}</p>
          </div>

          <div className="flex-1" />

          <NotificationCenter apiPrefix={role === "doctor" ? "/doctors" : "/patients"} />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="User menu">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => router.push(`/${role}/profile`)}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-auto overscroll-contain">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
