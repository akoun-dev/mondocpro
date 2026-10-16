"use client"

// Vue « Patients » du Médecin Chef — FEATURE-ANNUAIRE-ADMIN,
// redesign maquette PO 2026-10 (maquette mobile Patients) :
//   1. Recherche serveur (nom / téléphone, anti-rebond) avec bouton d'effacement ;
//   2. Chips de filtre par zone avec effectifs (« Toutes les zones (124) »,
//      « Yopougon 42 »…) — compteurs globaux, insensibles à la recherche ;
//   3. Ligne de résultat « X affichés sur Y dossiers » + filtre d'état de
//      compte (Tous / Actifs / Suspendus) + tri (Dernier passage / Nom /
//      Prochain RDV) ;
//   4. Cartes patient (maquette) : avatar initiales colorées, badge d'état de
//      compte, badge de zone coloré, âge + référence de dossier, téléphone
//      cliquable, bannière ambre « motif du prochain RDV », bandeau de stats
//      (Consultations / Dernière visite / Prochain RDV), actions « Ouvrir le
//      dossier » + appel + menu ⋮ (suspension de compte préservée) ;
//   5. Dossier : historique des consultations filtrable (période + statut),
//      compte rendu de visite replié.
// Deux appels : GET /api/admin/patients (liste + compteurs globaux) puis
// GET /api/admin/patients/:id à l'ouverture d'un dossier (chargement différé —
// l'historique n'est utile que pour le dossier consulté).
import { useEffect, useMemo, useState } from "react"
import {
    ChevronRight,
    FileText,
    FolderOpen,
    HeartPulse,
    MapPin,
    MoreVertical,
    Phone,
    RefreshCw,
    Search,
    Stethoscope,
    TriangleAlert,
    X,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    adminQuery,
    useAccountSuspension,
    useAdminResource,
} from "@/components/admin/admin-directory-shared"
import {
    calendarDayDiffUTC,
    formatDateUTC,
    formatTimeUTC,
} from "@/lib/datetime"
import { formatPhoneDisplay } from "@/lib/phone"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import {
    ACCOUNT_FILTER,
    ACCOUNT_FILTER_LABELS,
    ACCOUNT_PERIOD,
    ACCOUNT_PERIOD_LABELS,
    HISTORY_STATUS_CLASSES,
    HISTORY_STATUS_LABELS,
    HISTORY_STATUS_SHORT,
    APPOINTMENT_TYPE_LABELS,
    type AccountFilterValue,
    type AccountPeriodValue,
    type HistoryStatusValue,
    type PatientConsultation,
    type PatientDetail,
    type PatientDirectory,
    type PatientListItem,
} from "@/lib/admin-users-schemas"

// ——— Constantes design (maquette PO) ———

// Pastille d'avatar initiales — teinte déterministe par nom (maquette :
// initiales colorées diverses). Identique à la vue Missions pour la cohérence.
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

// Badge de zone coloré (maquette : Yopougon bleu, Cocody ambre…) — une teinte
// par zone de l'app, lisible en clair comme en sombre.
const ZONE_BADGE_CLASSES: Record<string, string> = {
    YOPOUGON: "bg-primary/10 text-primary",
    SONGON: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    PK22: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
    NDOTRE: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
}

function zoneBadgeClass(zone: string): string {
    return ZONE_BADGE_CLASSES[zone] ?? "bg-muted text-muted-foreground"
}

// ——— Formatage (Abidjan = UTC+0 : composantes UTC, convention
// src/lib/datetime.ts — stable quel que soit le fuseau de l'appareil) ———

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** « Aujourd'hui » · « Hier » · « Demain » · « 24 oct. » */
function relativeDayLabel(iso: string, now: Date = new Date()): string {
    const diff = calendarDayDiffUTC(iso, now)
    if (diff === 0) return "Aujourd'hui"
    if (diff === -1) return "Hier"
    if (diff === 1) return "Demain"
    return capitalize(
        new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
        }).format(new Date(iso)),
    )
}

/** « Demain 10:00 » · « Aujourd'hui 08:30 » · « Ven 24 oct. 15:00 » (maquette). */
function slotShortLabel(iso: string, now: Date = new Date()): string {
    const diff = calendarDayDiffUTC(iso, now)
    const time = formatTimeUTC(iso)
    if (diff === 0) return `Aujourd'hui ${time}`
    if (diff === 1) return `Demain ${time}`
    const formatted = new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(new Date(iso))
    return `${capitalize(formatted)} ${time}`
}

/** Âge en années révolues (UTC), ou null si date de naissance absente. */
function ageOf(birthDate: string | null, now: Date = new Date()): number | null {
    if (!birthDate) return null
    const birth = new Date(birthDate)
    let age = now.getUTCFullYear() - birth.getUTCFullYear()
    const month = now.getUTCMonth() - birth.getUTCMonth()
    if (month < 0 || (month === 0 && now.getUTCDate() < birth.getUTCDate())) age--
    return age
}

/**
 * Référence de dossier affichable, dérivée de l'identifiant réel (stable,
 * unique) — la maquette affiche « ID: #PT-2024-089 », la base n'a pas de
 * numéro de dossier dédié : on le compose depuis l'année de création + l'ID.
 */
function dossierRef(patient: PatientListItem): string {
    return `#PT-${patient.createdAt.slice(0, 4)}-${patient.id.slice(-4).toUpperCase()}`
}

// ——— Tri ———

type SortOption = "passage" | "nom" | "rdv"

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: "passage", label: "Tri : Dernier passage" },
    { id: "rdv", label: "Tri : Prochain RDV" },
    { id: "nom", label: "Tri : Nom (A-Z)" },
]

const ALPHA = (a: PatientListItem, b: PatientListItem) =>
    a.fullName.localeCompare(b.fullName)

/** Anti-rebond de la recherche : évite un appel par frappe clavier. */
function useDebounced<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return debounced
}

/** Constantes du compte rendu de visite — l'ordre suit la saisie infirmier. */
const VITAL_SIGNS_LABELS: Record<string, string> = {
    temperature: "Température",
    systolic: "Systolique",
    diastolic: "Diastolique",
    pulse: "Pouls",
    respiratoryRate: "Fréquence respiratoire",
    spo2: "SpO₂",
    glucose: "Glycémie",
    weight: "Poids",
    height: "Taille",
}

function VitalSigns({ value }: { value: unknown }) {
    if (!value || typeof value !== "object") return null
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return null
    return (
        <dl className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-muted/50 px-3 py-2 text-sm">
            {entries.map(([key, raw]) => (
                <div key={key} className="flex items-center gap-1">
                    <dt className="text-muted-foreground">
                        {VITAL_SIGNS_LABELS[key] ?? key}:
                    </dt>
                    <dd className="font-medium tabular-nums">{String(raw)}</dd>
                </div>
            ))}
        </dl>
    )
}

/** Une consultation de l'historique, compte rendu replié par défaut. */
function ConsultationCard({
    consultation,
}: {
    consultation: PatientConsultation
}) {
    const [open, setOpen] = useState(false)
    const { report } = consultation

    return (
        <li className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-semibold">
                        {consultation.specialtyName ?? "Consultation"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {formatDateUTC(consultation.scheduledAt)}
                        {" · "}
                        {APPOINTMENT_TYPE_LABELS[consultation.type] ?? consultation.type}
                        {" · "}
                        {ZONE_LABELS[
                            consultation.zone as keyof typeof ZONE_LABELS
                        ] ?? consultation.zone}
                    </p>
                </div>
                <Badge
                    className={
                        HISTORY_STATUS_CLASSES[consultation.status] ??
                        "bg-muted text-muted-foreground"
                    }
                >
                    {HISTORY_STATUS_SHORT[consultation.status] ?? consultation.status}
                </Badge>
            </div>

            {consultation.reason && (
                <p className="mt-2 text-sm">
                    <span className="text-muted-foreground">Motif : </span>
                    {consultation.reason}
                </p>
            )}

            {consultation.nurse && (
                <p className="mt-1 text-sm text-muted-foreground">
                    Intervenant(e) : {consultation.nurse.fullName}
                </p>
            )}

            {report && (
                <div className="mt-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(!open)}
                        className="h-9 gap-2 rounded-xl px-3 text-sm font-semibold"
                        aria-expanded={open}
                    >
                        <FileText className="size-4" aria-hidden="true" />
                        {open ? "Masquer le compte rendu" : "Lire le compte rendu"}
                    </Button>

                    {open && (
                        <div className="mt-2 grid gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
                            <div>
                                <p className="font-semibold">Observations</p>
                                <p className="whitespace-pre-wrap text-muted-foreground">
                                    {report.observations}
                                </p>
                            </div>
                            {report.actionsTaken && (
                                <div>
                                    <p className="font-semibold">Actions menées</p>
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                        {report.actionsTaken}
                                    </p>
                                </div>
                            )}
                            {report.recommendations && (
                                <div>
                                    <p className="font-semibold">Recommandations</p>
                                    <p className="whitespace-pre-wrap text-muted-foreground">
                                        {report.recommendations}
                                    </p>
                                </div>
                            )}
                            <VitalSigns value={report.vitalSigns} />
                            <p className="text-xs text-muted-foreground">
                                Rédigé par {report.nurseName} le {formatDateUTC(report.createdAt)}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </li>
    )
}

/** Dialog de dossier — l'historique se recharge à chaque changement de filtre. */
function PatientDossier({
    patientId,
    onClose,
}: {
    patientId: string | null
    onClose: () => void
}) {
    const [period, setPeriod] = useState<AccountPeriodValue>("all")
    const [status, setStatus] = useState<HistoryStatusValue>("all")

    const url =
        patientId === null
            ? null
            : `/api/admin/patients/${patientId}${adminQuery({
                  period: period === "all" ? undefined : period,
                  status: status === "all" ? undefined : status,
              })}`

    const { data, loading, error, reload } =
        useAdminResource<PatientDetailResponse>(url)

    const record = data?.patient
    const patient = record?.patient

    return (
        <Dialog open={patientId !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Stethoscope className="size-5 text-primary" aria-hidden="true" />
                        {patient ? patient.fullName : "Dossier patient"}
                    </DialogTitle>
                    <DialogDescription>
                        {patient
                            ? `Créé le ${formatDateUTC(patient.createdAt)} · ${patient.phone}`
                            : "Chargement du dossier…"}
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <LoadError onRetry={() => void reload()} />
                ) : loading && patient === undefined ? (
                    <div className="grid gap-3" aria-busy="true">
                        <Skeleton className="h-20 rounded-2xl" aria-hidden="true" />
                        <Skeleton className="h-40 rounded-2xl" aria-hidden="true" />
                    </div>
                ) : patient ? (
                    <>
                        {/* Compteurs globaux — indépendants des filtres : ils décrivent
                            le dossier, pas la sélection courante. */}
                        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {[
                                { label: "Consultations", value: record?.summary.total },
                                { label: "Terminées", value: record?.summary.done },
                                { label: "À venir", value: record?.summary.upcoming },
                                { label: "Domiciles", value: record?.summary.homeVisits },
                            ].map(stat => (
                                <li key={stat.label} className="rounded-xl border bg-muted/40 p-3">
                                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                                    <p className="text-lg font-semibold tabular-nums">
                                        {stat.value ?? 0}
                                    </p>
                                </li>
                            ))}
                        </ul>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5 text-sm font-medium">
                                Période
                                <Select
                                    value={period}
                                    onValueChange={(value) => setPeriod(value as AccountPeriodValue)}
                                >
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ACCOUNT_PERIOD.map(option => (
                                            <SelectItem key={option} value={option}>
                                                {ACCOUNT_PERIOD_LABELS[option]}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </label>

                            <label className="flex flex-col gap-1.5 text-sm font-medium">
                                Statut
                                <Select
                                    value={status}
                                    onValueChange={(value) => setStatus(value as HistoryStatusValue)}
                                >
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(["all", "done", "upcoming", "cancelled"] as const).map(
                                            option => (
                                                <SelectItem key={option} value={option}>
                                                    {HISTORY_STATUS_LABELS[option]}
                                                </SelectItem>
                                            ),
                                        )}
                                    </SelectContent>
                                </Select>
                            </label>
                        </div>

                        {data?.patient.consultations.length === 0 ? (
                            <p className="rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                                Aucune consultation ne correspond à ces filtres.
                            </p>
                        ) : (
                            <ul className="grid gap-3">
                                {record?.consultations.map(consultation => (
                                    <ConsultationCard
                                        key={consultation.id}
                                        consultation={consultation}
                                    />
                                ))}
                            </ul>
                        )}
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

type PatientDetailResponse = { patient: PatientDetail }

/**
 * Carte patient (maquette) : avatar initiales, badges état + zone, âge et
 * référence de dossier, téléphone cliquable, bannière « motif du prochain
 * RDV », bandeau de stats et actions (dossier / appel / ⋮ suspension).
 */
function PatientCard({
    patient,
    onOpen,
    onToggleActive,
}: {
    patient: PatientListItem
    onOpen: () => void
    onToggleActive: () => void
}) {
    const now = new Date()
    const age = ageOf(patient.birthDate, now)

    return (
        <li className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(patient.fullName)}`}
                    aria-hidden="true"
                >
                    {initialsOf(patient.fullName)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        {/* Nom sur 1–2 lignes (maquette) : le wrap évite aussi
                            que le texte alimente la largeur intrinsèque de la
                            carte (truncate = débordement grille sur mobile). */}
                        <p className="min-w-0 text-[15px] font-bold leading-tight">
                            {patient.fullName}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <Badge
                                className={`rounded-full px-2.5 text-[11px] font-bold ${
                                    patient.isActive
                                        ? "bg-success/15 text-success-foreground dark:text-success hover:bg-success/15"
                                        : "bg-destructive/10 text-destructive hover:bg-destructive/10"
                                }`}
                            >
                                {patient.isActive ? "Actif" : "Suspendu"}
                            </Badge>
                            <Badge
                                className={`gap-1 rounded-full px-2.5 text-[11px] font-bold ${zoneBadgeClass(patient.zone)}`}
                            >
                                <MapPin className="size-3" aria-hidden="true" />
                                {ZONE_LABELS[patient.zone as keyof typeof ZONE_LABELS] ??
                                    patient.zone}
                            </Badge>
                        </div>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {age !== null ? `${age} ans · ` : ""}
                        Dossier {dossierRef(patient)}
                    </p>
                    <a
                        href={`tel:${patient.phone}`}
                        className="mt-1 flex w-fit items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                        <Phone className="size-3.5" aria-hidden="true" />
                        {formatPhoneDisplay(patient.phone)}
                    </a>
                </div>
            </div>

            {/* Bannière ambre — motif du prochain RDV (maquette). */}
            {patient.nextVisitReason && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning-foreground dark:text-warning">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                        Prochain RDV : {patient.nextVisitReason}
                    </span>
                </p>
            )}

            {/* Bandeau de stats (maquette : 3 colonnes séparées). */}
            <dl className="mt-3 grid grid-cols-3 divide-x divide-border rounded-xl border bg-muted/30 text-center">
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">
                        Consultations
                    </dt>
                    <dd className="mt-0.5 truncate text-xs font-bold sm:text-sm">
                        {patient.doneCount} visite{patient.doneCount > 1 ? "s" : ""}
                    </dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">
                        Dernière visite
                    </dt>
                    <dd className="mt-0.5 truncate text-xs font-bold sm:text-sm">
                        {patient.lastVisitAt ? (
                            relativeDayLabel(patient.lastVisitAt, now)
                        ) : (
                            <span className="text-muted-foreground">—</span>
                        )}
                    </dd>
                </div>
                <div className="min-w-0 px-2 py-2">
                    <dt className="truncate text-[11px] text-muted-foreground">
                        Prochain RDV
                    </dt>
                    <dd className="mt-0.5 truncate text-xs font-bold sm:text-sm">
                        {patient.nextVisitAt ? (
                            slotShortLabel(patient.nextVisitAt, now)
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
                    <FolderOpen className="size-4" aria-hidden="true" />
                    Ouvrir le dossier
                    <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="size-10 shrink-0 rounded-xl p-0"
                >
                    <a
                        href={`tel:${patient.phone}`}
                        aria-label={`Appeler ${patient.fullName}`}
                    >
                        <Phone className="size-4" aria-hidden="true" />
                    </a>
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className="size-10 shrink-0 rounded-xl p-0"
                            aria-label={`Autres actions pour ${patient.fullName}`}
                        >
                            <MoreVertical className="size-4" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onToggleActive}>
                            {patient.isActive ? "Suspendre le compte" : "Réactiver le compte"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </li>
    )
}

export function AdminPatientsView() {
    const [search, setSearch] = useState("")
    const [zone, setZone] = useState("all")
    const [accountStatus, setAccountStatus] = useState<AccountFilterValue>("all")
    const [sort, setSort] = useState<SortOption>("passage")
    const [openPatient, setOpenPatient] = useState<string | null>(null)

    const debouncedSearch = useDebounced(search)

    const url = `/api/admin/patients${adminQuery({
        search: debouncedSearch || undefined,
        zone: zone === "all" ? undefined : zone,
        status: accountStatus === "all" ? undefined : accountStatus,
    })}`

    const { data, loading, error, reload } =
        useAdminResource<PatientDirectory>(url)
    const patients = data?.patients ?? []
    const total = data?.total ?? 0
    const zoneCounts = data?.zoneCounts ?? {}

    // Tri client (maquette : « Tri : Dernier passage ») — la liste serveur
    // arrive par nom ; on réordonne selon l'option choisie.
    const sorted = useMemo(() => {
        if (sort === "nom") return [...patients].sort(ALPHA)
        if (sort === "rdv") {
            return [...patients].sort((a, b) => {
                if (!a.nextVisitAt && !b.nextVisitAt) return ALPHA(a, b)
                if (!a.nextVisitAt) return 1
                if (!b.nextVisitAt) return -1
                return (
                    new Date(a.nextVisitAt).getTime() -
                    new Date(b.nextVisitAt).getTime()
                )
            })
        }
        // Dernier passage : les dossiers les plus récemment vus d'abord ;
        // ceux jamais consultés ferment la marche (par ordre alphabétique).
        return [...patients].sort((a, b) => {
            if (!a.lastVisitAt && !b.lastVisitAt) return ALPHA(a, b)
            if (!a.lastVisitAt) return 1
            if (!b.lastVisitAt) return -1
            return (
                new Date(b.lastVisitAt).getTime() -
                new Date(a.lastVisitAt).getTime()
            )
        })
    }, [patients, sort])

    const suspension = useAccountSuspension(reload)

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
                    placeholder="Rechercher nom ou téléphone..."
                    aria-label="Rechercher un patient par nom ou téléphone"
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

            {error && data === null ? (
                <LoadError onRetry={() => void reload()} />
            ) : loading && data === null ? (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Chargement de l'annuaire"
                >
                    <Skeleton className="h-11 rounded-full" aria-hidden="true" />
                    <div className="flex gap-2">
                        {[0, 1, 2].map(index => (
                            <Skeleton
                                key={index}
                                className="h-8 w-28 rounded-full"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    {[0, 1, 2].map(index => (
                        <Skeleton
                            key={index}
                            className="h-[190px] rounded-2xl"
                            aria-hidden="true"
                        />
                    ))}
                </div>
            ) : (
                <>
                    {/* ——— Chips de filtre par zone (effectifs globaux) ——— */}
                    <div
                        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filtrer par zone"
                    >
                        <button
                            type="button"
                            onClick={() => setZone("all")}
                            aria-pressed={zone === "all"}
                            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                                zone === "all"
                                    ? "border-transparent bg-foreground text-background"
                                    : "border-border bg-card text-foreground hover:bg-muted/60"
                            }`}
                        >
                            Toutes les zones
                            <span
                                className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                                    zone === "all"
                                        ? "bg-background/20"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {total}
                            </span>
                        </button>
                        {(Object.keys(ZONE_LABELS) as (keyof typeof ZONE_LABELS)[]).map(
                            zoneKey => {
                                const active = zone === zoneKey
                                return (
                                    <button
                                        key={zoneKey}
                                        type="button"
                                        onClick={() => setZone(zoneKey)}
                                        aria-pressed={active}
                                        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                                            active
                                                ? "border-transparent bg-foreground text-background"
                                                : "border-border bg-card text-foreground hover:bg-muted/60"
                                        }`}
                                    >
                                        {ZONE_LABELS[zoneKey]}
                                        <span
                                            className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                                                active
                                                    ? "bg-background/20"
                                                    : "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            {zoneCounts[zoneKey] ?? 0}
                                        </span>
                                    </button>
                                )
                            },
                        )}
                    </div>

                    {/* ——— Ligne de résultat : compteur + état + tri ——— */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge
                            className="rounded-full bg-primary/10 px-2.5 text-[11px] font-bold text-primary hover:bg-primary/10"
                            aria-live="polite"
                        >
                            {patients.length} affiché{patients.length > 1 ? "s" : ""}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                            sur {total} dossier{total > 1 ? "s" : ""}
                        </p>
                        <div className="ml-auto flex items-center gap-2">
                            <Select
                                value={accountStatus}
                                onValueChange={value =>
                                    setAccountStatus(value as AccountFilterValue)
                                }
                            >
                                <SelectTrigger
                                    aria-label="Filtrer par état de compte"
                                    className="h-8 w-auto shrink-0 gap-1 rounded-full border-border bg-card px-3 text-[11px] font-bold"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_FILTER.map(filter => (
                                        <SelectItem key={filter} value={filter}>
                                            {`État : ${ACCOUNT_FILTER_LABELS[filter]}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                value={sort}
                                onValueChange={value => setSort(value as SortOption)}
                            >
                                <SelectTrigger
                                    aria-label="Trier l'annuaire"
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

                    {/* ——— Liste des dossiers ——— */}
                    {!loading && patients.length === 0 ? (
                        <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                            <HeartPulse
                                className="mx-auto size-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="mt-2 text-sm font-medium">
                                Aucun patient ne correspond.
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Élargissez la recherche ou changez de zone.
                            </p>
                        </div>
                    ) : (
                        <ul
                            className={`grid gap-3 transition-opacity ${
                                loading ? "opacity-60" : ""
                            }`}
                            aria-busy={loading}
                        >
                            {sorted.map(patient => (
                                <PatientCard
                                    key={patient.id}
                                    patient={patient}
                                    onOpen={() => setOpenPatient(patient.id)}
                                    onToggleActive={() => suspension.open(patient)}
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}

            <PatientDossier
                patientId={openPatient}
                onClose={() => setOpenPatient(null)}
            />

            <SuspendAccountDialog
                target={suspension.target}
                busy={suspension.busy}
                error={suspension.error}
                onOpenChange={suspension.setOpen}
                onSubmit={(isActive) => void suspension.submit(isActive)}
            />
        </div>
    )
}
