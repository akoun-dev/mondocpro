"use client";

// Vue « Mes rendez-vous » — espace patient (maquette PO 2026-10 : entrée
// « Consulter »). Deux sections : À venir (actifs, croissant) et Historique
// (terminés/annulés, décroissant). Détail + annulation via le dialog partagé.
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarX2,
  ChevronRight,
  Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { PatientData } from "@/hooks/use-patient-data";
import type { AppointmentDto } from "@/lib/appointments";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { relativeSlotLabel } from "@/lib/datetime";
import {
  APPOINTMENT_TYPE_LABELS,
  AppointmentStatusBadge,
} from "./shared";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";

type Props = {
  data: PatientData;
  onBack: () => void;
};

const NOW_MARGIN_MS = 60_000;

export function AppointmentsView({ data, onBack }: Props) {
  const [detail, setDetail] = useState<AppointmentDto | null>(null);

  const { upcoming, history } = useMemo(() => {
    const now = Date.now();
    const list = data.appointments ?? [];
    const active = list.filter(
      appointment =>
        (appointment.status === "PENDING" ||
          appointment.status === "CONFIRMED") &&
        new Date(appointment.scheduledAt).getTime() >= now - NOW_MARGIN_MS,
    );
    active.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    const past = list.filter(appointment => !active.includes(appointment));
    past.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return { upcoming: active, history: past };
  }, [data.appointments]);

  const renderRow = (appointment: AppointmentDto) => (
    <li key={appointment.id}>
      <button
        type="button"
        onClick={() => setDetail(appointment)}
        className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {appointment.type === "CABINET" ? (
            <Building2 className="size-4.5" aria-hidden="true" />
          ) : (
            <Home className="size-4.5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold" suppressHydrationWarning>
            {relativeSlotLabel(appointment.scheduledAt)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {APPOINTMENT_TYPE_LABELS[appointment.type]} ·{" "}
            {ZONE_LABELS[appointment.zone]}
          </span>
        </span>
        <AppointmentStatusBadge status={appointment.status} />
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </li>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Retour à l'accueil"
          className="size-9 rounded-full"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Button>
        <h2 className="text-lg font-bold tracking-tight">Mes rendez-vous</h2>
      </div>

      {data.loading && data.appointments === null ? (
        <ul className="grid gap-3" aria-busy="true" aria-label="Chargement des rendez-vous">
          {[0, 1, 2].map(index => (
            <li key={index}>
              <Skeleton className="h-[72px] rounded-xl" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : data.error && data.appointments === null ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-medium">{data.error}</p>
          <Button
            variant="outline"
            onClick={() => void data.refresh()}
            className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
          >
            Réessayer
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Rendez-vous à venir" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              À venir{" "}
              {upcoming.length > 0 && (
                <span className="text-primary">({upcoming.length})</span>
              )}
            </h3>
            {upcoming.length > 0 ? (
              <ul className="grid gap-3">{upcoming.map(renderRow)}</ul>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                Aucun rendez-vous à venir — prenez-en un depuis l'accueil.
              </p>
            )}
          </section>

          <section aria-label="Historique des rendez-vous" className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Historique{" "}
              {history.length > 0 && (
                <span className="text-primary">({history.length})</span>
              )}
            </h3>
            {history.length > 0 ? (
              <ul className="grid gap-3">{history.map(renderRow)}</ul>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                Vos consultations passées apparaîtront ici.
              </p>
            )}
          </section>

          {upcoming.length === 0 && history.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-8 text-center shadow-sm">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CalendarX2 className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold">Aucun rendez-vous</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Les nouveaux rendez-vous apparaîtront ici.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      <AppointmentDetailDialog
        appointment={detail}
        onClose={() => setDetail(null)}
        onCancelled={() => void data.refresh()}
      />
    </div>
  );
}
