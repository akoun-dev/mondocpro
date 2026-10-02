"use client";

// Vue « Sensibilisations » — même langage visuel que la maquette RDV
// (cartes blanches arrondies, pill catégorie, créneau bleu) : fil complet des
// conseils et alertes santé ciblés pour la zone du patient, écoute vocale et
// ouverture de l'article complet (dialog porté par UserDashboard).
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  HeartPulse,
  Square,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSpeech } from "@/hooks/use-speech";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import type { AppZone } from "@/stores/auth-store";
import { estimatedListenMinutes, relativePublishedLabel } from "@/lib/datetime";
import type { SensibilisationDto } from "@/lib/sensibilisations";

type Props = {
  feed: SensibilisationDto[] | null;
  zone: AppZone;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onOpenArticle: (item: SensibilisationDto) => void;
};

type SensoTab = "all" | "alertes" | "conseils";

const CATEGORIES: { id: SensoTab; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "alertes", label: "Alertes" },
  { id: "conseils", label: "Conseils" },
];

// Ligne du fil — carte maquette : pill catégorie + ancienneté, titre,
// extrait, actions Écouter / Lire. L'écoute coupe l'article en cours du hook.
function FeedCard({
  item,
  onOpenArticle,
}: {
  item: SensibilisationDto;
  onOpenArticle: (item: SensibilisationDto) => void;
}) {
  const isAlert = item.category === "ALERTE";
  const speechText = `${item.title}. ${item.body}`;
  const { speaking, supported, toggle } = useSpeech(speechText);
  const minutes = estimatedListenMinutes(speechText);

  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isAlert
              ? "bg-destructive/10 text-destructive"
              : "bg-success-light text-success-foreground"
          }`}
        >
          {isAlert ? (
            <TriangleAlert className="size-3.5" aria-hidden="true" />
          ) : (
            <HeartPulse className="size-3.5" aria-hidden="true" />
          )}
          {isAlert ? "Alerte santé" : "Conseil santé"}
        </span>
        <span
          className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
          suppressHydrationWarning
        >
          {relativePublishedLabel(item.publishedAt)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpenArticle(item)}
        className="mt-3 block w-full text-left text-[15px] font-bold leading-snug transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      >
        {item.title}
      </button>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {item.body}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        {supported ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-pressed={speaking}
            className="h-9 gap-1.5 rounded-full bg-muted px-3.5 text-xs font-semibold hover:bg-muted/70"
          >
            {speaking ? (
              <>
                <Square className="size-3.5" aria-hidden="true" />
                Arrêter l'écoute
              </>
            ) : (
              <>
                <Volume2 className="size-3.5" aria-hidden="true" />
                Écouter ({minutes} min)
              </>
            )}
          </Button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onOpenArticle(item)}
          className="flex items-center gap-1 rounded-sm text-sm font-semibold text-primary transition-colors hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Lire l'article
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </motion.li>
  );
}

export function SensibilisationsView({
  feed,
  zone,
  loading,
  error,
  onBack,
  onRefresh,
  onOpenArticle,
}: Props) {
  const [tab, setTab] = useState<SensoTab>("all");

  const visible = useMemo(() => {
    const list = feed ?? [];
    if (tab === "alertes") return list.filter(i => i.category === "ALERTE");
    if (tab === "conseils") return list.filter(i => i.category !== "ALERTE");
    return list;
  }, [feed, tab]);

  const countFor = (id: SensoTab): number => {
    const list = feed ?? [];
    if (id === "all") return list.length;
    if (id === "alertes") return list.filter(i => i.category === "ALERTE").length;
    return list.filter(i => i.category !== "ALERTE").length;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête — même gabarit que « Mes Rendez-vous » */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Retour à l'accueil"
            className="size-9 shrink-0 rounded-full"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              Sensibilisations
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Conseils et alertes santé — {ZONE_LABELS[zone]} et Abidjan
            </p>
          </div>
        </div>
      </div>

      {/* Onglets segmentés — même composant visuel que la vue RDV */}
      <div
        role="group"
        aria-label="Filtrer les sensibilisations"
        className="flex items-center gap-1 rounded-xl bg-muted p-1"
      >
        {CATEGORIES.map(category => (
          <button
            key={category.id}
            type="button"
            onClick={() => setTab(category.id)}
            aria-pressed={tab === category.id}
            className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              tab === category.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {category.label}
            {countFor(category.id) > 0
              ? ` (${countFor(category.id)})`
              : ""}
          </button>
        ))}
      </div>

      {loading && feed === null ? (
        <ul className="grid gap-3" aria-busy="true" aria-label="Chargement des sensibilisations">
          {[0, 1, 2].map(index => (
            <li key={index}>
              <Skeleton className="h-[150px] rounded-2xl" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : error && feed === null ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-medium">{error}</p>
          <Button
            variant="outline"
            onClick={onRefresh}
            className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
          >
            Réessayer
          </Button>
        </div>
      ) : visible.length > 0 ? (
        <ul className="grid gap-3">
          {visible.map(item => (
            <FeedCard key={item.id} item={item} onOpenArticle={onOpenArticle} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartPulse className="size-6" aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold">Rien pour l'instant</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Les prochains conseils et alertes santé apparaîtront ici.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
