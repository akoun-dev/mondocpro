"use client";

// Éléments partagés de l'espace patient — libellés et badges de statut RDV.
import { Badge } from "@/components/ui/badge";
import type { AppointmentStatusValue, AppointmentTypeValue } from "@/lib/appointment-schemas";

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatusValue, string> =
  {
    PENDING: "En attente",
    CONFIRMED: "Confirmé",
    CANCELLED: "Annulé",
    DONE: "Terminé",
  };

// Contrainte a11y (ADR-002) : jamais de texte blanc sur success/warning —
// les foregrounds foncés des tokens sont utilisés tels quels.
export const APPOINTMENT_STATUS_BADGE: Record<AppointmentStatusValue, string> =
  {
    PENDING: "bg-warning text-warning-foreground",
    CONFIRMED: "bg-success text-success-foreground",
    CANCELLED: "bg-muted text-muted-foreground",
    DONE: "bg-primary/10 text-primary",
  };

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatusValue;
  className?: string;
}) {
  return (
    <Badge
      className={`${APPOINTMENT_STATUS_BADGE[status]} ${className ?? ""}`}
      aria-label={`Statut : ${APPOINTMENT_STATUS_LABELS[status]}`}
    >
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentTypeValue, string> = {
  CABINET: "Consultation au cabinet",
  DOMICILE: "Consultation à domicile",
};
