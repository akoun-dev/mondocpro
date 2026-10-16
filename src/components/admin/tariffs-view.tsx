"use client"

// Vue « Tarifs des consultations » du Médecin Chef — FEATURE-TOKENS (ADR-007),
// demande PO 2026-10-03 : la grille tarifaire n'est plus codée en dur, chaque
// poste (consultation cabinet / domicile) est éditable ICI en Tokens.
// Une modification vaut pour les DEMANDES À VENIR : le coût d'un RDV est figé
// à sa réservation (appointments.tokensReserved) — les patients déjà engagés
// ne sont jamais impactés (invariant financier du ledger).
// Redesign maquette PO 2026-10 (Task UI-TARIFFS-2D, langage visuel
// UI-MISSIONS-1 / UI-PATIENTS-1) : bandeau d'information avec date de dernière
// révision de la grille, carte « Valeur unitaire du jeton » (équivalence
// conventionnée 1 Token = 2 500 FCFA), grille avec icône + badge par poste et
// audit horodaté par ligne. Contrats inchangés : GET /api/admin/tariffs et
// PATCH /api/admin/tariffs/:key.
import { useCallback, useEffect, useState } from "react"
import {
    Check,
    Clock3,
    Coins,
    Home,
    Info,
    Link2,
    Loader2,
    Pencil,
    RefreshCw,
    Stethoscope,
    X,
    type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import type { TariffDto } from "@/lib/token-schemas"
import {
    TARIFF_MAX_TOKENS,
    TOKEN_VALUE_FCFA,
    tokensToFcfa,
} from "@/lib/token-schemas"
import { formatTimeUTC, relativePublishedLabel } from "@/lib/datetime"

function capitalizeText(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

// « 3 oct. 2024 à 09:40 » — date de la dernière révision de la grille
// (heure d'Abidjan = UTC, cf. FEATURE-RDV).
function formatRevisionDate(iso: string): string {
    const formatted = new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
    }).format(new Date(iso))
    return `${capitalizeText(formatted)} à ${formatTimeUTC(iso)}`
}

// Visuel par poste tarifaire (maquette) : clé CABINET → stéthoscope (teinte
// primary, badge « Actif »), clé DOMICILE → domicile (teinte violette, badge
// « Déplacement »), fallback générique Coins pour toute clé future (frais
// patient absent, majoration nuit… : un INSERT de clé suffit côté base).
// NB : les clés réelles sont préfixées (CONSULTATION_CABINET /
// CONSULTATION_DOMICILE) → matching par inclusion.
function tariffVisual(key: string): {
    icon: LucideIcon
    iconClass: string
    badgeLabel: string | null
    badgeClass: string
} {
    if (key.includes("CABINET")) {
        return {
            icon: Stethoscope,
            iconClass: "bg-primary/10 text-primary",
            badgeLabel: "Actif",
            badgeClass:
                "bg-success/15 text-success-foreground dark:text-success hover:bg-success/15",
        }
    }
    if (key.includes("DOMICILE")) {
        return {
            icon: Home,
            iconClass: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
            badgeLabel: "Déplacement",
            badgeClass:
                "bg-violet-500/15 text-violet-700 dark:text-violet-400 hover:bg-violet-500/15",
        }
    }
    return {
        icon: Coins,
        iconClass: "bg-muted text-muted-foreground",
        badgeLabel: null,
        badgeClass: "",
    }
}

// Ligne éditable : icône + badge par poste, prix affiché (Tokens + FCFA) →
// bouton Modifier → saisie inline (entier 0..TARIFF_MAX_TOKENS) →
// Enregistrer (PATCH) / Annuler.
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
    tariff: TariffDto
    busy: boolean
    editing: boolean
    draft: string
    onEdit: () => void
    onDraftChange: (value: string) => void
    onCancel: () => void
    onSave: () => void
}) {
    const fcfa = tokensToFcfa(tariff.tokens)
    const visual = tariffVisual(tariff.key)
    const Icon = visual.icon

    return (
        <li className="min-w-0 rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
                <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${visual.iconClass}`}
                    aria-hidden="true"
                >
                    <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                    {/* Nom + badge partagent la ligne (maquette) : le nom passe
                        en wrap (jamais truncate) pour ne pas alimenter la
                        largeur intrinsèque de la carte (débordement mobile,
                        fix UI-PATIENTS-1). */}
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold leading-snug">
                            {tariff.label}
                        </p>
                        {visual.badgeLabel && (
                            <Badge
                                className={`shrink-0 rounded-full px-2.5 text-[11px] font-bold ${visual.badgeClass}`}
                            >
                                {visual.badgeLabel}
                            </Badge>
                        )}
                    </div>
                    {/* line-clamp (et non truncate) : une description longue
                        ne doit jamais forcer la largeur du li en nowrap
                        (débordement mobile). */}
                    <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
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
                        event.preventDefault()
                        onSave()
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
                    {/* Audit — dernière modification tracée (updatedByName côté
                        API) ; « provisionnel » tant que la ligne n'a jamais été
                        éditée. */}
                    <p className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3 shrink-0" aria-hidden="true" />
                        <span className="truncate" suppressHydrationWarning>
                            {tariff.updatedByName
                                ? `Modifié par ${tariff.updatedByName} · ${relativePublishedLabel(tariff.updatedAt)}`
                                : "Tarif par défaut (provisionnel)"}
                        </span>
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={onEdit}
                        className="h-9 shrink-0 gap-1.5 rounded-xl border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/15 hover:text-primary"
                    >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        Modifier
                    </Button>
                </div>
            )}
        </li>
    )
}

export function TariffsView() {
    const [tariffs, setTariffs] = useState<TariffDto[] | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [loading, setLoading] = useState(true)
    const [editingKey, setEditingKey] = useState<string | null>(null)
    const [draft, setDraft] = useState("")
    const [busyKey, setBusyKey] = useState<string | null>(null)

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/tariffs")
            if (!res.ok) throw new Error()
            const body = (await res.json()) as { tariffs: TariffDto[] }
            setTariffs(body.tariffs)
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

    // Dernière révision de la grille = updatedAt le plus récent (dates ISO
    // UTC → l'ordre lexicographique est fiable).
    const lastRevisionAt =
        tariffs && tariffs.length > 0
            ? tariffs.reduce(
                  (max, row) => (row.updatedAt > max ? row.updatedAt : max),
                  tariffs[0].updatedAt,
              )
            : null
    // « Dernière révision » n'a de sens que si au moins une ligne a réellement
    // été éditée (updatedByName renseigné) — sinon la grille est d'origine.
    const hasRevision =
        tariffs?.some(row => row.updatedByName !== null) ?? false

    function startEdit(tariff: TariffDto) {
        setEditingKey(tariff.key)
        setDraft(String(tariff.tokens))
    }

    function cancelEdit() {
        setEditingKey(null)
        setDraft("")
    }

    async function save(tariff: TariffDto) {
        const tokens = Number(draft)
        if (!Number.isInteger(tokens) || tokens < 0 || tokens > TARIFF_MAX_TOKENS) {
            toast({
                variant: "destructive",
                title: "Prix invalide",
                description: `Saisissez un nombre entier de Tokens entre 0 et ${TARIFF_MAX_TOKENS}.`,
            })
            return
        }
        if (tokens === tariff.tokens) {
            cancelEdit()
            return
        }

        setBusyKey(tariff.key)
        try {
            const res = await fetch(`/api/admin/tariffs/${tariff.key}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokens }),
            })
            if (res.ok) {
                const body = (await res.json()) as { tariff: TariffDto }
                setTariffs(current =>
                    (current ?? []).map(row =>
                        row.key === body.tariff.key ? body.tariff : row,
                    ),
                )
                toast({
                    title: "Tarif mis à jour",
                    description: `${body.tariff.label} : ${body.tariff.tokens} Token${body.tariff.tokens > 1 ? "s" : ""} (${tokensToFcfa(body.tariff.tokens).toLocaleString("fr-FR")} FCFA) — appliqué aux prochaines demandes.`,
                })
                cancelEdit()
                return
            }
            const errorBody = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            toast({
                variant: "destructive",
                title: "Modification impossible",
                description: errorBody.error ?? "Réessayez dans un instant.",
            })
        } catch {
            toast({
                variant: "destructive",
                title: "Modification impossible",
                description:
                    "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            })
        } finally {
            setBusyKey(null)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {/* ——— Bandeau d'information (contrat d'application du tarif) ——— */}
            <div
                role="note"
                className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5"
            >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Info className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Les tarifs s&apos;appliquent aux{" "}
                        <strong className="font-semibold text-foreground">
                            nouvelles demandes
                        </strong>{" "}
                        de rendez-vous. Les réservations déjà engagées
                        conservent le tarif initial fixé.
                    </p>
                    {tariffs === null ? (
                        loadError ? null : (
                            <Skeleton
                                className="mt-1.5 h-3 w-52 rounded-full"
                                aria-hidden="true"
                            />
                        )
                    ) : (
                        <p className="mt-1.5 text-xs font-semibold text-primary">
                            {hasRevision && lastRevisionAt ? (
                                <>
                                    {"Dernière révision : "}
                                    <span suppressHydrationWarning>
                                        {formatRevisionDate(lastRevisionAt)}
                                    </span>
                                </>
                            ) : (
                                "Tarifs par défaut (provisionnels)"
                            )}
                        </p>
                    )}
                </div>
            </div>

            {/* ——— Carte « Valeur unitaire du jeton » (constante client-safe
                    TOKEN_VALUE_FCFA : rendue immédiatement, jamais instable) ——— */}
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Link2 className="size-4.5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">Valeur unitaire du jeton</p>
                    <p className="text-xs text-muted-foreground">
                        Équivalence financière conventionnée
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-base font-extrabold">
                        {TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA
                    </p>
                    <Badge className="mt-0.5 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success-foreground dark:text-success hover:bg-success/15">
                        TAUX GARANTI
                    </Badge>
                </div>
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
                <div aria-busy="true" aria-label="Chargement des tarifs">
                    <ul className="grid gap-3">
                        {[0, 1].map(index => (
                            <li key={index}>
                                <Skeleton
                                    className="h-[104px] rounded-2xl"
                                    aria-hidden="true"
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <section aria-labelledby="tariffs-grid">
                    {/* Header (pattern SectionHeader de missions-view) : titre +
                        count pill + sous-ligne, bouton de rafraîchissement à
                        droite. Pas de filtres : la grille v1 n'a que 2 postes. */}
                    <div className="mb-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <h3
                                id="tariffs-grid"
                                className="flex min-w-0 items-center gap-2 text-[15px] font-bold tracking-tight"
                            >
                                Grille tarifaire
                                {tariffs.length > 0 && (
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                                        {tariffs.length}
                                    </span>
                                )}
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {tariffs.length} acte
                                {tariffs.length > 1 ? "s" : ""} enregistré
                                {tariffs.length > 1 ? "s" : ""}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void loadAll()}
                            aria-label="Rafraîchir la grille tarifaire"
                            className="size-8 shrink-0 rounded-full"
                        >
                            <RefreshCw
                                className={`size-4 ${loading ? "animate-spin" : ""}`}
                                aria-hidden="true"
                            />
                        </Button>
                    </div>
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
    )
}
