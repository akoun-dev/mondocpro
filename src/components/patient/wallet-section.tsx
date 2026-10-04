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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  PAYMENT_METHOD_LABELS,
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

type Props = {
  openRecharge?: boolean;
  onRechargeOpened?: () => void;
};

export function WalletSection({ openRecharge = false, onRechargeOpened }: Props) {
  const [wallet, setWallet] = useState<WalletDto | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [selectedFcfa, setSelectedFcfa] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [customTokens, setCustomTokens] = useState("");
  const [customTokensOpen, setCustomTokensOpen] = useState(false);
  const [rechargeStep, setRechargeStep] = useState<1 | 2 | 3>(1);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "RECHARGE" | "SPEND">("ALL");
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

  useEffect(() => {
    if (!openRecharge) return;
    setSelectedFcfa(null);
    setSelectedPaymentMethod(null);
    setCustomTokens("");
    setCustomTokensOpen(false);
    setRechargeStep(1);
    setRechargeOpen(true);
    onRechargeOpened?.();
  }, [onRechargeOpened, openRecharge]);

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
        setCustomTokens("");
        setCustomTokensOpen(false);
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
  const filteredTransactions = wallet?.transactions.filter(tx =>
    historyFilter === "ALL"
      ? true
      : historyFilter === "RECHARGE"
        ? tx.type === "RECHARGE"
        : tx.type === "CONSUMPTION" || tx.type === "RESERVATION",
  ) ?? [];

  return (
    <section aria-labelledby="profil-portefeuille">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div>
          <h3 id="profil-portefeuille" className="text-xl font-bold tracking-tight">
            Portefeuille santé
          </h3>
          <p className="text-xs text-muted-foreground">Épargne santé &amp; tokens médicaux</p>
        </div>
        {wallet && (
          <span className="text-xs text-muted-foreground">
            1 Token = {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA
          </span>
        )}
      </div>

      {/* Carte solde — dégradé primaire ADR-002 */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-primary-foreground shadow-md shadow-primary/20">
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
            <div className="space-y-4 p-5" aria-busy="true" aria-label="Chargement du portefeuille">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28 bg-white/20" />
                  <Skeleton className="h-9 w-24 bg-white/25" />
                  <Skeleton className="h-3 w-32 bg-white/15" />
                </div>
                <Skeleton className="h-10 w-28 rounded-xl bg-white/25" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-14 rounded-xl bg-white/10" />
                <Skeleton className="h-14 rounded-xl bg-white/10" />
              </div>
            </div>
          )
        ) : (
          <>
            <div className="p-5">
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
                   setCustomTokens("");
                   setCustomTokensOpen(false);
                   setRechargeStep(1);
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
            </div>
            {pendingRecharges > 0 && (
              <p className="flex items-center gap-1.5 bg-slate-950/25 px-5 py-3 text-xs opacity-90">
                <CircleAlert className="size-3.5 text-warning" aria-hidden="true" />
                {pendingRecharges} recharge{pendingRecharges > 1 ? "s" : ""} en attente de validation
              </p>
            )}
          </>
        )}
      </div>

      {/* Derniers mouvements (ledger — les 5 plus récents) */}
      {wallet && wallet.transactions.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Derniers mouvements</p>
            <div className="flex rounded-lg bg-muted p-0.5 text-[10px] font-semibold">
              {([["ALL", "Tous"], ["RECHARGE", "Recharges"], ["SPEND", "Solde"]] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setHistoryFilter(value)} className={`rounded-md px-2 py-1 ${historyFilter === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-1.5">
            {filteredTransactions.slice(0, 8).map(tx => {
              const display = movementDisplay(tx);
              const paymentLabel = tx.providerRef
                ? PAYMENT_METHOD_LABELS[tx.providerRef as PaymentMethod] ?? tx.providerRef
                : null;
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
                      {paymentLabel && (
                        <Badge
                          variant="outline"
                          className="border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] font-semibold text-primary"
                        >
                          {paymentLabel}
                        </Badge>
                      )}
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
                  <span className="shrink-0 text-right">
                    <span className={`block text-sm font-bold ${display.positive ? "text-success" : "text-primary"}`}>
                      {display.amount} Token{Math.abs(tx.tokens) > 1 ? "s" : ""}
                    </span>
                    {tx.amountFcfa !== null && (
                      <span className={`block text-[10px] ${display.positive ? "text-success/80" : "text-destructive/80"}`}>
                        {display.positive ? "+" : "−"}{tx.amountFcfa.toLocaleString("fr-FR")} FCFA
                      </span>
                    )}
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
          <div className="flex items-center gap-1.5" aria-label="Étapes de recharge">
            {["Tokens", "Opérateur", "Récapitulatif"].map((label, index) => {
              const step = (index + 1) as 1 | 2 | 3;
              return (
                <div key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rechargeStep >= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {step}
                  </span>
                  <span className="truncate text-[11px] font-semibold text-muted-foreground">{label}</span>
                  {step < 3 && <span className="h-px flex-1 bg-border" />}
                </div>
              );
            })}
          </div>
          {rechargeStep === 1 && (
          <div className="space-y-3">
            {customTokensOpen && (
            <>
            <div className="relative">
              <Coins className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" aria-hidden="true" />
              <Input
                type="number"
                min={1}
                max={100}
                step={1}
                inputMode="numeric"
                value={customTokens}
                onChange={event => {
                  const value = event.target.value;
                  setCustomTokens(value);
                  const tokens = Number(value);
                  if (Number.isInteger(tokens) && tokens > 0 && tokens <= 100) {
                    setSelectedFcfa(tokens * TOKEN_VALUE_FCFA);
                  } else {
                    setSelectedFcfa(null);
                  }
                }}
                placeholder="Saisir le nombre de Tokens"
                aria-label="Nombre de Tokens personnalisé"
                className="h-11 rounded-xl pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              1 Token = {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA · maximum 100 Tokens
            </p>
            </>
            )}
            <div
            role="radiogroup"
            aria-label="Choisir un montant prédéfini"
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
                   onClick={() => {
                     setSelectedFcfa(amount);
                     setCustomTokens(String(amount / TOKEN_VALUE_FCFA));
                     setRechargeStep(2);
                   }}
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
            <button
              type="button"
              onClick={() => setCustomTokensOpen(value => !value)}
              className="mx-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Coins className="size-4" aria-hidden="true" />
              {customTokensOpen ? "Masquer la saisie" : "Saisir un autre nombre de Tokens"}
            </button>
          </div>
          )}
          {rechargeStep === 2 && (
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
                    onClick={() => {
                      setSelectedPaymentMethod(value as PaymentMethod);
                      setRechargeStep(3);
                    }}
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
          )}
          {rechargeStep === 3 && selectedFcfa !== null && selectedPaymentMethod !== null && (
            <div className="rounded-xl bg-muted/60 p-4 text-sm">
              <p className="mb-3 font-semibold">Récapitulatif de votre recharge</p>
              <div className="flex justify-between"><span className="text-muted-foreground">Nombre de Tokens</span><strong>{selectedFcfa / TOKEN_VALUE_FCFA}</strong></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Montant</span><strong>{selectedFcfa.toLocaleString("fr-FR")} FCFA</strong></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Opérateur</span><strong>{selectedPaymentMethod.replace("_", " ")}</strong></div>
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Le paiement en ligne automatique (débit direct et crédit immédiat)
            arrive dès le choix du prestataire Mobile Money — en attendant,
            présentez votre paiement et vos Tokens sont validés manuellement.
          </p>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (rechargeStep === 1) setRechargeOpen(false);
                else setRechargeStep(rechargeStep === 3 ? 2 : 1);
              }}
              disabled={submitting}
            >
              {rechargeStep === 1 ? "Annuler" : "Retour"}
            </Button>
            <Button
              onClick={() => {
                if (rechargeStep === 3) void handleRecharge();
              }}
              disabled={rechargeStep !== 3 || selectedFcfa === null || selectedPaymentMethod === null || submitting}
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Envoi…
                </>
              ) : (
                rechargeStep === 3 ? "Déclarer le paiement" : "Sélectionnez une option"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
