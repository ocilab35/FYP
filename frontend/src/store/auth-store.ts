import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, User } from "@/lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  fetchUser: () => Promise<User | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post("/auth/login", { email, password });
          const tokens = data.data;
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
          const meRes = await api.get("/auth/me");
          const user = meRes.data.data as User;
          set({ user, isAuthenticated: true, isLoading: false });
          return user;
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        set({ user: null, isAuthenticated: false });
      },

      fetchUser: async () => {
        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        if (!token) {
          set({ user: null, isAuthenticated: false });
          return null;
        }
        try {
          const { data } = await api.get("/auth/me");
          const user = data.data as User;
          set({ user, isAuthenticated: true });
          return user;
        } catch {
          set({ user: null, isAuthenticated: false });
          return null;
        }
      },
    }),
    {
      name: "vhms-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export function getDashboardPath(role: string): string {
  switch (role.toLowerCase()) {
    case "patient": return "/patient/dashboard";
    case "doctor": return "/doctor/dashboard";
    case "admin": return "/admin/dashboard";
    default: return "/";
  }
}
