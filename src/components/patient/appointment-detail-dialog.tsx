"use client";

// Détail d'un rendez-vous — dialog (maquette PO 2026-10 : « Voir le détail »).
// Toutes les informations contractées + annulation (PATCH action=CANCEL)
// avec confirmation explicite ; erreurs 404/409 restituées en toast.
import { useState } from "react";
import {
  Building2,
  CalendarClock,
  FileText,
  Fingerprint,
  Hash,
  Home,
  MapPin,
  UserRound,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { AppointmentDto } from "@/lib/appointments";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import {
  appointmentRef,
  formatDateUTC,
  formatFullSlotUTC,
} from "@/lib/datetime";
import {
  APPOINTMENT_TYPE_LABELS,
  AppointmentStatusBadge,
} from "./shared";

type Props = {
  appointment: AppointmentDto | null;
  onClose: () => void;
  // Appelé après une annulation réussie → rafraîchissement des listes.
  onCancelled?: (appointment: AppointmentDto) => void;
};

export function AppointmentDetailDialog({
  appointment,
  onClose,
  onCancelled,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isActive =
    appointment?.status === "PENDING" || appointment?.status === "CONFIRMED";

  async function handleCancel() {
    if (!appointment) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      if (res.ok) {
        const body = (await res.json()) as { appointment: AppointmentDto };
        toast({
          title: "Rendez-vous annulé",
          description: `Le créneau du ${formatFullSlotUTC(body.appointment.scheduledAt)} est libéré.`,
        });
        onCancelled?.(body.appointment);
        onClose();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        variant: "destructive",
        title: "Annulation impossible",
        description:
          body.error ?? "Une erreur est survenue — réessayez",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Annulation impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  }

  const rows: { icon: typeof MapPin; label: string; value: string }[] | null =
    appointment
      ? [
          {
            icon: appointment.type === "CABINET" ? Building2 : Home,
            label: "Type",
            value: APPOINTMENT_TYPE_LABELS[appointment.type],
          },
          {
            icon: MapPin,
            label: "Zone",
            value: ZONE_LABELS[appointment.zone],
          },
          {
            icon: CalendarClock,
            label: "Créneau",
            value: formatFullSlotUTC(appointment.scheduledAt),
          },
          {
            icon: FileText,
            label: "Motif",
            value: appointment.reason || "Non précisé",
          },
          {
            icon: Hash,
            label: "Référence",
            value: appointmentRef(appointment.id),
          },
          {
            icon: UserRound,
            label: "Demandé le",
            value: formatDateUTC(appointment.createdAt),
          },
        ]
      : null;

  return (
    <Dialog
      open={appointment !== null}
      onOpenChange={open => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        {appointment && rows && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center justify-between gap-2 text-left">
                Rendez-vous
                <AppointmentStatusBadge status={appointment.status} />
              </DialogTitle>
              <DialogDescription className="text-left">
                {APPOINTMENT_TYPE_LABELS[appointment.type]}
                {appointment.specialty?.name
                  ? ` — ${appointment.specialty.name}`
                  : ""}
              </DialogDescription>
            </DialogHeader>

            <ul className="grid gap-2.5">
              {rows.map(row => (
                <li
                  key={row.label}
                  className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <row.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-xs text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="text-sm font-medium leading-snug">
                      {row.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            {isActive && (
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(true)}
                  disabled={cancelling}
                  className="h-11 w-full rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto sm:justify-center"
                >
                  Annuler le rendez-vous
                </Button>
              </DialogFooter>
            )}
          </>
        )}

        {/* Confirmation d'annulation — action définitive, jamais accidentelle */}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler ce rendez-vous ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le créneau sera libéré et cette action est définitive. Vous
                pourrez prendre un nouveau rendez-vous à tout moment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelling}>
                Conserver
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={event => {
                  event.preventDefault();
                  void handleCancel();
                }}
                disabled={cancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
              >
                {cancelling ? "Annulation…" : "Oui, annuler"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
