"use client";

// Données de l'espace patient (FEATURE-RDV + FEATURE-SENSO) — fetch client vers
// les API contractées. Une seule instance est montée dans UserDashboard :
// le header (notifications, actualiser), l'accueil et la vue RDV partagent
// le même état (une annulation faite dans la vue RDV rafraîchit l'accueil).
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppointmentDto } from "@/lib/appointments";
import type { SensibilisationDto } from "@/lib/sensibilisations";
import type { WalletDto } from "@/lib/tokens";

export type PatientData = {
  appointments: AppointmentDto[] | null;
  sensibilisations: SensibilisationDto[] | null;
  wallet: WalletDto | null;
  walletLoading: boolean;
  walletError: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** Vrai lorsqu'un rafraîchissement a échoué après un chargement réussi. */
  stale: boolean;
  refresh: () => Promise<void>;
};

const LOAD_ERROR =
  "Impossible de charger vos données — vérifiez votre connexion puis réessayez.";

// Attente courte entre deux tentatives (relance unique des fetchs wallet —
// Task 48 : les 500 pooler sont transitoires, une seule relance suffit à
// masquer les micro-coupures réseau et les micro-déploiements).
const RETRY_DELAY_MS = 700;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    // 401 = session expirée côté serveur ; l'état d'erreur s'affiche dans les
    // cartes, la déconnexion effective reste portée par /api/auth/me.
    throw new Error(
      res.status === 401
        ? "Session expirée — reconnectez-vous"
        : LOAD_ERROR,
    );
  }
  return (await res.json()) as T;
}

export function usePatientData(enabled: boolean): PatientData {
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(
    null,
  );
  const [sensibilisations, setSensibilisations] = useState<
    SensibilisationDto[] | null
  >(null);
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [walletLoading, setWalletLoading] = useState(enabled);
  const [walletError, setWalletError] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const mounted = useRef(true);

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      let result: WalletDto;
      try {
        result = await fetchJson<WalletDto>("/api/wallet");
      } catch {
        // Relance unique — un échec isolé (réseau mobile, redéploiement)
        // ne doit pas afficher « Solde indisponible ».
        await delay(RETRY_DELAY_MS);
        result = await fetchJson<WalletDto>("/api/wallet");
      }
      if (!mounted.current) return;
      setWallet(result);
      setWalletError(false);
    } catch {
      if (!mounted.current) return;
      setWalletError(true);
    } finally {
      if (mounted.current) setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "refresh") {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [appointmentsRes, sensibilisationsRes] = await Promise.all([
        fetchJson<{ appointments: AppointmentDto[] }>("/api/appointments"),
        fetchJson<{ sensibilisations: SensibilisationDto[] }>(
          "/api/sensibilisations",
        ),
      ]);
      if (!mounted.current) return;
      setAppointments(appointmentsRes.appointments);
      setSensibilisations(sensibilisationsRes.sensibilisations);
      setStale(false);
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : LOAD_ERROR);
      setStale(mode === "refresh");
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (enabled) void load("initial");
  }, [enabled, load]);

  useEffect(() => {
    if (enabled) void loadWallet();
  }, [enabled, loadWallet]);

  const refresh = useCallback(async () => {
    await Promise.all([load("refresh"), loadWallet()]);
  }, [load, loadWallet]);

  return {
    appointments,
    sensibilisations,
    wallet,
    walletLoading,
    walletError,
    loading,
    refreshing,
    error,
    stale,
    refresh,
  };
}
