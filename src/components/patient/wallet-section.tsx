"use client";

// Section « Portefeuille de Tokens » de la vue Profil — FEATURE-TOKENS
// (ADR-007). Affiche le solde disponible (Tokens + équivalent FCFA), les
// Tokens en réservation pour les RDV actifs, le bouton « Recharger »
// (déclaration de paiement Wave / Orange Money / MTN / Visa → validation par
// le Médecin Chef, modèle transitoire ADR-007 avant ADR-005) et les derniers
// mouvements du ledger. Le paiement en ligne automatique reste « à venir »
// tant que la décision Mobile Money (ADR-005) est ouverte — copie honnête.
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  CircleAlert,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import type { WalletDto } from "@/lib/tokens";
import {
  RECHARGE_PRESETS_FCFA,
  TOKEN_STATUS_LABELS,
  TOKEN_TYPE_LABELS,
  TOKEN_VALUE_FCFA,
  tokensToFcfa,
  type PaymentMethod,
} from "@/lib/token-schemas";
import { relativePublishedLabel } from "@/lib/datetime";

// Apparence d'un mouvement du ledger côté patient.
function movementDisplay(tx: WalletDto["transactions"][number]) {
  switch (tx.type) {
    case "RECHARGE":
      return { amount: `+${tx.tokens}`, positive: true };
    case "RELEASE":
    case "REFUND":
      return { amount: `+${tx.tokens}`, positive: true };
    case "RESERVATION":
      return { amount: `−${tx.tokens}`, positive: false };
    case "CONSUMPTION":
      return { amount: `−${tx.tokens}`, positive: false };
    default: // ADJUSTMENT (signé)
      return {
        amount: tx.tokens >= 0 ? `+${tx.tokens}` : `−${Math.abs(tx.tokens)}`,
        positive: tx.tokens >= 0,
      };
  }
}

export function WalletSection() {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedFcfa, setSelectedFcfa] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet");
      if (!res.ok) throw new Error();
      setWallet((await res.json()) as WalletDto);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  async function handleRecharge() {
    if (selectedFcfa === null || selectedPaymentMethod === null) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/recharges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountFcfa: selectedFcfa,
          paymentMethod: selectedPaymentMethod,
        }),
      });
      if (res.status === 201) {
        const tokens = selectedFcfa / TOKEN_VALUE_FCFA;
        toast({
          title: "Recharge déclarée",
          description: `${tokens} Token${tokens > 1 ? "s" : ""} en attente de validation — le Médecin Chef crédite votre portefeuille dès réception du paiement.`,
        });
        setRechargeOpen(false);
        setSelectedFcfa(null);
        setSelectedPaymentMethod(null);
        await loadWallet();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      toast({
        variant: "destructive",
        title: "Recharge impossible",
        description: body.error ?? "Veuillez réessayer.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Recharge impossible",
        description:
          "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const pendingRecharges =
    wallet?.transactions.filter(
      tx => tx.type === "RECHARGE" && tx.status === "PENDING",
    ).length ?? 0;

  return (
    <section aria-labelledby="profil-portefeuille">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 id="profil-portefeuille" className="text-[15px] font-bold tracking-tight">
          Portefeuille de Tokens
        </h3>
        {wallet && (
          <span className="text-xs text-muted-foreground">
            1 Token = {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA
          </span>
        )}
      </div>

      {/* Carte solde — dégradé primaire ADR-002 */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-primary-foreground shadow-md shadow-primary/20">
        {wallet === null ? (
          loadError ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm">
                Impossible de charger votre portefeuille.
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void loadWallet()}
                className="h-8 gap-1.5 rounded-lg text-xs font-semibold"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Réessayer
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm" aria-busy="true">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Chargement du portefeuille…
            </div>
          )
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium opacity-80">
                  Tokens disponibles
                </p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tracking-tight">
                    {wallet.balanceTokens}
                  </span>
                  <span className="text-sm font-semibold opacity-90">
                    Token{wallet.balanceTokens > 1 ? "s" : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs opacity-80">
                  ≈ {wallet.balanceFcfa.toLocaleString("fr-FR")} FCFA
                </p>
              </div>
              <Button
                onClick={() => {
                   setSelectedFcfa(null);
                   setSelectedPaymentMethod(null);
                   setRechargeOpen(true);
                }}
                className="h-10 gap-1.5 rounded-xl bg-card text-sm font-bold text-primary shadow-sm hover:bg-card/90"
              >
                <Plus className="size-4" aria-hidden="true" />
                Recharger
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-card/15 p-2.5">
                <p className="font-semibold">{wallet.reservedTokens}</p>
                <p className="opacity-80">en réservation (RDV actifs)</p>
              </div>
              <div className="rounded-xl bg-card/15 p-2.5">
                <p className="font-semibold">{wallet.spentTokens}</p>
                <p className="opacity-80">
                  consommés ({wallet.spentFcfa.toLocaleString("fr-FR")} FCFA)
                </p>
              </div>
            </div>
            {pendingRecharges > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-xs opacity-90">
                <CircleAlert className="size-3.5" aria-hidden="true" />
                {pendingRecharges} recharge{pendingRecharges > 1 ? "s" : ""} en
                attente de validation du paiement
              </p>
            )}
          </>
        )}
      </div>

      {/* Derniers mouvements (ledger — les 5 plus récents) */}
      {wallet && wallet.transactions.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
            Derniers mouvements
          </p>
          <ul className="flex flex-col gap-1.5">
            {wallet.transactions.slice(0, 5).map(tx => {
              const display = movementDisplay(tx);
              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 rounded-xl bg-muted/60 px-3.5 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {TOKEN_TYPE_LABELS[tx.type] ?? tx.type}
                      {tx.status !== "CONFIRMED" && (
                        <Badge
                          variant={tx.status === "PENDING" ? "secondary" : "outline"}
                          className="px-1.5 py-0 text-[10px]"
                        >
                          {TOKEN_STATUS_LABELS[tx.status] ?? tx.status}
                        </Badge>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground" suppressHydrationWarning>
                      {relativePublishedLabel(tx.createdAt)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-bold ${display.positive ? "text-success" : "text-primary"}`}
                  >
                    {display.amount}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Dialog de recharge — presets (montants multiples du Token) */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recharger mon portefeuille</DialogTitle>
            <DialogDescription>
              1 Token = {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA.
              Choisissez votre moyen de paiement local puis indiquez le montant —
              vos Tokens sont crédités après rapprochement du paiement par le
              Médecin Chef.
            </DialogDescription>
          </DialogHeader>
          <div
            role="radiogroup"
            aria-label="Choisir le montant de la recharge"
            className="grid grid-cols-2 gap-2.5"
          >
            {RECHARGE_PRESETS_FCFA.map(amount => {
              const selected = selectedFcfa === amount;
              return (
                <button
                  key={amount}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedFcfa(amount)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border p-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/40 hover:bg-muted/40"
                  }`}
                >
                  <span className="text-base font-extrabold">
                    {amount.toLocaleString("fr-FR")} FCFA
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {amount / TOKEN_VALUE_FCFA} Token
                    {amount / TOKEN_VALUE_FCFA > 1 ? "s" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-2.5">
            <p className="text-sm font-semibold">Moyen de paiement</p>
            <div
              role="radiogroup"
              aria-label="Choisir le moyen de paiement"
              className="grid grid-cols-2 gap-2"
            >
              {[
                ["WAVE", "Wave", "/img/operator/wave-logo.png"],
                ["ORANGE_MONEY", "Orange Money", "/img/operator/orange-money-logo.webp"],
                ["MTN_MOMO", "MTN Mobile Money", "/img/operator/mtn-momo-logo.webp"],
                ["MOOV_MONEY", "Moov Money", "/img/operator/moov-money-logo.webp"],
              ].map(([value, label, logo]) => {
                const selected = selectedPaymentMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedPaymentMethod(value as PaymentMethod)}
                    className={`flex min-h-16 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      selected
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <Image
                      src={logo}
                      alt=""
                      width={40}
                      height={40}
                      className="size-9 rounded-lg object-contain"
                    />
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Le paiement en ligne automatique (débit direct et crédit immédiat)
            arrive dès le choix du prestataire Mobile Money — en attendant,
            présentez votre paiement et vos Tokens sont validés manuellement.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRechargeOpen(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void handleRecharge()}
              disabled={selectedFcfa === null || selectedPaymentMethod === null || submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Envoi…
                </>
              ) : (
                "Déclarer le paiement"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
