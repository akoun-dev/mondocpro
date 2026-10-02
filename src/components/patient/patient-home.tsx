"use client";

// Accueil patient — maquette PO 2026-10 : carte de bienvenue, prochain
// rendez-vous, raccourci « Mes rendez-vous », santé à la une et épargne.
// Données partagées (usePatientData, monté dans UserDashboard) ; la réservation
// (BookAppointmentDialog) et l'épargne (P2 TOKENS, arbitrages A8/A9) sont
// portées par UserDashboard — « Bientôt » uniquement pour l'épargne.
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { PatientData } from "@/hooks/use-patient-data";
import type { AppointmentDto } from "@/lib/appointments";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import type { AppUser } from "@/stores/auth-store";
import { formatWelcomeDate } from "@/lib/datetime";
import type { SensibilisationDto } from "@/lib/sensibilisations";
import { NextAppointmentCard } from "./next-appointment-card";
import { HealthAlertCard } from "./health-alert-card";
import { AppointmentDetailDialog } from "./appointment-detail-dialog";

type Props = {
  user: AppUser;
  data: PatientData;
  onOpenAppointments: () => void;
  onOpenArticle: (item: SensibilisationDto) => void;
  onOpenAllArticles: () => void;
  onBook: () => void;
};

const WELCOME_TAGLINE =
  "Bienvenue sur votre portail de télémédecine et consultations de proximité à Abidjan.";

const SAVINGS_SOON = {
  title: "Épargne santé — bientôt disponible",
  description:
    "Recharge et cotisation en Tokens arriveront prochainement sur Mon doc Pro.",
};

// Transition d'entrée commune aux cartes (DESIGN_SYSTEM §4 : 220 ms, sobre).
const cardEntrance = (delay = 0) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: "easeOut" as const, delay },
});

export function PatientHome({
  user,
  data,
  onOpenAppointments,
  onOpenArticle,
  onOpenAllArticles,
  onBook,
}: Props) {
  const [detail, setDetail] = useState<AppointmentDto | null>(null);
  const firstName = user.fullName.trim().split(/\s+/)[0] ?? "";

  const notifySavingsSoon = () => toast(SAVINGS_SOON);

  return (
    <div className="flex flex-col gap-5">
      {data.error && data.appointments === null ? (
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
          {/* Carte de bienvenue — maquette : fond clair, badge zone en haut à droite */}
          <motion.section
            {...cardEntrance()}
            aria-label="Bienvenue"
            className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                  Bonjour, {firstName} 👋
                </h2>
                <p
                  className="mt-1 text-xs text-muted-foreground"
                  suppressHydrationWarning
                >
                  {formatWelcomeDate()}
                </p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                <MapPin className="size-3.5" aria-hidden="true" />
                {ZONE_LABELS[user.zone]}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {WELCOME_TAGLINE}
            </p>
          </motion.section>

          <NextAppointmentCard
            appointments={data.appointments}
            loading={data.loading}
            onOpenDetail={setDetail}
            onBook={onBook}
          />

          {/* Raccourci « Mes rendez-vous » — maquette : carte-lien avec « Consulter » */}
          <motion.section {...cardEntrance(0.04)}>
            <button
              type="button"
              onClick={onOpenAppointments}
              className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">
                  Mes rendez-vous
                </span>
                <span className="block text-xs text-muted-foreground">
                  Historique des consultations et suivi
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                Consulter
                <ChevronRight className="size-4" aria-hidden="true" />
              </span>
            </button>
          </motion.section>

          <HealthAlertCard
            feed={data.sensibilisations}
            zone={user.zone}
            loading={data.loading}
            onOpenArticle={onOpenArticle}
            onOpenAll={onOpenAllArticles}
          />

          {/* Épargne Santé MonDoc — maquette en état « Bientôt » (P2 TOKENS :
              branchement réel dès arbitrages A8 valeur jeton / A9 Mobile Money) */}
          <motion.section
            {...cardEntrance(0.08)}
            aria-label="Épargne santé"
            className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-light text-success-foreground">
                <Wallet className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Épargne Santé MonDoc</p>
                <p className="text-xs text-muted-foreground">
                  Prévoyance & soins Abidjan
                </p>
              </div>
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Clock className="size-3" aria-hidden="true" />
                Bientôt
              </Badge>
            </div>

            <div className="mt-4 rounded-xl bg-muted/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Solde disponible
                  </p>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-3xl font-bold tracking-tight">
                      —
                    </span>
                    <span className="text-sm font-semibold text-muted-foreground">
                      FCFA
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    ≈ — MDP · Jetons
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={notifySavingsSoon}
                  className="h-9 gap-1 rounded-lg text-xs font-semibold"
                >
                  Voir l'épargne
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Objectif soins famille</span>
                  <span className="text-muted-foreground">À définir</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-border/60"
                  role="progressbar"
                  aria-label="Objectif soins famille"
                  aria-valuenow={0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div className="h-full w-0 rounded-full bg-success" />
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                onClick={notifySavingsSoon}
                className="h-11 gap-2 rounded-xl bg-primary-dark text-primary-foreground hover:bg-primary-dark/90 focus-visible:ring-primary-dark"
              >
                <Wallet className="size-4" aria-hidden="true" />
                Recharger
              </Button>
              <Button
                variant="outline"
                onClick={notifySavingsSoon}
                className="h-11 gap-2 rounded-xl"
              >
                <Users className="size-4" aria-hidden="true" />
                Cotiser à plusieurs
              </Button>
            </div>
          </motion.section>
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
