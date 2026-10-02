"use client";

// Données de l'espace patient (FEATURE-RDV + FEATURE-SENSO) — fetch client vers
// les API contractées. Une seule instance est montée dans UserDashboard :
// le header (notifications, actualiser), l'accueil et la vue RDV partagent
// le même état (une annulation faite dans la vue RDV rafraîchit l'accueil).
import { useCallback, useEffect, useRef, useState } from "react";
import type { AppointmentDto } from "@/lib/appointments";
import type { SensibilisationDto } from "@/lib/sensibilisations";

export type PatientData = {
  appointments: AppointmentDto[] | null;
  sensibilisations: SensibilisationDto[] | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LOAD_ERROR =
  "Impossible de charger vos données — vérifiez votre connexion puis réessayez.";

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
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

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
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : LOAD_ERROR);
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

  const refresh = useCallback(() => load("refresh"), [load]);

  return {
    appointments,
    sensibilisations,
    loading,
    refreshing,
    error,
    refresh,
  };
}
