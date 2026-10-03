"use client";

// Carte « Campagnes de santé » — maquette PO 2026-10 v2 : en-tête avec compteur
// d'actives, puis deux cartes en avant (alerte d'abord, sinon conseils récents).
// Chaque carte : libellé de catégorie coloré, durée d'écoute, titre, extrait,
// écoute vocale (TTS navigateur) et accès à l'article complet (dialog porté
// par UserDashboard).
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  HeartPulse,
  Megaphone,
  Square,
  TriangleAlert,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSpeech } from "@/hooks/use-speech";
import type { SensibilisationDto } from "@/lib/sensibilisations";
import {
  estimatedListenMinutes,
  relativePublishedLabel,
} from "@/lib/datetime";

type Props = {
  feed: SensibilisationDto[] | null;
  loading: boolean;
  onOpenArticle: (item: SensibilisationDto) => void;
};

// Tri d'affichage : alertes sanitaires d'abord, puis les plus récentes.
function pickFeatured(feed: SensibilisationDto[]): SensibilisationDto[] {
  return [...feed]
    .sort((a, b) => {
      if (a.category !== b.category) return a.category === "ALERT" ? -1 : 1;
      return b.publishedAt.localeCompare(a.publishedAt);
    })
    .slice(0, 2);
}

type CardProps = {
  item: SensibilisationDto;
  index: number;
  onOpenArticle: (item: SensibilisationDto) => void;
};

// Une carte de campagne — sous-composant pour isoler le hook de lecture vocale
// (chaque carte a son propre texte et coupe l'écoute des autres via
// speechSynthesis.cancel() du hook).
function CampaignCard({ item, index, onOpenArticle }: CardProps) {
  const isAlert = item.category === "ALERT";
  const speechText = `${item.title}. ${item.body}`;
  const minutes = estimatedListenMinutes(speechText);
  const { speaking, supported, toggle } = useSpeech(speechText);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: 0.05 + index * 0.05 }}
      aria-label={isAlert ? "Alerte sanitaire" : "Campagne de santé"}
      className={`rounded-xl border p-4 ${
        isAlert
          ? "border-warning/30 bg-warning/[0.07]"
          : "border-success/25 bg-success/[0.06]"
      }`}
    >
      {/* Libellé de catégorie + durée d'écoute */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold ${
            isAlert ? "text-warning" : "text-success"
          }`}
        >
          {isAlert ? (
            <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
          ) : (
            <Megaphone className="size-3.5 shrink-0 text-success" aria-hidden="true" />
          )}
          <span className="truncate">
            {isAlert ? "Alerte Sanitaire" : "Campagne Nationale — Santé publique"}
          </span>
        </span>
        <span
          className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          suppressHydrationWarning
        >
          {relativePublishedLabel(item.publishedAt)}
        </span>
      </div>

      {/* Titre cliquable → article complet */}
      <button
        type="button"
        onClick={() => onOpenArticle(item)}
        className="mt-2 block w-full text-left text-sm font-bold leading-snug transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
      >
        {item.title}
      </button>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {item.body}
      </p>

      {/* Actions : écoute vocale colorée + détails */}
      <div className="mt-3 flex items-center justify-between gap-3">
        {supported ? (
          <Button
            size="sm"
            onClick={toggle}
            aria-pressed={speaking}
            className={`h-9 gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white hover:opacity-90 ${
              isAlert
                ? "bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning"
                : "bg-success text-white hover:bg-success/90 focus-visible:ring-success"
            }`}
          >
            {speaking ? (
              <>
                <Square className="size-3.5" aria-hidden="true" />
                Arrêter
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
          className="flex items-center gap-1 rounded-sm text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Détails
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </motion.article>
  );
}

export function HealthAlertCard({ feed, loading, onOpenArticle }: Props) {
  const featured = useMemo(
    () => (feed ? pickFeatured(feed) : []),
    [feed],
  );

  if (loading && feed === null) {
    return <Skeleton className="h-[210px] rounded-2xl" aria-hidden="true" />;
  }
  if (featured.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut", delay: 0.06 }}
      aria-label="Campagnes de santé"
      className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
    >
      {/* En-tête : titre, sous-titre, compteur d'actives */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <HeartPulse className="size-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Campagnes de santé</p>
            <p className="truncate text-xs text-muted-foreground">
              Retrouvez ci-après l'actu en cours
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold text-success">
          {featured.length} ACTIVE{featured.length > 1 ? "S" : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {featured.map((item, index) => (
          <CampaignCard
            key={item.id}
            item={item}
            index={index}
            onOpenArticle={onOpenArticle}
          />
        ))}
      </div>
    </motion.section>
  );
}
