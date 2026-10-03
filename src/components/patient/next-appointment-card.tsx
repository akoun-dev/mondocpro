"use client";

// Carte héros « État consultations » — maquette PO 2026-10 v2 : dégradé
// médical (ADR-002), pastilles d'état, invitation à réserver et accès direct
// à la recharge de Tokens (FEATURE-TOKENS, wallet réel du profil).
import { motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarX2,
  Clock,
  Home,
  Stethoscope,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentDto } from "@/lib/appointments";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { relativeSlotLabel } from "@/lib/datetime";
import { APPOINTMENT_TYPE_LABELS, AppointmentStatusBadge } from "./shared";

type Props = {
  appointments: AppointmentDto[] | null;
  loading: boolean;
  onOpenDetail: (appointment: AppointmentDto) => void;
  onBook: () => void;
  onRecharge: () => void;
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
  onRecharge,
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
      aria-label="État des consultations"
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-primary-foreground shadow-lg shadow-primary/20 sm:p-6"
    >
      {/* Halo décoratif — motif verre dépoli de la charte (DESIGN_SYSTEM §2) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-14 -top-14 size-40 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-16 -left-8 size-44 rounded-full bg-white/[0.07] blur-xl" />
      </div>

      <div className="relative">
        {/* Pastilles d'état — maquette : « État consultations » + statut */}
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            État consultations
          </span>
          {next ? (
            <AppointmentStatusBadge status={next.status} />
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full bg-primary-dark/60 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/20">
              Dispo immédiate
            </span>
          )}
        </div>

        {next ? (
          <div className="mt-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Stethoscope className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold leading-tight">
                  {APPOINTMENT_TYPE_LABELS[next.type]}
                </p>
                <p className="text-sm text-white/80">
                  {next.specialty?.name ?? "Médecine générale"}
                </p>
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
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-xl font-bold leading-tight">
              Aucun rendez-vous à venir
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/80">
              Consultation au cabinet ou à domicile à Yopougon &amp; Songon, du
              lundi au vendredi.
            </p>
          </div>
        )}

        {/* Actions — maquette : bouton blanc principal + verre « Recharger » */}
        <div className="mt-5 flex items-stretch gap-2">
          <Button
            onClick={next ? () => onOpenDetail(next) : onBook}
            className="h-11 min-w-0 flex-1 justify-between gap-1.5 rounded-xl bg-white px-3 text-[13px] font-semibold text-primary shadow-sm hover:bg-white/90 focus-visible:ring-white sm:text-sm"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {next ? (
                <Stethoscope className="size-4 shrink-0" aria-hidden="true" />
              ) : (
                <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {next ? "Voir le détail" : "Prendre rendez-vous"}
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Button>
          <Button
            onClick={onRecharge}
            className="h-11 shrink-0 gap-1.5 rounded-xl bg-white/15 px-3 text-[13px] font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25 focus-visible:ring-white sm:text-sm"
          >
            <Wallet className="size-4" aria-hidden="true" />
            Recharger
          </Button>
        </div>
      </div>
    </motion.section>
  );
}
