"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, getDashboardPath } from "@/store/auth-store";

interface AuthGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const router = useRouter();
  const { user, isAuthenticated, fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      const token = localStorage.getItem("access_token");
      if (!token) {
        router.replace("/login");
        return;
      }
    }
    if (user && allowedRoles && !allowedRoles.includes(user.role.toLowerCase())) {
      router.replace(getDashboardPath(user.role));
    }
  }, [user, isAuthenticated, allowedRoles, router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role.toLowerCase())) return null;

  return <>{children}</>;
}
