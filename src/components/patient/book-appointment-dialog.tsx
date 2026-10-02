"use client";

// Formulaire de prise de RDV — maquette PO 2026-10 (bouton « + Nouveau RDV »).
// Type (cabinet/domicile) → zone (par défaut celle du patient) → jour ouvré
// (défilement 60 j) → créneau (grille 30 min, 08:00–16:30, délai ≥ 2 h) →
// motif optionnel (500 c.). Règles importées de src/lib/schedule.ts — la
// MÊME source que le serveur ; l'API revalide toujours (POST 201/400/409).
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  Home,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { AppointmentDto } from "@/lib/appointments";
import type { AppointmentTypeValue } from "@/lib/appointment-schemas";
import { ZONES, ZONE_LABELS } from "@/lib/auth-schemas";
import { formatCardSlotUTC } from "@/lib/datetime";
import {
  isSlotBookableNow,
  listBookableDays,
  listDaySlots,
  slotToDate,
} from "@/lib/schedule";
import type { AppZone } from "@/stores/auth-store";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Appelé après un POST 201 → rafraîchissement des listes partagées. */
  onBooked: (appointment: AppointmentDto) => void;
  /** Zone de résidence du patient — pré-sélection du formulaire. */
  zone: AppZone;
};

const TYPE_OPTIONS: {
  value: AppointmentTypeValue;
  label: string;
  description: string;
  icon: typeof Building2;
}[] = [
  {
    value: "CABINET",
    label: "Au cabinet",
    description: "Consultation au centre de santé de votre zone",
    icon: Building2,
  },
  {
    value: "DOMICILE",
    label: "À domicile",
    description: "Un soignant se déplace chez vous",
    icon: Home,
  },
];

const REASON_MAX = 500;

// Libellé de puce de jour : « sam. 25 oct. » (pas d'heure).
function formatDayChip(date: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function BookAppointmentDialog({ open, onClose, onBooked, zone }: Props) {
  const [type, setType] = useState<AppointmentTypeValue>("CABINET");
  const [zone_, setZone_] = useState<AppZone>(zone);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => listBookableDays(new Date()), [open]);
  const slots = useMemo(() => listDaySlots(), []);

  const dayBookable = (key: string): boolean =>
    isSlotBookableNow(key, slots[slots.length - 1] ?? "08:00");

  // Jour effectif : premier jour OUVRÉ RÉSERVABLE à l'ouverture (aujourd'hui
  // peut n'avoir plus aucun créneau conforme au délai de 2 h).
  const effectiveDate =
    date || days.find(day => dayBookable(day.key))?.key || days[0]?.key || "";

  const selectedSlot =
    effectiveDate && time ? slotToDate(effectiveDate, time) : null;
  const selectedBookable =
    selectedSlot !== null &&
    isSlotBookableNow(effectiveDate, time);

  const canSubmit = Boolean(type && effectiveDate && time && selectedBookable) && !submitting;

  function resetForm() {
    setDate("");
    setTime("");
    setReason("");
    setSubmitting(false);
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          zone: zone_,
          date: effectiveDate,
          time,
          reason: reason.trim() || undefined,
        }),
      });
      if (res.status === 201) {
        const body = (await res.json()) as { appointment: AppointmentDto };
        toast({
          title: "Rendez-vous enregistré",
          description: `Votre demande du ${formatCardSlotUTC(body.appointment.scheduledAt)} est en attente de confirmation.`,
        });
        onBooked(body.appointment);
        resetForm();
        onClose();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        variant: "destructive",
        title: "Réservation impossible",
        description:
          body.error ??
          "Veuillez vérifier votre saisie puis réessayez.",
      });
      if (res.status === 409) {
        // Créneau repris entre-temps → on force un nouveau choix d'horaire.
        setTime("");
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Réservation impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Nouveau rendez-vous</DialogTitle>
          <DialogDescription className="text-left">
            Consultations du lundi au vendredi, de 08:00 à 16:30 — réservation
            jusqu'à 60 jours à l'avance.
          </DialogDescription>
        </DialogHeader>

        {/* min-w-0 : sans lui, la largeur intrinsèque du scroller de jours
            (43 puces) gonfle la piste grid du dialog et fait déborder tout
            le contenu (grille de créneaux incluse). */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1 · Type de consultation — cartes sélectionnables */}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="text-sm font-semibold">
              1 · Type de consultation
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              {TYPE_OPTIONS.map(option => {
                const selected = type === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    aria-pressed={selected}
                    className={`flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className={`flex size-9 items-center justify-center rounded-lg ${
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <option.icon className="size-4.5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-bold">{option.label}</span>
                    <span className="text-xs leading-snug text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* 2 · Zone — pré-remplie avec la zone de résidence du patient */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rdv-zone" className="text-sm font-semibold">
              2 · Zone
            </Label>
            <Select
              value={zone_}
              onValueChange={value => setZone_(value as AppZone)}
            >
              <SelectTrigger id="rdv-zone" className="h-11 rounded-xl">
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" aria-hidden="true" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {ZONES.map(z => (
                  <SelectItem key={z} value={z}>
                    {ZONE_LABELS[z]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3 · Jour — puces horizontales, jours ouvrés des 60 prochains jours */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rdv-date" className="text-sm font-semibold">
              3 · Jour
            </Label>
            <div
              id="rdv-date"
              role="radiogroup"
              aria-label="Choisir le jour du rendez-vous"
              className="flex gap-2 overflow-x-auto pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {days.map(day => {
                const selected = effectiveDate === day.key;
                const enabled = dayBookable(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!enabled}
                    onClick={() => {
                      setDate(day.key);
                      if (time && !isSlotBookableNow(day.key, time)) {
                        setTime("");
                      }
                    }}
                    className={`flex min-w-19 shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : enabled
                          ? "hover:border-primary/40 hover:bg-muted/40"
                          : "cursor-not-allowed border-dashed text-muted-foreground/60"
                    }`}
                  >
                    <span
                      className={`text-[11px] font-medium capitalize ${selected ? "text-white/80" : ""}`}
                      suppressHydrationWarning
                    >
                      {formatDayChip(day.date)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 · Créneau — grille 30 min, créneaux passés / délai < 2 h grisés */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-semibold">4 · Créneau</Label>
            <div
              role="radiogroup"
              aria-label="Choisir l'heure du rendez-vous"
              className="grid grid-cols-4 gap-2"
            >
              {slots.map(slot => {
                const selected = time === slot;
                const enabled = isSlotBookableNow(effectiveDate, slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!enabled}
                    onClick={() => setTime(slot)}
                    className={`min-h-10 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : enabled
                          ? "hover:border-primary/40 hover:bg-muted/40"
                          : "cursor-not-allowed border-dashed text-muted-foreground/60"
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5 · Motif — optionnel */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="rdv-reason" className="text-sm font-semibold">
              5 · Motif de consultation{" "}
              <span className="font-normal text-muted-foreground">
                (optionnel)
              </span>
            </Label>
            <Textarea
              id="rdv-reason"
              value={reason}
              onChange={event =>
                setReason(event.target.value.slice(0, REASON_MAX))
              }
              placeholder="Ex. : fièvre et maux de tête depuis deux jours…"
              className="min-h-20 rounded-xl"
            />
            <p className="self-end text-xs text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full flex-col gap-3">
            {selectedSlot && (
              <p
                className="flex items-center gap-1.5 text-sm font-semibold text-primary"
                suppressHydrationWarning
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                {formatCardSlotUTC(selectedSlot.toISOString())} —{" "}
                {ZONE_LABELS[zone_]}
              </p>
            )}
            <Button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="h-11 w-full gap-2 rounded-xl text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Enregistrement…
                </>
              ) : (
                "Confirmer le rendez-vous"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Votre demande sera en attente jusqu'à confirmation par l'équipe
              soignante.
            </p>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
