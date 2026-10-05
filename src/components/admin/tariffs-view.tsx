"use client";

// Vue « Tarifs des consultations » du Médecin Chef — FEATURE-TOKENS (ADR-007),
// demande PO 2026-10-03 : la grille tarifaire n'est plus codée en dur, chaque
// poste (consultation cabinet / domicile) est éditable ICI en Tokens.
// Une modification vaut pour les DEMANDES À VENIR : le coût d'un RDV est figé
// à sa réservation (appointments.tokensReserved) — les patients déjà engagés
// ne sont jamais impactés (invariant financier du ledger).
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Coins,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { TariffDto } from "@/lib/token-schemas";
import { TARIFF_MAX_TOKENS, tokensToFcfa } from "@/lib/token-schemas";
import { relativePublishedLabel } from "@/lib/datetime";

type Props = { onBack: () => void };

// Ligne éditable : prix affiché (Tokens + FCFA) → bouton Modifier → saisie
// inline (entier 0..TARIFF_MAX_TOKENS) → Enregistrer (PATCH) / Annuler.
function TariffRow({
  tariff,
  busy,
  editing,
  draft,
  onEdit,
  onDraftChange,
  onCancel,
  onSave,
}: {
  tariff: TariffDto;
  busy: boolean;
  editing: boolean;
  draft: string;
  onEdit: () => void;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const fcfa = tokensToFcfa(tariff.tokens);

  return (
    <li className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Coins className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{tariff.label}</p>
          {/* line-clamp (et non truncate) : une description longue ne doit
              jamais forcer la largeur du li en nowrap (débordement mobile). */}
          <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
            {tariff.description}
          </p>
        </div>
        {!editing && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-extrabold">
              {tariff.tokens} Token{tariff.tokens > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {fcfa.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        )}
      </div>

      {editing ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={event => {
            event.preventDefault();
            onSave();
          }}
        >
          <label htmlFor={`tariff-${tariff.key}`} className="sr-only">
            Nouveau prix en Tokens — {tariff.label}
          </label>
          <div className="relative min-w-0 flex-1">
            <Input
              id={`tariff-${tariff.key}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={TARIFF_MAX_TOKENS}
              step={1}
              value={draft}
              onChange={event => onDraftChange(event.target.value)}
              disabled={busy}
              autoFocus
              className="h-10 rounded-xl pr-16"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
              Tokens
            </span>
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={busy}
            className="h-10 shrink-0 gap-1.5 rounded-xl bg-success px-3 text-xs font-bold text-success-foreground hover:bg-success/90"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Enregistrer
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onCancel}
            aria-label={`Annuler la modification de ${tariff.label}`}
            className="h-10 w-10 shrink-0 rounded-xl p-0"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Audit — dernière modification tracée (updatedById côté API). */}
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {tariff.updatedByName
              ? `Modifié par ${tariff.updatedByName} · ${relativePublishedLabel(tariff.updatedAt)}`
              : "Tarif par défaut (provisionnel)"}
          </p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onEdit}
            className="h-9 shrink-0 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Modifier
          </Button>
        </div>
      )}
    </li>
  );
}

export function TariffsView() {
  const [tariffs, setTariffs] = useState<TariffDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tariffs");
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { tariffs: TariffDto[] };
      setTariffs(body.tariffs);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function startEdit(tariff: TariffDto) {
    setEditingKey(tariff.key);
    setDraft(String(tariff.tokens));
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraft("");
  }

  async function save(tariff: TariffDto) {
    const tokens = Number(draft);
    if (!Number.isInteger(tokens) || tokens < 0 || tokens > TARIFF_MAX_TOKENS) {
      toast({
        variant: "destructive",
        title: "Prix invalide",
        description: `Saisissez un nombre entier de Tokens entre 0 et ${TARIFF_MAX_TOKENS}.`,
      });
      return;
    }
    if (tokens === tariff.tokens) {
      cancelEdit();
      return;
    }

    setBusyKey(tariff.key);
    try {
      const res = await fetch(`/api/admin/tariffs/${tariff.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      if (res.ok) {
        const body = (await res.json()) as { tariff: TariffDto };
        setTariffs(current =>
          (current ?? []).map(row => (row.key === body.tariff.key ? body.tariff : row)),
        );
        toast({
          title: "Tarif mis à jour",
          description: `${body.tariff.label} : ${body.tariff.tokens} Token${body.tariff.tokens > 1 ? "s" : ""} (${tokensToFcfa(body.tariff.tokens).toLocaleString("fr-FR")} FCFA) — appliqué aux prochaines demandes.`,
        });
        cancelEdit();
        return;
      }
      const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description: errorBody.error ?? "Réessayez dans un instant.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Modification impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Titre + sous-titre : rendus dans le header de l'app (helper
          viewHeading). Seule l'action de rafraîchissement reste ici. */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void loadAll()}
          aria-label="Rafraîchir la grille tarifaire"
          className="size-9 shrink-0 rounded-full"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Contrat d'application du tarif — éviter toute mauvaise surprise. */}
      <div
        role="note"
        className="flex items-start gap-2.5 rounded-2xl border border-primary/20 bg-primary/5 p-3.5"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Les tarifs s&apos;appliquent aux <strong className="font-semibold text-foreground">nouvelles demandes</strong> de
          rendez-vous. Les réservations déjà engagées conservent le tarif fixé
          au moment de leur réservation.
        </p>
      </div>

      {loadError && tariffs === null ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-medium">
            Impossible de charger la grille tarifaire.
          </p>
          <Button
            variant="outline"
            onClick={() => void loadAll()}
            className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
          >
            Réessayer
          </Button>
        </div>
      ) : tariffs === null ? (
        <ul className="grid gap-3" aria-busy="true" aria-label="Chargement des tarifs">
          {[0, 1].map(index => (
            <li key={index}>
              <Skeleton className="h-[104px] rounded-2xl" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : (
        <section aria-labelledby="tariffs-grid">
          <h3
            id="tariffs-grid"
            className="mb-2.5 text-[15px] font-bold tracking-tight"
          >
            Grille tarifaire
          </h3>
          <ul className="grid gap-3">
            {tariffs.map(tariff => (
              <TariffRow
                key={tariff.key}
                tariff={tariff}
                busy={busyKey === tariff.key}
                editing={editingKey === tariff.key}
                draft={editingKey === tariff.key ? draft : ""}
                onEdit={() => startEdit(tariff)}
                onDraftChange={setDraft}
                onCancel={cancelEdit}
                onSave={() => void save(tariff)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
