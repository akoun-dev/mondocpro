// État global d'authentification — FEATURE-AUTH (ADR-004 §6)
// L'auth est un état d'app global (zustand), pas du server-state cacheable.
import { create } from "zustand";

export type AppRole = "PATIENT" | "NURSE" | "ADMIN";
export type AppZone = "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE";

export type AppUser = {
  id: string;
  fullName: string;
  phone: string;
  role: AppRole;
  zone: AppZone;
  // FEATURE-PROFIL (Task 22) : naissance + préférences notifications —
  // birthDate en ISO string (minuit UTC) ou null (« Non renseignée »).
  birthDate: string | null;
  appointmentReminders: boolean;
  healthAlerts: boolean;
  createdAt: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: AppUser | null;
  status: AuthStatus;
  setStatus: (status: AuthStatus) => void;
  setUser: (user: AppUser) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  setStatus: (status) => set({ status }),
  setUser: (user) => set({ user }),
  clear: () => set({ user: null, status: "unauthenticated" }),
}));
