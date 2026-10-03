"use client";

// Hook d'authentification — FEATURE-AUTH (ADR-004 §6)
// État global zustand + appels fetch vers /api/auth/*. Pas de react-query ici.
import { useCallback, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import {
  useAuthStore,
  type AppRole,
  type AppUser,
  type AppZone,
} from "@/stores/auth-store";

export type RegisterPayload = {
  fullName: string;
  phone: string;
  password: string;
  confirmPassword: string;
  zone: AppZone;
};

export type AuthResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type ResetPasswordPayload = {
  phone: string;
  code: string;
  password: string;
  confirmPassword: string;
};

type ApiErrorBody = {
  error?: string;
  details?: Array<{ field: string; message: string }>;
};

// Mappe les erreurs zod de l'API ({ details: [{field, message}] }) vers
// un dictionnaire utilisable par les formulaires.
function toFieldErrors(details: ApiErrorBody["details"]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const detail of details ?? []) {
    if (detail?.field && detail?.message && !(detail.field in fieldErrors)) {
      fieldErrors[detail.field] = detail.message;
    }
  }
  return fieldErrors;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function readError(res: Response): Promise<AuthResult> {
  let body: ApiErrorBody = {};
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Réponse non JSON (ex. page d'erreur) — on garde un message générique.
  }
  const error = body.error ?? "Une erreur est survenue — réessayez";
  const fieldErrors = toFieldErrors(body.details);
  return fieldErrors && Object.keys(fieldErrors).length > 0
    ? { ok: false, error, fieldErrors }
    : { ok: false, error };
}

const NETWORK_ERROR =
  "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.";

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);

  // Vérification de session au premier montage (une seule fois : seuls les
  // composants affichés pendant "loading" déclenchent l'appel — la page rend
  // un spinner tant que le statut est "loading").
  useEffect(() => {
    if (status !== "loading") return;

    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!active) return;
        if (res.ok) {
          const data = (await res.json()) as { user?: AppUser };
          if (!active) return;
          if (data.user) {
            setUser(data.user);
            setStatus("authenticated");
            return;
          }
        }
        clear();
      } catch {
        if (!active) return;
        toast({
          variant: "destructive",
          title: "Connexion impossible",
          description: NETWORK_ERROR,
        });
        clear();
      }
    })();

    return () => {
      active = false;
    };
  }, [status, setStatus, setUser, clear]);

  const login = useCallback(
    async (phone: string, password: string, remember = true): Promise<AuthResult> => {
      try {
        const res = await postJson("/api/auth/login", { phone, password, rememberMe: remember });
        if (res.ok) {
          const data = (await res.json()) as { user: AppUser };
          setUser(data.user);
          setStatus("authenticated");
          return { ok: true };
        }
        return await readError(res);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [setUser, setStatus],
  );

  const register = useCallback(
    async (data: RegisterPayload): Promise<AuthResult> => {
      try {
        // Rôle PATIENT imposé : l'inscription publique ne crée que des patients
        // (NURSE/ADMIN = administration). Le serveur le reforce de toute façon.
        const res = await postJson("/api/auth/register", { ...data, role: "PATIENT" as const });
        if (res.ok) {
          const body = (await res.json()) as { user: AppUser };
          setUser(body.user);
          setStatus("authenticated");
          return { ok: true };
        }
        return await readError(res);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [setUser, setStatus],
  );

  const forgotPassword = useCallback(
    async (phone: string): Promise<AuthResult> => {
      try {
        const res = await postJson("/api/auth/forgot-password", { phone });
        if (res.ok) {
          const body = (await res.json()) as { message?: string };
          return { ok: true, message: body.message };
        }
        return await readError(res);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [],
  );

  const resetPassword = useCallback(
    async (data: ResetPasswordPayload): Promise<AuthResult> => {
      try {
        const res = await postJson("/api/auth/reset-password", data);
        if (res.ok) {
          return { ok: true };
        }
        return await readError(res);
      } catch {
        return { ok: false, error: NETWORK_ERROR };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await postJson("/api/auth/logout", {});
    } catch {
      // Déconnexion locale garantie même en cas d'erreur réseau.
      toast({
        variant: "destructive",
        title: "Déconnexion locale",
        description:
          "Le serveur n'a pas pu être joint : la session locale est fermée.",
      });
    } finally {
      clear();
    }
  }, [clear]);

  return { user, status, login, register, logout, forgotPassword, resetPassword };
}
