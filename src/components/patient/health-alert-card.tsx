"use client";

// Carte santé à la une — maquette PO 2026-10 : priorité aux alertes de la zone
// (category ALERTE), sinon dernier conseil publié. Écoute vocale (TTS navigateur)
// et accès à l'article complet (dialog porté par UserDashboard).
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
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
  onOpenArticle: (item: SensibilisationDto) => void;
};

export function HealthAlertCard({ feed, zone, loading, onOpenArticle }: Props) {
  const item = useMemo(
    () => feed?.find(entry => entry.category === "ALERTE") ?? feed?.[0] ?? null,
    [feed],
  );

  const speechText = item ? `${item.title}. ${item.body}` : null;
  const { speaking, supported, toggle } = useSpeech(speechText);
  // Changement d'article → le hook coupe lui-même la lecture en cours.

  if (loading && feed === null) {
    return <Skeleton className="h-[210px] rounded-2xl" aria-hidden="true" />;
  }
  if (!item) return null;

  const isAlert = item.category === "ALERTE";
  const minutes = estimatedListenMinutes(speechText ?? "");

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: 0.06 }}
      aria-label={isAlert ? "Alerte santé" : "Conseil santé"}
      className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
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
          {isAlert ? `Alerte Santé ${ZONE_LABELS[zone]}` : "Conseil Santé"}
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
        className="mt-3 block w-full text-left text-base font-bold leading-snug transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      >
        {item.title}
      </button>
      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
    </motion.section>
  );
}
