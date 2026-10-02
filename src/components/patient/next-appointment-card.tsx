"use client";

// Carte « Prochain rendez-vous » — maquette PO 2026-10 : carte dégradé médical
// (ADR-002), statut en pastille, créneau relatif, lieu, référence courte et
// accès au détail. État vide : invitation à prendre rendez-vous.
import { motion } from "framer-motion";
import {
  Building2,
  CalendarDays,
  CalendarX2,
  ChevronRight,
  Clock,
  Home,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentDto } from "@/lib/appointments";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { appointmentRef, relativeSlotLabel } from "@/lib/datetime";
import { APPOINTMENT_TYPE_LABELS, AppointmentStatusBadge } from "./shared";

type Props = {
  appointments: AppointmentDto[] | null;
  loading: boolean;
  onOpenDetail: (appointment: AppointmentDto) => void;
  onBook: () => void;
};

// Prochain RDV actif : PENDING/CONFIRMED à venir (marge 1 min pour les RDV
// commençant à l'instant), tri croissant sur le créneau.
function pickNext(
  list: AppointmentDto[],
  now: Date,
): AppointmentDto | null {
  return (
    list
      .filter(
        (appointment) =>
          (appointment.status === "PENDING" ||
            appointment.status === "CONFIRMED") &&
          new Date(appointment.scheduledAt).getTime() >=
            now.getTime() - 60_000,
      )
      .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null
  );
}

export function NextAppointmentCard({
  appointments,
  loading,
  onOpenDetail,
  onBook,
}: Props) {
  if (loading && appointments === null) {
    return <Skeleton className="h-[248px] rounded-2xl" aria-hidden="true" />;
  }

  const next = appointments ? pickNext(appointments, new Date()) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      aria-label="Prochain rendez-vous"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-primary-foreground shadow-lg shadow-primary/20 sm:p-6"
    >
      {/* Halo décoratif — motif verre dépoli de la charte (DESIGN_SYSTEM §2) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-14 -top-14 size-40 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-16 -left-8 size-44 rounded-full bg-white/[0.07] blur-xl" />
      </div>

      {next ? (
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80">
              <CalendarDays className="size-3.5" aria-hidden="true" />
              Prochain rendez-vous
            </p>
            <AppointmentStatusBadge status={next.status} />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Stethoscope className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">
                {APPOINTMENT_TYPE_LABELS[next.type]}
              </p>
              <p className="text-sm text-white/80">Médecine générale</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/90">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4" aria-hidden="true" />
              {relativeSlotLabel(next.scheduledAt)}
            </span>
            <span className="flex items-center gap-1.5">
              {next.type === "CABINET" ? (
                <Building2 className="size-4" aria-hidden="true" />
              ) : (
                <Home className="size-4" aria-hidden="true" />
              )}
              {next.type === "CABINET"
                ? `Cabinet ${ZONE_LABELS[next.zone]}`
                : `Domicile · ${ZONE_LABELS[next.zone]}`}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/20 pt-3.5">
            <p className="text-xs text-white/70">
              Réf : {appointmentRef(next.id)}
            </p>
            <Button
              size="sm"
              onClick={() => onOpenDetail(next)}
              className="h-9 gap-1 rounded-lg bg-white px-3.5 text-xs font-semibold text-primary hover:bg-white/90 focus-visible:ring-white"
            >
              Voir le détail
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <CalendarX2 className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-bold">Aucun rendez-vous à venir</p>
            <p className="mt-1 text-sm text-white/80">
              Consultation au cabinet ou à domicile, du lundi au vendredi.
            </p>
          </div>
          <Button
            size="sm"
            onClick={onBook}
            className="h-10 gap-1.5 rounded-xl bg-white px-4 text-sm font-semibold text-primary hover:bg-white/90 focus-visible:ring-white"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Prendre rendez-vous
          </Button>
        </div>
      )}
    </motion.section>
  );
}
