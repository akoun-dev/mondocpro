"use client";

// Formulaire de prise de RDV en ÉTAPES — demande PO 2026-10-03 :
//   1 · Type (Au cabinet / À domicile)
//   2 · Spécialité (catalogue configurable par l'ADMIN — GET /api/specialties)
//   3 · Zone, jour ouvré (60 j) et créneau (grille 30 min, délai ≥ 2 h)
//   4 · Motif (optionnel) + récapitulatif, puis POST réel (201/400/409)
// Règles importées de src/lib/schedule.ts — la MÊME source que le serveur ;
// l'API revalide toujours. Stepper aligné sur le fil d'étapes de l'inscription
// (ADR-002 : segments bleus actifs, verts terminés).
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Home,
  Loader2,
  MapPin,
  Stethoscope,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { AppointmentDto, SpecialtyDto } from "@/lib/appointments";
import {
  APPOINTMENT_TYPES,
  type AppointmentTypeValue,
} from "@/lib/appointment-schemas";
import { ZONES, ZONE_LABELS } from "@/lib/auth-schemas";
import { formatCardSlotUTC } from "@/lib/datetime";
import {
  isSlotBookableNow,
  listBookableDays,
  listDaySlots,
  slotToDate,
} from "@/lib/schedule";
import type { AppZone } from "@/stores/auth-store";
import type { WalletDto } from "@/lib/tokens";
import {
  DEFAULT_TARIFFS,
  tokensToFcfa,
  type TariffDto,
} from "@/lib/token-schemas";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Appelé après un POST 201 → rafraîchissement des listes partagées. */
  onBooked: (appointment: AppointmentDto) => void;
  /** Zone de résidence du patient — pré-sélection de l'étape 3. */
  zone: AppZone;
};

const STEPS = [
  { title: "Type" },
  { title: "Spécialité" },
  { title: "Créneau" },
  { title: "Confirmation" },
] as const;

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
  const [step, setStep] = useState(0);
  const [type, setType] = useState<AppointmentTypeValue>("CABINET");
  const [specialties, setSpecialties] = useState<SpecialtyDto[] | null>(null);
  const [specialtiesError, setSpecialtiesError] = useState<string | null>(null);
  const [specialtyId, setSpecialtyId] = useState<string>("");
  const [zone_, setZone_] = useState<AppZone>(zone);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // FEATURE-TOKENS (ADR-007) : portefeuille chargé à l'ouverture pour
  // afficher le coût + le solde restant AVANT confirmation (contrat
  // fonctionnel §cycle financier — vérification du solde côté écran).
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  // Grille tarifaire EN VIGUEUR (configurable par le Médecin Chef,
  // table tariff_configs) : chargée à l'ouverture — null = en chargement.
  // En cas d'échec réseau : fallback sur les tarifs par défaut (le serveur
  // revalide de toute façon le tarif réel dans la transaction de réservation).
  const [tariffs, setTariffs] = useState<Record<AppointmentTypeValue, number> | null>(null);

  const days = useMemo(() => listBookableDays(new Date()), [open]);
  const slots = useMemo(() => listDaySlots(), []);

  // Portefeuille + grille tarifaire — rechargés à chaque ouverture (le solde
  // comme les tarifs peuvent avoir changé depuis la dernière visite).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setWallet(null);
    setTariffs(null);
    fetch("/api/wallet")
      .then(async res => {
        if (!res.ok) throw new Error();
        const body = (await res.json()) as WalletDto;
        if (!cancelled) setWallet(body);
      })
      .catch(() => {
        // Silencieux : le serveur revalide de toute façon à la soumission.
      });
    fetch("/api/tariffs")
      .then(async res => {
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { tariffs: TariffDto[] };
        // Détariffage : clé métier CONSULTATION_{TYPE} → coût du type.
        const map = Object.fromEntries(
          APPOINTMENT_TYPES.map(type => [type, DEFAULT_TARIFFS[type]]),
        ) as Record<AppointmentTypeValue, number>;
        for (const tariff of body.tariffs) {
          for (const type of APPOINTMENT_TYPES) {
            if (tariff.key === `CONSULTATION_${type}`) map[type] = tariff.tokens;
          }
        }
        if (!cancelled) setTariffs(map);
      })
      .catch(() => {
        // Fallback honnête : les tarifs par défaut (provisionnels ADR-007).
        if (!cancelled) setTariffs({ ...DEFAULT_TARIFFS });
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Catalogue des spécialités actives — chargé à l'ouverture du dialog.
  useEffect(() => {
    if (!open || specialties !== null || specialtiesError !== null) return;
    let cancelled = false;
    setSpecialtiesError(null);
    fetch("/api/specialties")
      .then(async res => {
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { specialties: SpecialtyDto[] };
        if (!cancelled) setSpecialties(body.specialties);
      })
      .catch(() => {
        if (!cancelled) {
          setSpecialtiesError(
            "Impossible de charger les spécialités — vérifiez votre connexion puis réessayez.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, specialties, specialtiesError]);

  const dayBookable = (key: string): boolean =>
    isSlotBookableNow(key, slots[slots.length - 1] ?? "08:00");

  // Jour effectif : premier jour OUVRÉ RÉSERVABLE à l'ouverture (aujourd'hui
  // peut n'avoir plus aucun créneau conforme au délai de 2 h).
  const effectiveDate =
    date || days.find(day => dayBookable(day.key))?.key || days[0]?.key || "";

  const selectedSlot =
    effectiveDate && time ? slotToDate(effectiveDate, time) : null;
  const selectedBookable =
    selectedSlot !== null && isSlotBookableNow(effectiveDate, time);

  const selectedSpecialty = specialties?.find(s => s.id === specialtyId) ?? null;

  // FEATURE-TOKENS : coût de la consultation selon le type choisi, lu dans la
  // grille tarifaire EN VIGUEUR (configurable par le Médecin Chef) chargée à
  // l'ouverture — null pendant le chargement (affiché « — », comme le solde).
  // La suffisance du solde est un contrôle écran : le serveur revalide le
  // tarif réel dans la transaction de réservation.
  const costTokens = tariffs ? tariffs[type] : null;
  const costFcfa = costTokens !== null ? tokensToFcfa(costTokens) : null;
  const balanceTokens = wallet?.balanceTokens ?? null;
  const hasBalance =
    costTokens === null || balanceTokens === null || balanceTokens >= costTokens;

  // Peut-on avancer à l'étape suivante depuis l'étape courante ?
  const canContinue =
    (step === 0 && Boolean(type)) ||
    (step === 1 && Boolean(specialtyId)) ||
    (step === 2 && Boolean(effectiveDate && time && selectedBookable));

  const canSubmit =
    step === 3 && selectedBookable && hasBalance && !submitting;

  function resetForm() {
    setStep(0);
    setType("CABINET");
    setSpecialtyId("");
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
          specialtyId,
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
          body.error ?? "Veuillez vérifier votre saisie puis réessayez.",
      });
      if (res.status === 402) {
        // Solde insuffisant confirmé par le serveur → réaligner le portefeuille.
        fetch("/api/wallet")
          .then(async r => (r.ok ? ((await r.json()) as WalletDto) : null))
          .then(w => w && setWallet(w))
          .catch(() => undefined);
      }
      if (res.status === 409) {
        // Créneau repris entre-temps → on force un nouveau choix d'horaire.
        setTime("");
        setStep(2);
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

  // Stepper — segments et pastilles : bleu = étape active, vert + check =
  // terminée (ADR-002), gris = à venir. Libellés dès sm (masqués sur mobile
  // : sans eux, le min-content du fil ne peut pas dépasser la largeur 390 px).
  const stepper = (
    <ol
      aria-label="Étapes de la prise de rendez-vous"
      className="flex min-w-0 items-center gap-1.5"
    >
      {STEPS.map((entry, index) => {
        const isDone = index < step;
        const isActive = index === step;
        return (
          <li key={entry.title} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={index > step}
              onClick={() => setStep(index)}
              aria-current={isActive ? "step" : undefined}
              className="flex w-full items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  isDone
                    ? "bg-success text-success-foreground"
                    : isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={`hidden truncate text-[11px] font-semibold sm:block ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {entry.title}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`mt-1 block h-1 rounded-full ${
                  isDone ? "bg-success" : isActive ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Nouveau rendez-vous</DialogTitle>
          <DialogDescription className="text-left">
            Consultations du lundi au vendredi, de 08:00 à 16:30 — réservation
            jusqu'à 60 jours à l'avance.
          </DialogDescription>
        </DialogHeader>

        {stepper}

        {/* min-w-0 : sans lui, la largeur intrinsèque du scroller de jours
            gonfle la piste grid du dialog et fait déborder tout le contenu. */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* ——— Étape 1 · Type de consultation ——— */}
          {step === 0 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-sm font-semibold">
                Où souhaitez-vous être consulté ?
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
          )}

          {/* ——— Étape 2 · Spécialité (catalogue ADMIN) ——— */}
          {step === 1 && (
            <fieldset className="flex flex-col gap-2.5">
              <legend className="text-sm font-semibold">
                Quelle spécialité voulez-vous consulter ?
              </legend>
              {specialties === null && !specialtiesError ? (
                <div className="grid grid-cols-2 gap-2.5" aria-busy="true">
                  {[0, 1, 2, 3].map(index => (
                    <Skeleton key={index} className="h-16 rounded-xl" aria-hidden="true" />
                  ))}
                </div>
              ) : specialtiesError ? (
                <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-center">
                  <p className="text-sm text-muted-foreground">{specialtiesError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSpecialtiesError(null);
                      setSpecialties(null);
                    }}
                    className="mt-3 h-9 rounded-lg text-xs font-semibold"
                  >
                    Réessayer
                  </Button>
                </div>
              ) : specialties && specialties.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label="Choisir la spécialité"
                  className="grid grid-cols-2 gap-2.5"
                >
                  {specialties.map(specialty => {
                    const selected = specialtyId === specialty.id;
                    return (
                      <button
                        key={specialty.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setSpecialtyId(specialty.id)}
                        className={`flex min-h-16 items-center gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <Stethoscope className="size-4" aria-hidden="true" />
                        </span>
                        <span className="text-sm font-semibold leading-tight">
                          {specialty.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                  Aucune spécialité n'est proposée pour le moment — contactez
                  l'équipe Mon doc Pro.
                </p>
              )}
            </fieldset>
          )}

          {/* ——— Étape 3 · Zone, jour et créneau ——— */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rdv-zone" className="text-sm font-semibold">
                  Zone
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

              <div className="flex flex-col gap-2">
                <Label htmlFor="rdv-date" className="text-sm font-semibold">
                  Jour
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
                        className={`flex shrink-0 items-center rounded-xl border px-3 py-2 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : enabled
                              ? "hover:border-primary/40 hover:bg-muted/40"
                              : "cursor-not-allowed border-dashed text-muted-foreground/60"
                        }`}
                      >
                        <span suppressHydrationWarning>
                          {formatDayChip(day.date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-sm font-semibold">Créneau</Label>
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
            </div>
          )}

          {/* ——— Étape 4 · Motif + récapitulatif ——— */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="rdv-reason" className="text-sm font-semibold">
                  Motif de consultation{" "}
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

              {/* Récapitulatif — vérification avant confirmation */}
              <div className="rounded-xl border bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Récapitulatif
                </p>
                <ul className="mt-2.5 grid gap-2 text-sm">
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Lieu</span>
                    <span className="font-semibold">
                      {type === "CABINET" ? "Au cabinet" : "À domicile"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Spécialité</span>
                    <span className="font-semibold">
                      {selectedSpecialty?.name ?? "—"}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Zone</span>
                    <span className="font-semibold">{ZONE_LABELS[zone_]}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Créneau</span>
                    <span
                      className="text-right font-semibold"
                      suppressHydrationWarning
                    >
                      {selectedSlot
                        ? formatCardSlotUTC(selectedSlot.toISOString())
                        : "—"}
                    </span>
                  </li>
                  {/* FEATURE-TOKENS (ADR-007) — coût + solde restant affichés
                      AVANT confirmation (contrat fonctionnel §cycle). Coût
                      issu de la grille tarifaire EN VIGUEUR (configurable
                      Médecin Chef) — « — » pendant le chargement. */}
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Coût</span>
                    <span className="font-semibold">
                      {costTokens === null
                        ? "—"
                        : `${costTokens} Token${costTokens > 1 ? "s" : ""} · ${costFcfa?.toLocaleString("fr-FR")} FCFA`}
                    </span>
                  </li>
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Solde après réservation</span>
                    <span
                      className={`font-semibold ${balanceTokens !== null && !hasBalance ? "text-destructive" : ""}`}
                    >
                      {balanceTokens === null || costTokens === null
                        ? "—"
                        : `${balanceTokens - costTokens} Token${balanceTokens - costTokens > 1 ? "s" : ""}`}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
          {/* Étape 4 · Solde insuffisant — blocage explicite AVANT envoi */}
          {step === 3 && !hasBalance && costTokens !== null && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs font-medium text-destructive"
            >
              Solde insuffisant — cette consultation coûte {costTokens} Token
              {costTokens > 1 ? "s" : ""} et votre portefeuille en contient
              {" "}
              {balanceTokens ?? 0}. Rechargez-le depuis votre profil puis
              revenez confirmer votre demande.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full gap-2.5">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(current => current - 1)}
                disabled={submitting}
                aria-label="Retour à l'étape précédente"
                className="h-11 w-11 shrink-0 rounded-xl p-0"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
            )}
            {step < 3 ? (
              <Button
                onClick={() => setStep(current => current + 1)}
                disabled={!canContinue}
                className="h-11 min-w-0 flex-1 gap-2 rounded-xl text-sm font-semibold"
              >
                Continuer
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="h-11 min-w-0 flex-1 gap-2 rounded-xl text-sm font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Enregistrement…
                  </>
                ) : (
                  <>
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Confirmer le rendez-vous
                  </>
                )}
              </Button>
            )}
          </div>
          {step === 3 && costTokens !== null && (
            <p className="text-center text-xs text-muted-foreground">
              {costTokens} Token{costTokens > 1 ? "s" : ""} seront réservés sur
              votre portefeuille et débités définitivement après la visite —
              votre demande sera en attente jusqu&apos;à confirmation par
              l&apos;équipe soignante.
            </p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
