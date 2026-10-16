"use client"

// Vue « Recharges de Tokens » du Médecin Chef — FEATURE-TOKENS (ADR-007),
// redesign maquette PO 2026-10 (maquette mobile Recharges) :
//   1. Recherche client (patient, téléphone, référence, note) avec bouton
//      d'effacement ;
//   2. Chips de filtre avec compteurs (Toutes / À valider / Confirmées /
//      Refusées) — compteurs calculés sur les données chargées ;
//   3. File « À valider en priorité » — cartes liseré ambre, montant + badge
//      opérateur coloré, référence de transaction DÉRIVÉE de l'ID (la base ne
//      stocke ni numéro de transaction ni pièce jointe : pas de lien « Preuve
//      jointe »), note éventuelle, actions Rejeter / Confirmer & Créditer
//      (garde anti double-crédit côté serveur inchangée) ;
//   4. « Décisions récentes & historique » — cartes compactes, badge de
//      statut, date de décision (heure d'Abidjan = UTC), tri Plus récentes /
//      Plus anciennes.
// Choix maquette : le bouton « Tout vérifier » est volontairement NON
// implémenté — la confirmation massive de paiements est un risque financier,
// chaque recharge mérite un rapprochement individuel.
// Un seul appel API : GET /api/admin/recharges → { pending, processed } ;
// PATCH /api/admin/recharges/:id pour la décision (contrats inchangés).
import { useCallback, useEffect, useMemo, useState } from "react"
import {
    BadgeCheck,
    Check,
    Coins,
    History,
    Loader2,
    RefreshCw,
    Search,
    Timer,
    TriangleAlert,
    X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { formatDateUTC, relativePublishedLabel } from "@/lib/datetime"
import { formatPhoneDisplay } from "@/lib/phone"
import type { AdminRechargeDto } from "@/lib/tokens"
import {
    PAYMENT_METHOD_LABELS,
    TOKEN_STATUS_LABELS,
    type PaymentMethod,
} from "@/lib/token-schemas"

// ——— Constantes design (maquette PO) ———

// Pastille d'avatar initiales — teinte déterministe par nom (maquette :
// initiales colorées diverses). Même palette que les vues Missions / Patients
// pour la cohérence du back-office.
const AVATAR_CLASSES = [
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
    "bg-violet-500",
    "bg-emerald-600",
    "bg-orange-500",
    "bg-fuchsia-500",
    "bg-cyan-600",
]

function avatarClass(seed: string): string {
    let hash = 0
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
    return AVATAR_CLASSES[Math.abs(hash) % AVATAR_CLASSES.length]
}

function initialsOf(fullName: string): string {
    return fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join("")
}

// Badge opérateur coloré (maquette) — une teinte par opérateur Mobile Money,
// lisible en clair comme en sombre.
const OPERATOR_BADGE_CLASSES: Record<string, string> = {
    WAVE: "bg-primary/10 text-primary hover:bg-primary/10",
    ORANGE_MONEY:
        "bg-orange-500/15 text-orange-700 dark:text-orange-400 hover:bg-orange-500/15",
    MTN_MOMO: "bg-amber-500/15 text-amber-700 dark:text-amber-500 hover:bg-amber-500/15",
    MOOV_MONEY: "bg-teal-500/15 text-teal-700 dark:text-teal-400 hover:bg-teal-500/15",
}

const OPERATOR_TEXT_CLASSES: Record<string, string> = {
    WAVE: "text-primary",
    ORANGE_MONEY: "text-orange-700 dark:text-orange-400",
    MTN_MOMO: "text-amber-700 dark:text-amber-500",
    MOOV_MONEY: "text-teal-700 dark:text-teal-400",
}

function operatorBadgeClass(providerRef: string | null): string {
    if (providerRef === null) return "bg-muted text-muted-foreground hover:bg-muted"
    return (
        OPERATOR_BADGE_CLASSES[providerRef] ??
        "bg-muted text-muted-foreground hover:bg-muted"
    )
}

function operatorTextClass(providerRef: string | null): string {
    if (providerRef === null) return "text-muted-foreground"
    return OPERATOR_TEXT_CLASSES[providerRef] ?? "text-muted-foreground"
}

// Préfixe de référence par opérateur (maquette : TX-W-…, TX-OM-…) — la base
// ne stocke ni numéro de transaction ni pièce jointe : la référence
// affichable est dérivée de l'identifiant réel (stable, unique).
const REF_PREFIXES: Record<string, string> = {
    WAVE: "W",
    ORANGE_MONEY: "OM",
    MTN_MOMO: "MM",
    MOOV_MONEY: "MV",
}

function transactionRef(providerRef: string | null, id: string): string {
    const suffix = id.slice(-5).toUpperCase()
    if (providerRef === null) return `TX-${suffix}`
    const prefix = REF_PREFIXES[providerRef]
    return prefix === undefined ? `TX-${suffix}` : `TX-${prefix}-${suffix}`
}

// ——— Formatage (Abidjan = UTC+0 : composantes UTC, convention
// src/lib/datetime.ts — stable quel que soit le fuseau de l'appareil) ———

/** « 25 000 FCFA » — ou « — » si le montant n'a pas été déclaré. */
function amountLabel(amountFcfa: number | null): string {
    return amountFcfa === null ? "—" : `${amountFcfa.toLocaleString("fr-FR")} FCFA`
}

/** « 4 Tokens » · « 1 Token » */
function tokensLabel(tokens: number): string {
    return `${tokens} Token${tokens > 1 ? "s" : ""}`
}

/** « 4 Tokens • Orange Money » — sous-ligne opérateur (maquette). */
function tokensOperatorLabel(recharge: AdminRechargeDto): string {
    const tokens = tokensLabel(recharge.tokens)
    if (recharge.providerRef === null) return tokens
    const operator =
        PAYMENT_METHOD_LABELS[recharge.providerRef as PaymentMethod] ??
        recharge.providerRef
    return operator ? `${tokens} • ${operator}` : tokens
}

/** « 05/11/2026 14:30:05 » — date de décision (heure d'Abidjan = UTC). */
function formatDecisionDate(iso: string): string {
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
        timeZone: "UTC",
    })
        .format(new Date(iso))
        .replace(", ", " ")
}

// ——— Filtres & tri ———

type StatusFilter = "toutes" | "valider" | "confirmees" | "refusees"

const STATUS_FILTERS: { id: StatusFilter; label: string; amber?: boolean }[] = [
    { id: "toutes", label: "Toutes" },
    { id: "valider", label: "À valider", amber: true },
    { id: "confirmees", label: "Confirmées" },
    { id: "refusees", label: "Refusées" },
]

type SortOption = "recentes" | "anciennes"

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: "recentes", label: "Tri : Plus récentes" },
    { id: "anciennes", label: "Tri : Plus anciennes" },
]

// ——— Carte « à valider en priorité » (maquette : liseré ambre) ———

function PendingCard({
    recharge,
    busy,
    onDecide,
}: {
    recharge: AdminRechargeDto
    busy: boolean
    onDecide: (decision: "CONFIRM" | "REJECT") => void
}) {
    return (
        <li className="rounded-2xl border border-warning/40 bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(recharge.patientName)}`}
                    aria-hidden="true"
                >
                    {initialsOf(recharge.patientName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        {/* Nom sur 1–2 lignes (le wrap évite le débordement
                            de grille constaté en UI-PATIENTS-1). */}
                        <p className="min-w-0 text-[15px] font-bold leading-tight">
                            {recharge.patientName}
                        </p>
                        <div className="shrink-0 text-right">
                            <p className="text-base font-extrabold tabular-nums">
                                {amountLabel(recharge.amountFcfa)}
                            </p>
                            <Badge
                                className={`mt-1 gap-1 rounded-full px-2.5 text-[11px] font-bold ${operatorBadgeClass(recharge.providerRef)}`}
                            >
                                {tokensOperatorLabel(recharge)}
                            </Badge>
                        </div>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {formatPhoneDisplay(recharge.patientPhone)} ·{" "}
                        <span suppressHydrationWarning>
                            {relativePublishedLabel(recharge.createdAt)}
                        </span>
                    </p>
                </div>
            </div>

            {/* Rangée référence — pas de pièce jointe en base : rien à droite. */}
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs">
                <p className="min-w-0 line-clamp-1 font-mono font-semibold">
                    Réf : {transactionRef(recharge.providerRef, recharge.id)}
                </p>
            </div>

            {recharge.note && (
                <p className="mt-2 w-fit rounded-lg bg-warning/10 px-2 py-1 text-[11px] font-semibold text-warning-foreground dark:text-warning">
                    {recharge.note}
                </p>
            )}

            {/* Actions — confirmer plus large (proportions maquette) ; les
                deux boutons sont désactivés pendant la décision en cours. */}
            <div className="mt-3.5 flex gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onDecide("REJECT")}
                    className="h-10 flex-1 gap-2 rounded-xl border-destructive/30 bg-destructive/5 text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <X className="size-4" aria-hidden="true" />
                    Rejeter
                </Button>
                <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => onDecide("CONFIRM")}
                    className="h-10 flex-[1.4] gap-2 rounded-xl bg-success text-xs font-bold text-success-foreground hover:bg-success/90"
                >
                    {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <BadgeCheck className="size-4" aria-hidden="true" />
                    )}
                    Confirmer &amp; Créditer
                </Button>
            </div>
        </li>
    )
}

// ——— Carte historique (décision déjà prise, traçabilité) ———

function ProcessedCard({ recharge }: { recharge: AdminRechargeDto }) {
    const confirmed = recharge.status === "CONFIRMED"

    return (
        <li className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    aria-hidden="true"
                >
                    <Coins className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="min-w-0 text-sm font-bold leading-tight">
                            {recharge.patientName}
                        </p>
                        <Badge
                            className={`gap-1 rounded-full px-2.5 text-[11px] font-bold ${
                                confirmed
                                    ? "bg-success/15 text-success-foreground dark:text-success hover:bg-success/15"
                                    : "bg-destructive/10 text-destructive hover:bg-destructive/10"
                            }`}
                        >
                            {confirmed ? (
                                <Check className="size-3" aria-hidden="true" />
                            ) : (
                                <X className="size-3" aria-hidden="true" />
                            )}
                            {TOKEN_STATUS_LABELS[recharge.status] ?? recharge.status}
                        </Badge>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground">
                        {formatDecisionDate(recharge.createdAt)}
                    </p>
                    {recharge.note && (
                        <p className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
                            {recharge.note}
                        </p>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold tabular-nums text-primary">
                        {amountLabel(recharge.amountFcfa)}
                    </p>
                    <p
                        className={`mt-0.5 text-xs font-semibold ${operatorTextClass(recharge.providerRef)}`}
                    >
                        {tokensOperatorLabel(recharge)}
                    </p>
                </div>
            </div>
        </li>
    )
}

// ——— Vue ———

export function RechargesView() {
    const [pending, setPending] = useState<AdminRechargeDto[] | null>(null)
    const [processed, setProcessed] = useState<AdminRechargeDto[] | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("toutes")
    const [sort, setSort] = useState<SortOption>("recentes")

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/recharges")
            if (!res.ok) throw new Error()
            const body = (await res.json()) as {
                pending: AdminRechargeDto[]
                processed: AdminRechargeDto[]
            }
            setPending(body.pending)
            setProcessed(body.processed)
            setLoadError(false)
        } catch {
            setLoadError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    async function decide(recharge: AdminRechargeDto, decision: "CONFIRM" | "REJECT") {
        setBusyId(recharge.id)
        try {
            const res = await fetch(`/api/admin/recharges/${recharge.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision }),
            })
            if (res.ok) {
                const confirmed = decision === "CONFIRM"
                toast({
                    title: confirmed ? "Recharge confirmée" : "Recharge refusée",
                    description: confirmed
                        ? `${recharge.tokens} Token${recharge.tokens > 1 ? "s" : ""} crédités au portefeuille de ${recharge.patientName}.`
                        : `La recharge de ${recharge.patientName} n'a pas été comptabilisée.`,
                })
                await loadAll()
                return
            }
            const body = (await res.json().catch(() => ({}))) as { error?: string }
            toast({
                variant: "destructive",
                title: "Action impossible",
                description: body.error ?? "Réessayez dans un instant.",
            })
        } catch {
            toast({
                variant: "destructive",
                title: "Action impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
        } finally {
            setBusyId(null)
        }
    }

    // ——— Données dérivées : recherche + filtres + tri (maquette) ———
    // Les compteurs des chips sont calculés sur les données CHARGÉES (sans
    // recherche) : ils ne bougent pas pendant la saisie.
    const derived = useMemo(() => {
        if (pending === null || processed === null) return null

        const needle = search.trim().toLowerCase()
        const matches = (haystack: string) =>
            needle === "" || haystack.toLowerCase().includes(needle)
        // Recherche client : patient, téléphone, référence dérivée, note.
        const isMatch = (recharge: AdminRechargeDto) =>
            matches(
                [
                    recharge.patientName,
                    recharge.patientPhone,
                    transactionRef(recharge.providerRef, recharge.id),
                    recharge.note ?? "",
                ].join(" "),
            )

        const direction = sort === "recentes" ? -1 : 1
        const filteredProcessed = processed
            .filter(recharge =>
                statusFilter === "confirmees"
                    ? recharge.status === "CONFIRMED"
                    : statusFilter === "refusees"
                      ? recharge.status === "REJECTED"
                      : true,
            )
            .filter(isMatch)
            .sort(
                (a, b) =>
                    direction *
                    (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
            )

        return {
            filteredPending: pending.filter(isMatch),
            filteredProcessed,
            confirmedCount: processed.filter(r => r.status === "CONFIRMED").length,
            rejectedCount: processed.filter(r => r.status === "REJECTED").length,
            searching: needle !== "",
        }
    }, [pending, processed, search, statusFilter, sort])

    const showPending = statusFilter === "toutes" || statusFilter === "valider"
    const showHistory =
        statusFilter === "toutes" ||
        statusFilter === "confirmees" ||
        statusFilter === "refusees"

    return (
        <div className="flex flex-col gap-4">
            {/* ——— Recherche (maquette) ——— */}
            <div className="relative">
                <Search
                    className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                />
                <Input
                    type="search"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Rechercher patient, référence, note…"
                    aria-label="Rechercher une recharge par patient, téléphone, référence ou note"
                    className="h-11 rounded-full border-border bg-card pl-10 pr-10 text-sm shadow-sm"
                />
                {search !== "" && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSearch("")}
                        aria-label="Effacer la recherche"
                        className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </Button>
                )}
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
            ) : pending === null || processed === null ? (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Chargement des recharges"
                >
                    <Skeleton className="h-11 rounded-full" aria-hidden="true" />
                    <div className="flex gap-2">
                        {[0, 1, 2, 3].map(index => (
                            <Skeleton
                                key={index}
                                className="h-8 w-24 shrink-0 rounded-full"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-4 w-52" aria-hidden="true" />
                        <Skeleton className="h-[228px] rounded-2xl" aria-hidden="true" />
                        <Skeleton className="h-[228px] rounded-2xl" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-4 w-64" aria-hidden="true" />
                        <Skeleton className="h-24 rounded-2xl" aria-hidden="true" />
                        <Skeleton className="h-24 rounded-2xl" aria-hidden="true" />
                    </div>
                </div>
            ) : derived ? (
                <>
                    {/* ——— Chips de filtre avec compteurs ——— */}
                    <div
                        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filtrer par statut"
                    >
                        {STATUS_FILTERS.map(filter => {
                            const active = statusFilter === filter.id
                            const count =
                                filter.id === "toutes"
                                    ? pending.length + processed.length
                                    : filter.id === "valider"
                                      ? pending.length
                                      : filter.id === "confirmees"
                                        ? derived.confirmedCount
                                        : derived.rejectedCount
                            return (
                                <button
                                    key={filter.id}
                                    type="button"
                                    onClick={() => setStatusFilter(filter.id)}
                                    aria-pressed={active}
                                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                                        active
                                            ? filter.amber
                                                ? "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning"
                                                : "border-transparent bg-foreground text-background"
                                            : "border-border bg-card text-foreground hover:bg-muted/60"
                                    }`}
                                >
                                    {filter.amber && (
                                        <TriangleAlert
                                            className="size-3.5 text-warning-foreground dark:text-warning"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {filter.label}
                                    <span
                                        className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                                            active
                                                ? filter.amber
                                                    ? "bg-warning/20"
                                                    : "bg-background/20"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* ——— Ligne de résultat : file à valider + tri + refresh ——— */}
                    <div className="flex flex-wrap items-center gap-2">
                        <p
                            className="min-w-0 text-xs text-muted-foreground"
                            aria-live="polite"
                        >
                            {derived.filteredPending.length > 0 ? (
                                <>
                                    <span className="font-bold text-foreground">
                                        {derived.filteredPending.length}
                                    </span>{" "}
                                    {derived.filteredPending.length > 1
                                        ? "demandes requièrent"
                                        : "demande requiert"}{" "}
                                    votre validation
                                </>
                            ) : pending.length > 0 ? (
                                "Aucune demande ne correspond à la recherche"
                            ) : (
                                "Aucune demande en attente"
                            )}
                        </p>
                        <div className="ml-auto flex items-center gap-2">
                            <Select
                                value={sort}
                                onValueChange={value => setSort(value as SortOption)}
                            >
                                <SelectTrigger
                                    aria-label="Trier les décisions traitées"
                                    className="h-8 w-auto shrink-0 gap-1 rounded-full border-primary/20 bg-primary/10 px-3 text-[11px] font-bold text-primary"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SORT_OPTIONS.map(option => (
                                        <SelectItem key={option.id} value={option.id}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => void loadAll()}
                                aria-label="Rafraîchir les recharges"
                                className="size-8 shrink-0 rounded-full"
                            >
                                <RefreshCw
                                    className={`size-4 ${loading ? "animate-spin" : ""}`}
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    </div>

                    {/* ——— Section priorité : à valider en priorité ——— */}
                    {showPending && (
                        <section
                            aria-labelledby="recharges-priority"
                            className="flex flex-col gap-3"
                        >
                            {derived.filteredPending.length > 0 ? (
                                <>
                                    <div className="flex items-center gap-2">
                                        <h3
                                            id="recharges-priority"
                                            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-warning-foreground dark:text-warning"
                                        >
                                            <Timer
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                            À valider en priorité
                                        </h3>
                                        <Badge className="rounded-full bg-warning px-2.5 text-[10px] font-bold text-warning-foreground hover:bg-warning">
                                            Action requise
                                        </Badge>
                                        <span className="text-xs font-bold tabular-nums text-warning-foreground dark:text-warning">
                                            {derived.filteredPending.length}
                                        </span>
                                    </div>
                                    <ul className="grid gap-3">
                                        {derived.filteredPending.map(recharge => (
                                            <PendingCard
                                                key={recharge.id}
                                                recharge={recharge}
                                                busy={busyId === recharge.id}
                                                onDecide={decision =>
                                                    void decide(recharge, decision)
                                                }
                                            />
                                        ))}
                                    </ul>
                                </>
                            ) : (
                                <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                    {derived.searching
                                        ? "Aucune demande ne correspond à la recherche."
                                        : "Aucune demande en attente — toutes les demandes ont été traitées."}
                                </p>
                            )}
                        </section>
                    )}

                    {/* ——— Section historique : décisions récentes ——— */}
                    {showHistory && (
                        <section
                            aria-labelledby="recharges-history"
                            className="flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-2">
                                <h3
                                    id="recharges-history"
                                    className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
                                >
                                    <History className="size-3.5" aria-hidden="true" />
                                    Décisions récentes &amp; historique
                                </h3>
                                <span
                                    className="ml-auto whitespace-nowrap text-[11px] font-medium text-muted-foreground"
                                    suppressHydrationWarning
                                >
                                    {formatDateUTC(new Date().toISOString())}
                                </span>
                            </div>
                            {derived.filteredProcessed.length === 0 ? (
                                <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                    {derived.searching
                                        ? "Aucun résultat pour cette recherche."
                                        : statusFilter === "confirmees"
                                          ? "Aucune recharge confirmée pour l'instant."
                                          : statusFilter === "refusees"
                                            ? "Aucune recharge refusée pour l'instant."
                                            : "Aucune décision enregistrée pour l'instant."}
                                </p>
                            ) : (
                                <ul className="grid gap-3">
                                    {derived.filteredProcessed.map(recharge => (
                                        <ProcessedCard
                                            key={recharge.id}
                                            recharge={recharge}
                                        />
                                    ))}
                                </ul>
                            )}
                        </section>
                    )}
                </>
            ) : null}
        </div>
    )
}
