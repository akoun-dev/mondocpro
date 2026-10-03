"use client";

// Vue « Recharges de Tokens » du Médecin Chef — FEATURE-TOKENS (ADR-007).
// Rapprochement des paiements déclarés par les patients (Wave / Orange Money
// / MTN Mobile Money / Visa) : CONFIRMER crédite les Tokens (garde anti
// double-crédit côté serveur), REFUSER rejette la recharge (paiement non
// rapproché). Les décisions récentes restent affichées (traçabilité).
// Modèle transitoire : la confirmation automatique par le prestataire
// arrivera avec la décision Mobile Money (ADR-005).
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  CircleX,
  Coins,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import type { AdminRechargeDto } from "@/lib/tokens";
import {
  TOKEN_STATUS_LABELS,
  TOKEN_VALUE_FCFA,
} from "@/lib/token-schemas";
import { relativePublishedLabel } from "@/lib/datetime";
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/lib/token-schemas";

type Props = { onBack: () => void };

function RechargeRow({
  recharge,
  busy,
  onDecide,
}: {
  recharge: AdminRechargeDto;
  busy: boolean;
  onDecide?: (decision: "CONFIRM" | "REJECT") => void;
}) {
  return (
    <li className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Coins className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{recharge.patientName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {recharge.patientPhone.replace("+225", "0")} ·{" "}
            <span suppressHydrationWarning>
              {relativePublishedLabel(recharge.createdAt)}
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-extrabold">
            {recharge.amountFcfa?.toLocaleString("fr-FR")} FCFA
          </p>
          <p className="text-xs text-muted-foreground">
            {recharge.tokens} Token{recharge.tokens > 1 ? "s" : ""}
          </p>
          {recharge.providerRef && (
            <p className="text-xs font-medium text-primary">
              {PAYMENT_METHOD_LABELS[recharge.providerRef as PaymentMethod] ?? recharge.providerRef}
            </p>
          )}
        </div>
      </div>
      {onDecide && (
        <div className="mt-3 flex gap-2.5">
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onDecide("CONFIRM")}
            className="h-9 flex-1 gap-1.5 rounded-xl bg-success text-xs font-bold text-success-foreground hover:bg-success/90"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <BadgeCheck className="size-4" aria-hidden="true" />
            )}
            Confirmer le paiement
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onDecide("REJECT")}
            className="h-9 flex-1 gap-1.5 rounded-xl border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            <CircleX className="size-4" aria-hidden="true" />
            Refuser
          </Button>
        </div>
      )}
    </li>
  );
}

export function RechargesView({ onBack }: Props) {
  const [pending, setPending] = useState<AdminRechargeDto[] | null>(null);
  const [processed, setProcessed] = useState<AdminRechargeDto[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/recharges");
      if (!res.ok) throw new Error();
      const body = (await res.json()) as {
        pending: AdminRechargeDto[];
        processed: AdminRechargeDto[];
      };
      setPending(body.pending);
      setProcessed(body.processed);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function decide(recharge: AdminRechargeDto, decision: "CONFIRM" | "REJECT") {
    setBusyId(recharge.id);
    try {
      const res = await fetch(`/api/admin/recharges/${recharge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        const confirmed = decision === "CONFIRM";
        toast({
          title: confirmed ? "Recharge confirmée" : "Recharge refusée",
          description: confirmed
            ? `${recharge.tokens} Token${recharge.tokens > 1 ? "s" : ""} crédités au portefeuille de ${recharge.patientName}.`
            : `La recharge de ${recharge.patientName} n'a pas été comptabilisée.`,
        });
        await loadAll();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        variant: "destructive",
        title: "Action impossible",
        description: body.error ?? "Réessayez dans un instant.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Action impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* En-tête — même gabarit que « Spécialités » */}
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
              Recharges de Tokens
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Rapprochement des paiements patients — 1 Token ={" "}
              {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void loadAll()}
            aria-label="Rafraîchir la liste des recharges"
            className="size-9 shrink-0 rounded-full"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {loadError && pending === null ? (
        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-medium">
            Impossible de charger les recharges.
          </p>
          <Button
            variant="outline"
            onClick={() => void loadAll()}
            className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
          >
            Réessayer
          </Button>
        </div>
      ) : pending === null ? (
        <ul className="grid gap-3" aria-busy="true" aria-label="Chargement des recharges">
          {[0, 1].map(index => (
            <li key={index}>
              <Skeleton className="h-[92px] rounded-2xl" aria-hidden="true" />
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* File de validation */}
          <section aria-labelledby="recharges-pending">
            <h3
              id="recharges-pending"
              className="mb-2.5 text-[15px] font-bold tracking-tight"
            >
              À valider{" "}
              {pending.length > 0 && (
                <Badge className="ml-1 bg-warning text-warning-foreground">
                  {pending.length}
                </Badge>
              )}
            </h3>
            {pending.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                Aucune recharge en attente — toutes les demandes ont été
                traitées.
              </p>
            ) : (
              <ul className="grid gap-3">
                {pending.map(recharge => (
                  <RechargeRow
                    key={recharge.id}
                    recharge={recharge}
                    busy={busyId === recharge.id}
                    onDecide={decision => void decide(recharge, decision)}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* Décisions récentes (traçabilité) */}
          {processed !== null && processed.length > 0 && (
            <section aria-labelledby="recharges-processed">
              <h3
                id="recharges-processed"
                className="mb-2.5 text-[15px] font-bold tracking-tight"
              >
                Décisions récentes
              </h3>
              <ul className="grid gap-3">
                {processed.map(recharge => (
                  <li key={recharge.id}>
                    <RechargeRow recharge={recharge} busy={false} />
                    <div className="mt-2 flex items-center gap-2">
                      <Badge
                        className={
                          recharge.status === "CONFIRMED"
                            ? "bg-success text-success-foreground"
                            : "bg-destructive/10 text-destructive"
                        }
                      >
                        {TOKEN_STATUS_LABELS[recharge.status] ?? recharge.status}
                      </Badge>
                      {recharge.note && (
                        <span className="truncate text-xs text-muted-foreground">
                          {recharge.note}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
