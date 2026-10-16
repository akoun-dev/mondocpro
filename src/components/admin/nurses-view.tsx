"use client"

// Vue « Infirmiers » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN,
// redesign maquette PO 2026-10 (maquette mobile Infirmiers) :
//   1. CTA pleine largeur « Ajouter un infirmier » — le workflow d'onboarding
//      complet (compte actif, mot de passe choisi ou généré) est conservé ;
//   2. Recherche pillée (nom / téléphone / matricule) avec bouton d'effacement ;
//   3. Chips de disponibilité (Tous / Disponibles / En tournée) puis chips de
//      zone — filtre et tri 100 % clients : l'annuaire est petit, un SEUL
//      GET /api/admin/nurses SANS paramètre alimente la liste, les compteurs
//      des chips et la ligne de résultat (pattern Patients) ;
//   4. Cartes infirmier (maquette) : avatar initiales colorées, matricule
//      #IDE-xxx dérivé de l'ID, téléphone cliquable, badge de zone coloré,
//      badge de disponibilité, barre de charge journalière (dérivée du nombre
//      de missions — la base ne stocke aucune capacité), bandeau de stats
//      (En cours / Ce mois / Dernière tournée), actions « Fiche soignant » +
//      appel + SMS + menu ⋮ (suspension de compte préservée) ;
//   5. Fiche : identité, compteurs de charge, historique de missions avec
//      filtre « terminées » (inchangé).
// Deux appels : GET /api/admin/nurses pour la liste puis GET
// /api/admin/nurses/:id à l'ouverture d'une fiche (chargement différé) ;
// POST /api/admin/nurses reste l'unique point d'entrée de la création.

import { useEffect, useMemo, useState } from "react"
import {
    Activity,
    BadgeCheck,
    Check,
    ChevronRight,
    CircleCheck,
    ClipboardList,
    Copy,
    FileText,
    Loader2,
    MapPin,
    MessageSquare,
    MoreVertical,
    Phone,
    RefreshCw,
    Search,
    UserRoundPlus,
    X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
    LoadError,
    SuspendAccountDialog,
    useAccountSuspension,
    useAdminResource,
} from "@/components/admin/admin-directory-shared"
import {
    calendarDayDiffUTC,
    formatDateUTC,
    formatTimeUTC,
} from "@/lib/datetime"
import {
    MISSION_STATUS_CLASSES,
    MISSION_STATUS_LABELS,
} from "@/lib/nurse-schemas"
import {
    ZONES,
    ZONE_LABELS,
    createNurseSchema,
    zodIssuesToFieldErrors,
} from "@/lib/auth-schemas"
import { formatPhoneDisplay } from "@/lib/phone"
import { toast } from "@/hooks/use-toast"
import { hapticSuccess } from "@/lib/native"
import type {
    CreatedNurse,
    NurseDetail,
    NurseLoadItem,
} from "@/lib/admin-users-schemas"

type NurseListResponse = { nurses: NurseLoadItem[] }
type NurseDetailResponse = { nurse: NurseDetail }

const EMPTY_LIST: NurseListResponse = { nurses: [] }

/** Champs du formulaire de création — confirmPassword suit le mot de passe. */
type CreateNurseForm = {
    fullName: string
    phone: string
    zone: string
    password: string
    confirmPassword: string
}

const EMPTY_FORM: CreateNurseForm = {
    fullName: "",
    phone: "",
    zone: "",
    password: "",
    confirmPassword: "",
}

/**
 * Sentinelle du Select de zone : Radix bascule en avertissement React
 * « uncontrolled → controlled » si la valeur passée de `undefined` à une
 * zone. Une entrée désactivée garde le composant TOUJOURS contrôlé et
 * affiche « Choisir une zone » tant que rien n'est sélectionné.
 */
const ZONE_UNSET = "__unset__"

// ——— Constantes design (maquette PO) ———

// Pastille d'avatar initiales — teinte déterministe par nom (maquette :
// initiales colorées diverses). Identique aux vues Missions / Patients.
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

// Badge de zone coloré (maquette : Yopougon bleu…) — une teinte par zone de
// l'app, lisible en clair comme en sombre. Identique à la vue Patients.
const ZONE_BADGE_CLASSES: Record<string, string> = {
    YOPOUGON: "bg-primary/10 text-primary",
    SONGON: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    PK22: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
    NDOTRE: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
}

function zoneBadgeClass(zone: string): string {
    return ZONE_BADGE_CLASSES[zone] ?? "bg-muted text-muted-foreground"
}

/**
 * Matricule affichable, dérivé de l'identifiant réel (stable, unique) — la
 * maquette affiche « #IDE-123 », la base n'a pas de champ matricule : on le
 * compose depuis les 3 derniers caractères de l'ID.
 */
function matriculeOf(id: string): string {
    return `#IDE-${id.slice(-3).toUpperCase()}`
}

// ——— Formatage (Abidjan = UTC+0 : composantes UTC, convention
// src/lib/datetime.ts — stable quel que soit le fuseau de l'appareil) ———

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * « Auj. 08:30 » · « Hier 15:00 » · « 5 oct. » — dernière tournée (compact,
 * adaptation des helpers slotShortLabel / relativeDayLabel de patients-view).
 */
function lastTourLabel(iso: string, now: Date = new Date()): string {
    const diff = calendarDayDiffUTC(iso, now)
    if (diff === 0) return `Auj. ${formatTimeUTC(iso)}`
    if (diff === -1) return `Hier ${formatTimeUTC(iso)}`
    return capitalize(
        new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
        }).format(new Date(iso)),
    )
}

/** Recherche insensible à la casse et aux accents (annuaire ivoirien :
    « Koné » ≈ « kone », « N'Guessan » ≈ « nguessan »). */
function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
}

// ——— Tri ———

type SortOption = "charge" | "nom" | "recents"

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: "charge", label: "Trier : Charge" },
    { id: "nom", label: "Trier : Nom (A-Z)" },
    { id: "recents", label: "Trier : Plus récents" },
]

const ALPHA = (a: NurseLoadItem, b: NurseLoadItem) =>
    a.fullName.localeCompare(b.fullName)

/** Filtre de disponibilité — sémantique maquette : Disponible = actif sans
    mission en cours ; En tournée = actif avec au moins une mission. Les
    comptes suspendus ne tombent dans aucune des deux cases (ils restent
    visibles sous « Tous », leur badge « Suspendu » l'indique). */
type AvailabilityFilter = "all" | "disponibles" | "tournee"

/**
 * Chip de filtre pillée (maquette) — point coloré optionnel (disponibilité),
 * compteur optionnel (les chips de zone de la maquette n'en ont pas).
 */
function FilterChip({
    label,
    active,
    onClick,
    count,
    dot,
}: {
    label: string
    active: boolean
    onClick: () => void
    count?: number
    dot?: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                active
                    ? "border-transparent bg-foreground text-background"
                    : "border-border bg-card text-foreground hover:bg-muted/60"
            }`}
        >
            {dot && (
                <span
                    className={`size-1.5 rounded-full ${dot}`}
                    aria-hidden="true"
                />
            )}
            {label}
            {count !== undefined && (
                <span
                    className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                        active
                            ? "bg-background/20"
                            : "bg-muted text-muted-foreground"
                    }`}
                >
                    {count}
                </span>
            )}
        </button>
    )
}

/**
 * Workflow complet de création d'un infirmier (demande PO 2026-10) :
 * 1. le Médecin Chef saisit identité + téléphone + zone et choisit un mot de
 *    passe — ou le laisse générer (alphabet sans caractères ambigus) ;
 * 2. le compte NURSE est créé ACTIF : l'infirmier peut se connecter
 *    immédiatement avec son numéro (aucune étape d'activation) ;
 * 3. le mot de passe généré n'est affiché qu'une fois, prêt à communiquer ;
 *    l'annuaire se recharge en arrière-plan et l'infirmier est déjà affectable
 *    par le dispatch (vue Équipes / Missions).
 */
function CreateNurseDialog({
    open,
    onOpenChange,
    onCreated,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: () => void | Promise<void>
}) {
    const [form, setForm] = useState<CreateNurseForm>(EMPTY_FORM)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [globalError, setGlobalError] = useState<string | undefined>(undefined)
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState<{
        nurse: CreatedNurse
        generatedPassword: string | null
    } | null>(null)
    const [copied, setCopied] = useState(false)

    // Réouverture = formulaire vierge : deux créations successives ne doivent
    // jamais se contaminer (nom résiduel, zone présélectionnée par erreur).
    useEffect(() => {
        if (open) {
            setForm(EMPTY_FORM)
            setFieldErrors({})
            setGlobalError(undefined)
            setSuccess(null)
            setCopied(false)
        }
    }, [open])

    function setField<K extends keyof CreateNurseForm>(key: K, value: string) {
        setForm(current => ({ ...current, [key]: value }))
        // Efface l'erreur du champ dès la correction — pas de message périmé.
        setFieldErrors(current => {
            if (!current[key]) return current
            const next = { ...current }
            delete next[key]
            return next
        })
    }

    async function submit() {
        setSubmitting(true)
        setGlobalError(undefined)
        setFieldErrors({})
        try {
            const payload = {
                fullName: form.fullName,
                phone: form.phone,
                zone: form.zone,
                // Mot de passe vide = génération serveur ; confirmPassword ne
                // suit que si un mot de passe manuel est saisi.
                ...(form.password
                    ? { password: form.password, confirmPassword: form.confirmPassword }
                    : {}),
            }
            const parsed = createNurseSchema.safeParse(payload)
            if (!parsed.success) {
                setFieldErrors(zodIssuesToFieldErrors(parsed.error))
                return
            }

            const res = await fetch("/api/admin/nurses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(parsed.data),
            })
            const body = (await res.json().catch(() => ({}))) as {
                nurse?: CreatedNurse
                generatedPassword?: string | null
                error?: string
                details?: { field: string; message: string }[]
            }

            if (res.status === 201 && body.nurse) {
                setSuccess({
                    nurse: body.nurse,
                    generatedPassword: body.generatedPassword ?? null,
                })
                void hapticSuccess()
                toast({
                    title: "Infirmier créé",
                    description: `${body.nurse.fullName} peut se connecter dès maintenant.`,
                })
                // L'annuaire se recharge en arrière-plan : à la fermeture du
                // dialog, la nouvelle ligne est déjà là.
                await onCreated()
                return
            }

            if (res.status === 400 && body.details) {
                const errors: Record<string, string> = {}
                for (const detail of body.details) {
                    if (typeof detail.field === "string" && !(detail.field in errors)) {
                        errors[detail.field] = detail.message
                    }
                }
                setFieldErrors(errors)
                return
            }

            setGlobalError(
                body.error ?? "Création impossible — réessayez dans un instant.",
            )
        } catch {
            setGlobalError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez.",
            )
        } finally {
            setSubmitting(false)
        }
    }

    async function copyPassword() {
        if (!success?.generatedPassword) return
        try {
            await navigator.clipboard.writeText(success.generatedPassword)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Presse-papiers indisponible (permission refusée, WebView ancien) :
            // le mot de passe reste visible dans le bloc, rien ne bloque.
        }
    }

    const nurse = success?.nurse ?? null

    return (
        <Dialog open={open} onOpenChange={next => !submitting && onOpenChange(next)}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
                {nurse ? (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CircleCheck
                                    className="size-5 text-success"
                                    aria-hidden="true"
                                />
                                Infirmier créé
                            </DialogTitle>
                            <DialogDescription>
                                <strong>{nurse.fullName}</strong> peut se connecter dès
                                maintenant avec ce numéro
                                {success?.generatedPassword
                                    ? " et le mot de passe temporaire ci-dessous."
                                    : " et le mot de passe que vous avez défini."}
                            </DialogDescription>
                        </DialogHeader>

                        <dl className="grid gap-2 rounded-2xl border bg-muted/40 p-4 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Nom</dt>
                                <dd className="font-semibold">{nurse.fullName}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Téléphone</dt>
                                <dd className="font-semibold">
                                    {formatPhoneDisplay(nurse.phone)}
                                </dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-muted-foreground">Zone</dt>
                                <dd className="font-semibold">
                                    {ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ??
                                        nurse.zone}
                                </dd>
                            </div>
                        </dl>

                        {success?.generatedPassword && (
                            <div className="grid gap-2">
                                <p className="text-sm font-semibold">
                                    Mot de passe temporaire
                                </p>
                                <div className="flex items-center gap-2">
                                    <code className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 font-mono text-sm tracking-wider select-all">
                                        {success.generatedPassword}
                                    </code>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() => void copyPassword()}
                                        className="size-10 shrink-0 rounded-xl"
                                        aria-label="Copier le mot de passe temporaire"
                                    >
                                        {copied ? (
                                            <Check className="size-4 text-success" aria-hidden="true" />
                                        ) : (
                                            <Copy className="size-4" aria-hidden="true" />
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    À communiquer à l&apos;infirmier — il ne sera plus affiché.
                                    Il pourra le modifier dans son profil (Mon profil →
                                    Sécurité).
                                </p>
                            </div>
                        )}

                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSuccess(null)
                                    setForm(EMPTY_FORM)
                                }}
                                className="h-10 rounded-xl font-semibold"
                            >
                                <UserRoundPlus className="size-4" aria-hidden="true" />
                                Créer un autre
                            </Button>
                            <Button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className="h-10 rounded-xl font-semibold"
                            >
                                Terminer
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <UserRoundPlus
                                    className="size-5 text-primary"
                                    aria-hidden="true"
                                />
                                Ajouter un infirmier
                            </DialogTitle>
                            <DialogDescription>
                                Le compte est créé actif : l&apos;infirmier rejoint
                                immédiatement l&apos;annuaire, se connecte avec son numéro et
                                peut recevoir des missions.
                            </DialogDescription>
                        </DialogHeader>

                        {globalError && (
                            <p
                                role="alert"
                                className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                            >
                                {globalError}
                            </p>
                        )}

                        <div className="grid gap-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="nurse-create-fullname">Nom complet</Label>
                                <Input
                                    id="nurse-create-fullname"
                                    value={form.fullName}
                                    onChange={event => setField("fullName", event.target.value)}
                                    placeholder="Ex : Aya Konan"
                                    autoComplete="off"
                                    className="h-10 rounded-xl"
                                    aria-invalid={fieldErrors.fullName ? true : undefined}
                                />
                                {fieldErrors.fullName && (
                                    <p className="text-xs text-destructive">
                                        {fieldErrors.fullName}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="nurse-create-phone">Téléphone</Label>
                                <Input
                                    id="nurse-create-phone"
                                    type="tel"
                                    inputMode="tel"
                                    value={form.phone}
                                    onChange={event => setField("phone", event.target.value)}
                                    placeholder="+225 07 00 00 00 00"
                                    autoComplete="off"
                                    className="h-10 rounded-xl"
                                    aria-invalid={fieldErrors.phone ? true : undefined}
                                />
                                {fieldErrors.phone && (
                                    <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="nurse-create-zone">Zone d&apos;intervention</Label>
                                <Select
                                    value={form.zone || ZONE_UNSET}
                                    onValueChange={value => setField("zone", value)}
                                >
                                    <SelectTrigger
                                        id="nurse-create-zone"
                                        className="h-10 w-full rounded-xl"
                                        aria-invalid={fieldErrors.zone ? true : undefined}
                                    >
                                        <SelectValue placeholder="Choisir une zone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ZONE_UNSET} disabled>
                                            Choisir une zone
                                        </SelectItem>
                                        {ZONES.map(zone => (
                                            <SelectItem key={zone} value={zone}>
                                                {ZONE_LABELS[zone]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldErrors.zone && (
                                    <p className="text-xs text-destructive">{fieldErrors.zone}</p>
                                )}
                            </div>

                            <div className="grid gap-1.5">
                                <Label htmlFor="nurse-create-password">
                                    Mot de passe{" "}
                                    <span className="font-normal text-muted-foreground">
                                        (optionnel — généré si vide)
                                    </span>
                                </Label>
                                <Input
                                    id="nurse-create-password"
                                    type="password"
                                    value={form.password}
                                    onChange={event => setField("password", event.target.value)}
                                    autoComplete="new-password"
                                    className="h-10 rounded-xl"
                                    aria-invalid={fieldErrors.password ? true : undefined}
                                />
                                {fieldErrors.password && (
                                    <p className="text-xs text-destructive">
                                        {fieldErrors.password}
                                    </p>
                                )}
                            </div>

                            {form.password && (
                                <div className="grid gap-1.5">
                                    <Label htmlFor="nurse-create-confirm">
                                        Confirmer le mot de passe
                                    </Label>
                                    <Input
                                        id="nurse-create-confirm"
                                        type="password"
                                        value={form.confirmPassword}
                                        onChange={event =>
                                            setField("confirmPassword", event.target.value)
                                        }
                                        autoComplete="new-password"
                                        className="h-10 rounded-xl"
                                        aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                                    />
                                    {fieldErrors.confirmPassword && (
                                        <p className="text-xs text-destructive">
                                            {fieldErrors.confirmPassword}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={submitting}
                                className="h-10 rounded-xl"
                            >
                                Annuler
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void submit()}
                                disabled={submitting}
                                className="h-10 gap-2 rounded-xl font-semibold"
                            >
                                {submitting && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                {submitting ? "Création…" : "Créer l'infirmier"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

/** Fiche infirmier : identité, compteurs de charge, historique de missions. */
function NurseSheet({
    nurseId,
    onClose,
}: {
    nurseId: string | null
    onClose: () => void
}) {
    const { data, loading, error, reload } = useAdminResource<NurseDetailResponse>(
        nurseId === null ? null : `/api/admin/nurses/${nurseId}`,
    )

    const nurse = data?.nurse.nurse
    const missions = data?.nurse.missions ?? []
    const [completedOnly, setCompletedOnly] = useState(false)

    // Une mission terminée n'est plus un sujet de supervision : on la masque par
    // défaut et on laisse un toggle pour l'historique.
    const visible = useMemo(
        () =>
            completedOnly
                ? missions
                : missions.filter(mission => mission.status !== "COMPLETED"),
        [missions, completedOnly],
    )

    return (
        <Dialog open={nurseId !== null} onOpenChange={open => !open && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Activity className="size-5 text-primary" aria-hidden="true" />
                        {nurse ? nurse.fullName : "Fiche infirmier"}
                    </DialogTitle>
                    <DialogDescription>
                        {nurse
                            ? `${ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ?? nurse.zone} · ${nurse.phone}`
                            : "Chargement de la fiche…"}
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <LoadError onRetry={() => void reload()} />
                ) : loading && nurse === undefined ? (
                    <div className="grid gap-3" aria-busy="true">
                        <Skeleton className="h-20 rounded-2xl" aria-hidden="true" />
                        <Skeleton className="h-40 rounded-2xl" aria-hidden="true" />
                    </div>
                ) : nurse ? (
                    <>
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                                { label: "Missions en cours", value: nurse.activeMissions },
                                { label: "Sans acceptation", value: nurse.pendingAcceptance },
                                { label: "Ce mois-ci", value: nurse.completedThisMonth },
                                { label: "Total terminées", value: nurse.completedTotal },
                            ].map(stat => (
                                <li key={stat.label} className="rounded-xl border bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-lg font-semibold tabular-nums">{stat.value}</p>
                                </li>
                            ))}
                        </ul>

                        {nurse.pendingAcceptance > 0 && (
                            <p
                                role="status"
                                className="rounded-xl bg-warning/20 px-3 py-2 text-sm text-warning-foreground"
                            >
                                {nurse.pendingAcceptance} mission(s) attendent une acceptation —
                                affectées mais pas encore prises en charge.
                            </p>
                        )}

                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Missions</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCompletedOnly(!completedOnly)}
                                className="h-9 gap-2 rounded-xl text-sm"
                            >
                                {completedOnly ? "Masquer" : "Afficher"} les terminées
                            </Button>
                        </div>

                        {visible.length === 0 ? (
                            <p className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                {completedOnly
                                    ? "Aucune mission enregistrée."
                                    : "Aucune mission en cours — l'infirmier est disponible."}
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {visible.map(mission => (
                                    <li
                                        key={mission.id}
                                        className="rounded-2xl border bg-card p-4 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-semibold">
                                                    {mission.patient.fullName}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatDateUTC(mission.scheduledAt)}
                                                </p>
                                            </div>
                                            <Badge
                                                className={
                                                    MISSION_STATUS_CLASSES[mission.status] ??
                                                    "bg-muted text-muted-foreground"
                                                }
                                            >
                                                {MISSION_STATUS_LABELS[mission.status] ?? mission.status}
                                            </Badge>
                                        </div>

                                        {mission.appointment.reason && (
                                            <p className="mt-2 text-sm">
                                                <span className="text-muted-foreground">Motif : </span>
                                                {mission.appointment.reason}
                                            </p>
                                        )}

                                        {mission.report && (
                                            <div className="mt-2 rounded-xl bg-muted/40 p-3 text-sm">
                                                <p className="flex items-center gap-1 font-semibold">
                                                    <FileText className="size-3.5" aria-hidden="true" />
                                                    Compte rendu
                                                </p>
                                                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                                    {mission.report.observations}
                                                </p>
                                                {mission.report.actionsTaken && (
                                                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                                                        <span className="font-semibold text-foreground">
                                                            Actions :{" "}
                                                        </span>
                                                        {mission.report.actionsTaken}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

/**
 * Badge de disponibilité (maquette) : pilule verte à point « Disponible »,
 * pilule primaire « N mission(s) » ou pilule destructive « Suspendu ».
 */
function AvailabilityBadge({ nurse }: { nurse: NurseLoadItem }) {
    if (!nurse.isActive) {
        return (
            <Badge className="rounded-full bg-destructive/10 px-2.5 text-[11px] font-bold text-destructive hover:bg-destructive/10">
                Suspendu
            </Badge>
        )
    }
    if (nurse.activeMissions > 0) {
        return (
            <Badge className="rounded-full bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10">
                {nurse.activeMissions} mission{nurse.activeMissions > 1 ? "s" : ""}
            </Badge>
        )
    }
    return (
        <Badge className="gap-1.5 rounded-full bg-success/15 px-2.5 text-[11px] font-bold text-success-foreground dark:text-success hover:bg-success/15">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Disponible
        </Badge>
    )
}

/**
 * Barre de charge journalière (maquette) — dérivation transparente : la base
 * ne stocke aucune capacité, la charge est issue du nombre de missions
 * (4 missions ouvertes = 100 %). La teinte suit l'occupation : le Médecin
 * Chef doit voir avant d'affecter si un soignant a de la marge.
 */
function LoadBar({ nurse }: { nurse: NurseLoadItem }) {
    if (!nurse.isActive) return null

    const pct = Math.min(100, (nurse.activeMissions + nurse.pendingAcceptance) * 25)
    const tone =
        pct === 0
            ? { bar: "bg-success", label: "Disponible" }
            : pct < 50
              ? { bar: "bg-success", label: "Légère" }
              : pct < 75
                ? { bar: "bg-warning", label: "Modérée" }
                : { bar: "bg-destructive", label: "Élevée" }

    return (
        <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                    Charge journalière
                </span>
                <span className="text-[11px] font-bold tabular-nums">
                    {pct}% ({tone.label})
                </span>
            </div>
            <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Charge de missions"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className={`h-full rounded-full ${tone.bar}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

/**
 * Carte infirmier (maquette) : avatar initiales, nom + matricule dérivé,
 * téléphone cliquable, badges zone + disponibilité, barre de charge,
 * bandeau de stats et actions (fiche / appel / SMS / ⋮ suspension).
 */
function NurseCard({
    nurse,
    onOpen,
    onToggleActive,
}: {
    nurse: NurseLoadItem
    onOpen: () => void
    onToggleActive: () => void
}) {
    const now = new Date()

    return (
        <li className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(nurse.fullName)}`}
                    aria-hidden="true"
                >
                    {initialsOf(nurse.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            {/* Nom sur 1–2 lignes (maquette) : le wrap évite aussi
                                que le texte alimente la largeur intrinsèque de la
                                carte (truncate = débordement grille sur mobile). */}
                            <p className="min-w-0 text-[15px] font-bold leading-tight">
                                {nurse.fullName}{" "}
                                <span className="text-[11px] font-semibold text-muted-foreground">
                                    {matriculeOf(nurse.id)}
                                </span>
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                Infirmier diplômé d&apos;État (IDE)
                            </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <Badge
                                className={`gap-1 rounded-full px-2.5 text-[11px] font-bold ${zoneBadgeClass(nurse.zone)}`}
                            >
                                <MapPin className="size-3" aria-hidden="true" />
                                {ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ??
                                    nurse.zone}
                            </Badge>
                            <AvailabilityBadge nurse={nurse} />
                        </div>
                    </div>
                    <a
                        href={`tel:${nurse.phone}`}
                        className="mt-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {formatPhoneDisplay(nurse.phone)}
                    </a>
                </div>
            </div>

            {/* Charge journalière — masquée pour un compte suspendu. */}
            <LoadBar nurse={nurse} />

            {/* Bandeau de stats (maquette : 3 colonnes séparées). */}
            <dl className="mt-3 grid grid-cols-3 divide-x divide-border rounded-xl border bg-muted/30 text-center">
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">En cours</dt>
                    <dd className="mt-0.5 truncate text-xs font-bold sm:text-sm">
                        {nurse.activeMissions}
                        {nurse.pendingAcceptance > 0 &&
                            ` (+${nurse.pendingAcceptance} en att.)`}
                    </dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">Ce mois</dt>
                    <dd className="mt-0.5 truncate text-xs font-bold sm:text-sm">
                        {nurse.completedThisMonth} soin
                        {nurse.completedThisMonth > 1 ? "s" : ""}
                    </dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">
                        Dernière tournée
                    </dt>
                    {/* Date relative : le rendu serveur peut différer d'un
                        cheveu du rendu client → suppressHydrationWarning. */}
                    <dd
                        className="mt-0.5 truncate text-xs font-bold sm:text-sm"
                        suppressHydrationWarning
                    >
                        {nurse.lastMissionAt ? (
                            lastTourLabel(nurse.lastMissionAt, now)
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </dd>
                </div>
            </dl>

            <div className="mt-3.5 flex items-center gap-2">
                <Button
                    size="sm"
                    variant="outline"
                    onClick={onOpen}
                    className="h-10 flex-1 gap-2 rounded-xl border-primary/30 bg-primary/10 text-xs font-bold text-primary hover:bg-primary/15 hover:text-primary"
                >
                    <BadgeCheck className="size-4" aria-hidden="true" />
                    Fiche soignant
                    <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="size-10 shrink-0 rounded-xl p-0"
                >
                    <a href={`tel:${nurse.phone}`} aria-label={`Appeler ${nurse.fullName}`}>
                        <Phone className="size-4" aria-hidden="true" />
                    </a>
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="size-10 shrink-0 rounded-xl p-0"
                >
                    <a
                        href={`sms:${nurse.phone}`}
                        aria-label={`Envoyer un SMS à ${nurse.fullName}`}
                    >
                        <MessageSquare className="size-4" aria-hidden="true" />
                    </a>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className="size-10 shrink-0 rounded-xl p-0"
                            aria-label={`Autres actions pour ${nurse.fullName}`}
                        >
                            <MoreVertical className="size-4" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onToggleActive}>
                            {nurse.isActive ? "Suspendre le compte" : "Réactiver le compte"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </li>
    )
}

export function AdminNursesView() {
    const [search, setSearch] = useState("")
    const [availability, setAvailability] = useState<AvailabilityFilter>("all")
    const [zone, setZone] = useState("all")
    const [sort, setSort] = useState<SortOption>("charge")
    const [openNurse, setOpenNurse] = useState<string | null>(null)
    const [createOpen, setCreateOpen] = useState(false)

    // Nouvelle stratégie (maquette) : un seul fetch SANS paramètre, puis
    // filtre / tri / compteurs 100 % clients — la liste est petite et les
    // compteurs des chips restent stables pendant la recherche (pattern
    // Patients : effectifs globaux, insensibles à la saisie).
    const { data, loading, error, reload } =
        useAdminResource<NurseListResponse>("/api/admin/nurses")
    const nurses = data?.nurses ?? EMPTY_LIST.nurses

    const suspension = useAccountSuspension(reload)

    // Compteurs des chips de disponibilité — calculés localement. Les
    // suspendus ne comptent dans aucune des deux cases actives : ils restent
    // visibles sous « Tous » (leur badge « Suspendu » l'indique sur la carte).
    const availabilityCounts = useMemo(
        () => ({
            all: nurses.length,
            disponibles: nurses.filter(
                nurse => nurse.isActive && nurse.activeMissions === 0,
            ).length,
            tournee: nurses.filter(
                nurse => nurse.isActive && nurse.activeMissions > 0,
            ).length,
        }),
        [nurses],
    )

    // Effectif actif de l'annuaire — badge de la ligne de résultat.
    const activeTotal = useMemo(
        () => nurses.filter(nurse => nurse.isActive).length,
        [nurses],
    )

    // Filtre + tri clients (aucun paramètre serveur).
    const visible = useMemo(() => {
        const needle = normalize(search.trim())
        const compact = needle.replace(/\s+/g, "")

        const filtered = nurses.filter(nurse => {
            if (
                availability === "disponibles" &&
                !(nurse.isActive && nurse.activeMissions === 0)
            ) {
                return false
            }
            if (
                availability === "tournee" &&
                !(nurse.isActive && nurse.activeMissions > 0)
            ) {
                return false
            }
            if (zone !== "all" && nurse.zone !== zone) return false
            if (needle !== "") {
                const inName = normalize(nurse.fullName).includes(needle)
                const inPhone = compact !== "" && nurse.phone.includes(compact)
                const inRef = matriculeOf(nurse.id)
                    .toLowerCase()
                    .includes(needle)
                if (!inName && !inPhone && !inRef) return false
            }
            return true
        })

        if (sort === "nom") return [...filtered].sort(ALPHA)
        if (sort === "recents") {
            return [...filtered].sort(
                (a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            )
        }
        // Charge : les actifs d'abord, du plus chargé au moins chargé —
        // l'ordre de décision du dispatch ; les suspendus ferment la marche.
        return [...filtered].sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1
            if (b.activeMissions !== a.activeMissions) {
                return b.activeMissions - a.activeMissions
            }
            return ALPHA(a, b)
        })
    }, [nurses, search, availability, zone, sort])

    return (
        <div className="flex flex-col gap-4">
            {/* ——— CTA pleine largeur (maquette) — l'onboarding d'un soignant
                est le point d'entrée de la vue ——— */}
            <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="h-11 w-full gap-2 rounded-xl font-bold"
            >
                <UserRoundPlus className="size-4" aria-hidden="true" />
                Ajouter un infirmier
            </Button>

            {error && data === null ? (
                <LoadError onRetry={() => void reload()} />
            ) : loading && data === null ? (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Chargement de l'annuaire"
                >
                    <Skeleton className="h-11 w-full rounded-xl" aria-hidden="true" />
                    <Skeleton className="h-11 rounded-full" aria-hidden="true" />
                    <div className="flex gap-2">
                        {[0, 1, 2].map(index => (
                            <Skeleton
                                key={index}
                                className="h-8 w-24 rounded-full"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        {[0, 1, 2].map(index => (
                            <Skeleton
                                key={index}
                                className="h-8 w-20 rounded-full"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    {[0, 1].map(index => (
                        <Skeleton
                            key={index}
                            className="h-[260px] rounded-2xl"
                            aria-hidden="true"
                        />
                    ))}
                </div>
            ) : (
                <>
                    {/* ——— Recherche pillée (pattern Patients) ——— */}
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Rechercher nom, téléphone, matricule…"
                            aria-label="Rechercher un infirmier par nom, téléphone ou matricule"
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

                    {/* ——— Chips de disponibilité (maquette : 3 seulement) ——— */}
                    <div
                        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filtrer par disponibilité"
                    >
                        <FilterChip
                            label="Tous"
                            active={availability === "all"}
                            onClick={() => setAvailability("all")}
                            count={availabilityCounts.all}
                        />
                        <FilterChip
                            label="Disponibles"
                            active={availability === "disponibles"}
                            onClick={() => setAvailability("disponibles")}
                            count={availabilityCounts.disponibles}
                            dot="bg-success"
                        />
                        <FilterChip
                            label="En tournée"
                            active={availability === "tournee"}
                            onClick={() => setAvailability("tournee")}
                            count={availabilityCounts.tournee}
                            dot="bg-orange-500"
                        />
                    </div>

                    {/* ——— Chips de zone (maquette : sans compteur) ——— */}
                    <div
                        className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filtrer par zone"
                    >
                        <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                            Zone :
                        </span>
                        <FilterChip
                            label="Toutes"
                            active={zone === "all"}
                            onClick={() => setZone("all")}
                        />
                        {(Object.keys(ZONE_LABELS) as (keyof typeof ZONE_LABELS)[]).map(
                            zoneKey => (
                                <FilterChip
                                    key={zoneKey}
                                    label={ZONE_LABELS[zoneKey]}
                                    active={zone === zoneKey}
                                    onClick={() => setZone(zoneKey)}
                                />
                            ),
                        )}
                    </div>

                    {/* ——— Ligne de résultat : effectif + tri + refresh ——— */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            className="rounded-full bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                            aria-live="polite"
                        >
                            {activeTotal} soignant{activeTotal > 1 ? "s" : ""} actif
                            {activeTotal > 1 ? "s" : ""} répertorié
                            {activeTotal > 1 ? "s" : ""}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                            {visible.length} affiché{visible.length > 1 ? "s" : ""}
                        </p>
                        <div className="ml-auto flex items-center gap-2">
                            <Select
                                value={sort}
                                onValueChange={value => setSort(value as SortOption)}
                            >
                                <SelectTrigger
                                    aria-label="Trier l'annuaire des infirmiers"
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
                                onClick={() => void reload()}
                                aria-label="Rafraîchir l'annuaire"
                                className="size-8 shrink-0 rounded-full"
                            >
                                <RefreshCw
                                    className={`size-4 ${loading ? "animate-spin" : ""}`}
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                    </div>

                    {/* ——— Liste des soignants ——— */}
                    {!loading && visible.length === 0 ? (
                        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                            <ClipboardList
                                className="mx-auto size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="mt-2 text-sm font-medium">
                                Aucun infirmier ne correspond.
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Élargissez la recherche, changez de zone ou de
                                disponibilité — ou ajoutez un nouvel infirmier avec le
                                bouton « Ajouter un infirmier ».
                            </p>
                        </div>
                    ) : (
                        <ul
                            className={`grid gap-3 transition-opacity ${
                                loading ? "opacity-60" : ""
                            }`}
                            aria-busy={loading}
                        >
                            {visible.map(nurse => (
                                <NurseCard
                                    key={nurse.id}
                                    nurse={nurse}
                                    onOpen={() => setOpenNurse(nurse.id)}
                                    onToggleActive={() => suspension.open(nurse)}
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}

            <NurseSheet nurseId={openNurse} onClose={() => setOpenNurse(null)} />

            <CreateNurseDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={() => reload()}
            />

            <SuspendAccountDialog
                target={suspension.target}
                busy={suspension.busy}
                error={suspension.error}
                onOpenChange={suspension.setOpen}
                onSubmit={isActive => void suspension.submit(isActive)}
            />
        </div>
    )
}
