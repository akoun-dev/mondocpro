"use client"

// Vue « Missions & Dispatch » du Médecin Chef — Task 35 (FEATURE-NURSE),
// redesign maquette PO 2026-10 (maquette mobile Missions) :
//   1. Recherche client (patient, soignant, zone, spécialité, motif) ;
//   2. Cartes de synthèse colorées — À affecter (file dispatch) / En cours
//      (missions actives) / Validées (missions terminées) — cliquables,
//      elles appliquent le filtre de statut correspondant ;
//   3. Chips de filtre par statut (Toutes / À affecter / En cours / À traiter
//      / Terminées) ;
//   4. File « À affecter » — RDV à domicile actifs sans mission, carte
//      urgence (liseré ambre, créneau + « dans X min », CTA d'affectation) ;
//      l'affectation d'un infirmier couvrant la zone notifie immédiatement
//      l'intéressé (MISSION_ASSIGNED, côté serveur src/lib/nurse.ts) ;
//   5. « Missions du jour » (créneau du jour ou à venir) + « Historique »
//      (créneaux passés) — suivi des statuts, réaffectation d'une mission
//      non terminée, barre de progression des visites débutées et lecture
//      du compte rendu.
// Un seul appel API : GET /api/admin/missions (contrat étendu Task 35 :
// { missions, dispatchQueue, nurses }).
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
    Activity,
    ArrowRight,
    CheckCircle2,
    Circle,
    Clock3,
    FileText,
    Loader2,
    MapPin,
    MessageSquare,
    Phone,
    Radar,
    RefreshCw,
    RotateCcw,
    Search,
    Stethoscope,
    TriangleAlert,
    Users,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import {
    MISSION_STATUS_LABELS,
    type AdminMissionBoard,
    type DispatchQueueItem,
    type MissionDto,
    type MissionStatus,
    type NurseDirectoryItem,
} from "@/lib/nurse-schemas"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import { formatTimeUTC, relativePublishedLabel } from "@/lib/datetime"

// ——— Constantes design (maquette PO) ———

/** Durée de visite estimée pour la barre de progression « en cours ». */
const VISIT_DURATION_MIN = 45
/** Un RDV à affecter démarrant sous ce délai est considéré « urgent ». */
const URGENT_WINDOW_MIN = 120

type StatusFilter = "toutes" | "affecter" | "encours" | "atraiter" | "terminees"
type SortOption = "recentes" | "anciennes" | "rdv"

const STATUS_FILTERS: { id: StatusFilter; label: string; dot?: string }[] = [
    { id: "toutes", label: "Toutes" },
    { id: "affecter", label: "À affecter", dot: "bg-warning" },
    { id: "encours", label: "En cours", dot: "bg-success" },
    { id: "atraiter", label: "À traiter", dot: "bg-primary" },
    { id: "terminees", label: "Terminées" },
]

// Badges de statut — palette maquette (À traiter bleu, En cours/Terminée
// vert, Annulée grise). Locale à la vue admin : le contrat partagé
// (MISSION_STATUS_CLASSES) reste utilisé par la vue infirmier.
const STATUS_BADGE_CLASSES: Record<MissionStatus, string> = {
    ASSIGNED: "bg-primary/10 text-primary",
    ACCEPTED: "bg-success/15 text-success-foreground dark:text-success",
    IN_PROGRESS: "bg-success/20 text-success-foreground dark:text-success",
    COMPLETED: "bg-success/10 text-success-foreground dark:text-success",
    CANCELLED: "bg-muted text-muted-foreground",
}

// Pastille d'avatar initiales — teinte déterministe par nom (maquette :
// initiales colorées diverses). Palette fixe, lisible en clair comme en sombre.
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

// ——— Formatage horaire (Abidjan = UTC+0 : composantes UTC, convention
// src/lib/datetime.ts — stable quel que soit le fuseau de l'appareil) ———

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** « Jeudi 15 oct. · 15:00 » · « Aujourd'hui · 08:30 » · « Demain · 09:15 ». */
function slotCompact(iso: string, now: Date = new Date()): string {
    const date = new Date(iso)
    const time = formatTimeUTC(iso)
    const dayOf = (d: Date) =>
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    const diffDays = Math.round(
        (dayOf(date) - dayOf(now)) / 86_400_000
    )
    if (diffDays === 0) return `Aujourd'hui · ${time}`
    if (diffDays === 1) return `Demain · ${time}`
    const formatted = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
    }).format(date)
    return `${capitalize(formatted)} · ${time}`
}

/** « dans 45 min » · « dans 2 h » · « dans 3 j » · « il y a 20 min » · « à l'instant ». */
function relativeDelta(iso: string, now: Date = new Date()): string {
    const deltaMin = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000)
    if (deltaMin > 0) {
        if (deltaMin < 1) return "imminent"
        if (deltaMin < 60) return `dans ${deltaMin} min`
        const hours = Math.floor(deltaMin / 60)
        if (hours < 24) return `dans ${hours} h`
        return `dans ${Math.floor(hours / 24)} j`
    }
    return relativePublishedLabel(iso, now).toLowerCase()
}

/** Fin de visite estimée : début + durée type (« Est. fin: 09:45 »). */
function estimateEndTime(startedIso: string): string {
    const end = new Date(new Date(startedIso).getTime() + VISIT_DURATION_MIN * 60_000)
    return formatTimeUTC(end.toISOString())
}

/** Avancement de la visite (0–95 %) depuis le début réel. */
function visitProgress(startedIso: string, now: Date = new Date()): number {
    const elapsedMin = (now.getTime() - new Date(startedIso).getTime()) / 60_000
    return Math.min(95, Math.max(4, Math.round((elapsedMin / VISIT_DURATION_MIN) * 100)))
}

const ACTIVE_STATUSES: MissionStatus[] = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]

function isActiveStatus(status: string): boolean {
    return ACTIVE_STATUSES.includes(status as MissionStatus)
}

/** Ligne méta de carte (icône + texte tronqué). */
function MetaRow({
    icon,
    children,
}: {
    icon: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="shrink-0 text-muted-foreground/80" aria-hidden="true">
                {icon}
            </span>
            <span className="min-w-0 truncate">{children}</span>
        </p>
    )
}

/** Bouton d'action carré (appel / SMS) — cible tactile ≥ 36 px. */
function IconButton({
    href,
    label,
    children,
}: {
    href: string
    label: string
    children: React.ReactNode
}) {
    return (
        <Button
            size="sm"
            variant="outline"
            asChild
            className="h-9 w-9 shrink-0 rounded-xl p-0"
        >
            <a href={href} aria-label={label} title={label}>
                {children}
            </a>
        </Button>
    )
}

export function AdminMissionsView() {
    const [board, setBoard] = useState<AdminMissionBoard | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [busyId, setBusyId] = useState<string | null>(null)

    // Recherche + filtres (maquette) — tout est client-side, un seul fetch.
    const [query, setQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("toutes")
    const [sort, setSort] = useState<SortOption>("recentes")

    // Suivi live : mission observée + rafraîchissement automatique.
    const [liveMissionId, setLiveMissionId] = useState<string | null>(null)
    const liveTimer = useRef<ReturnType<typeof setInterval> | null>(null)

    // Dispatch : RDV ciblé + infirmiers sélectionnés dans le dialog.
    const [dispatchTarget, setDispatchTarget] =
        useState<DispatchQueueItem | null>(null)
    const [dispatchNurseIds, setDispatchNurseIds] = useState<string[]>([])
    const [dispatchError, setDispatchError] = useState<string | undefined>(
        undefined
    )

    // Réaffectation : mission ciblée + nouveaux infirmiers.
    const [reassignTarget, setReassignTarget] = useState<MissionDto | null>(
        null
    )
    const [reassignNurseIds, setReassignNurseIds] = useState<string[]>([])
    const [reassignError, setReassignError] = useState<string | undefined>(
        undefined
    )

    const loadAll = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/missions", {
                cache: "no-store",
            })
            if (!res.ok) throw new Error()
            const body = (await res.json()) as AdminMissionBoard
            setBoard(body)
            setLoadError(false)
        } catch {
            setLoadError(true)
        }
    }, [])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    // Suivi live : rafraîchit le plateau toutes les 20 s tant qu'un dialog
    // est ouvert (statuts infirmier → admin, sans action de l'utilisateur).
    useEffect(() => {
        if (liveMissionId === null) {
            if (liveTimer.current) {
                clearInterval(liveTimer.current)
                liveTimer.current = null
            }
            return
        }
        liveTimer.current = setInterval(() => void loadAll(), 20_000)
        return () => {
            if (liveTimer.current) {
                clearInterval(liveTimer.current)
                liveTimer.current = null
            }
        }
    }, [liveMissionId, loadAll])

    const liveMission = useMemo(
        () => board?.missions.find(m => m.id === liveMissionId) ?? null,
        [board, liveMissionId]
    )

    // ——— Données dérivées : recherche + filtres + stats (maquette) ———
    const derived = useMemo(() => {
        if (!board) return null
        const now = new Date()
        const needle = query.trim().toLowerCase()

        const matches = (haystack: string) =>
            needle === "" || haystack.toLowerCase().includes(needle)

        const queue = board.dispatchQueue.filter(item =>
            matches(
                [
                    item.patientName,
                    ZONE_LABELS[item.zone as keyof typeof ZONE_LABELS] ??
                        item.zone,
                    item.specialtyName ?? "",
                    item.reason ?? "",
                ].join(" ")
            )
        )

        const missions = board.missions.filter(mission =>
            matches(
                [
                    mission.patient?.fullName ?? "",
                    mission.nurses.map(n => n.fullName).join(" "),
                    mission.nurse?.fullName ?? "",
                    ZONE_LABELS[mission.zone as keyof typeof ZONE_LABELS] ??
                        mission.zone,
                    mission.appointment.specialty?.name ?? "",
                    mission.appointment.reason ?? "",
                    MISSION_STATUS_LABELS[
                        mission.status as MissionStatus
                    ] ?? "",
                ].join(" ")
            )
        )

        // « Jour » calendaire : créneau d'aujourd'hui (Abidjan) ou à venir ;
        // le reste part en historique.
        const dayKey = (iso: string) => {
            const d = new Date(iso)
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
        }
        const nowKey = dayKey(now.toISOString())
        const todayList = missions.filter(m => dayKey(m.scheduledAt) >= nowKey)
        const historyList = missions.filter(m => dayKey(m.scheduledAt) < nowKey)

        const sorted = (list: MissionDto[]) => {
            const copy = [...list]
            copy.sort((a, b) => {
                if (sort === "rdv")
                    return (
                        new Date(a.scheduledAt).getTime() -
                        new Date(b.scheduledAt).getTime()
                    )
                const da = new Date(a.assignedAt).getTime()
                const dbb = new Date(b.assignedAt).getTime()
                return sort === "recentes" ? dbb - da : da - dbb
            })
            return copy
        }

        const statusOf = (f: StatusFilter, list: MissionDto[]) => {
            switch (f) {
                case "encours":
                    return list.filter(m => isActiveStatus(m.status))
                case "atraiter":
                    return list.filter(m => m.status === "ASSIGNED")
                case "terminees":
                    return list.filter(m => m.status === "COMPLETED")
                default:
                    return list
            }
        }

        const urgentCount = queue.filter(
            item =>
                new Date(item.scheduledAt).getTime() - now.getTime() <=
                URGENT_WINDOW_MIN * 60_000
        ).length

        return {
            now,
            queue,
            today: sorted(statusOf(statusFilter, todayList)),
            history: sorted(statusOf(statusFilter, historyList)),
            activeCount: missions.filter(m => isActiveStatus(m.status)).length,
            completedCount: missions.filter(m => m.status === "COMPLETED")
                .length,
            assignedCount: missions.filter(m => m.status === "ASSIGNED").length,
            urgentCount,
            total: queue.length + missions.length,
            searching: needle !== "",
        }
    }, [board, query, statusFilter, sort])

    function openDispatch(item: DispatchQueueItem) {
        setDispatchTarget(item)
        setDispatchNurseIds([])
        setDispatchError(undefined)
    }

    function openReassign(mission: MissionDto) {
        setReassignTarget(mission)
        const initial =
            (mission as any)?.nurses?.map((n: any) => n.id) ??
            (mission.nurse?.id ? [mission.nurse.id] : [])
        setReassignNurseIds([...initial])
        setReassignError(undefined)
    }

    async function submitDispatch(event: React.FormEvent) {
        event.preventDefault()
        if (!dispatchTarget) return
        if (dispatchNurseIds.length === 0) {
            setDispatchError("Sélectionnez au moins un infirmier à affecter")
            return
        }
        setBusyId(dispatchTarget.id)
        try {
            const res = await fetch("/api/admin/missions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appointmentId: dispatchTarget.id,
                    nurseIds: dispatchNurseIds,
                }),
            })
            if (res.ok) {
                const names = dispatchNurseIds
                    .map(id => board?.nurses.find(n => n.id === id)?.fullName)
                    .filter(Boolean)
                toast({
                    title: "Mission affectée",
                    description: `${names.length === 1 ? names[0] : `${names.length} infirmier(ère)s`} ${names.length === 1 ? "a été notifié(e)" : "ont été notifié(e)s"} — la mission apparaît dans l'onglet Missions.`,
                })
                setDispatchTarget(null)
                await loadAll()
                return
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            setDispatchError(
                body.error ?? "Affectation impossible — réessayez."
            )
        } catch {
            setDispatchError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setBusyId(null)
        }
    }

    async function submitReassign(event: React.FormEvent) {
        event.preventDefault()
        if (!reassignTarget) return
        if (reassignNurseIds.length === 0) {
            setReassignError("Sélectionnez au moins un infirmier")
            return
        }
        setBusyId(reassignTarget.id)
        try {
            const res = await fetch(
                `/api/admin/missions/${reassignTarget.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nurseIds: reassignNurseIds }),
                }
            )
            if (res.ok) {
                const names = reassignNurseIds
                    .map(id => board?.nurses.find(n => n.id === id)?.fullName)
                    .filter(Boolean)
                toast({
                    title: "Mission réaffectée",
                    description: `${names.length === 1 ? names[0] : `${names.length} infirmier(ère)s`} ${names.length === 1 ? "a été notifié(e)" : "ont été notifié(e)s"} — la mission leur est désormais assignée.`,
                })
                setReassignTarget(null)
                await loadAll()
                return
            }
            const body = (await res.json().catch(() => ({}))) as {
                error?: string
            }
            setReassignError(
                body.error ?? "Réaffectation impossible — réessayez."
            )
        } catch {
            setReassignError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setBusyId(null)
        }
    }

    // ——— Cartes ———

    /** Carte file « à affecter » — RDV domicile sans mission (liseré ambre). */
    function DispatchCard({ item }: { item: DispatchQueueItem }) {
        const urgent =
            new Date(item.scheduledAt).getTime() - derived!.now.getTime() <=
            URGENT_WINDOW_MIN * 60_000
        return (
            <li
                className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${
                    urgent ? "border-l-4 border-l-warning" : ""
                }`}
            >
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <span
                            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(item.patientName)}`}
                            aria-hidden="true"
                        >
                            {initialsOf(item.patientName)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                                <p className="min-w-0 truncate text-[15px] font-bold">
                                    {item.patientName}
                                </p>
                                <Badge className="shrink-0 gap-1 rounded-full bg-warning/20 px-2.5 text-[11px] font-bold text-warning-foreground dark:text-warning hover:bg-warning/20">
                                    <TriangleAlert
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                    À dispatcher
                                </Badge>
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-warning-foreground dark:text-warning">
                                <TriangleAlert
                                    className="size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                Sans soignant attribué
                            </p>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <MetaRow icon={<Clock3 className="size-3.5" />}>
                                <span suppressHydrationWarning>
                                    {slotCompact(item.scheduledAt, derived!.now)}
                                </span>
                            </MetaRow>
                            <Badge className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground dark:text-warning hover:bg-warning/15">
                                <span suppressHydrationWarning>
                                    {relativeDelta(item.scheduledAt, derived!.now)}
                                </span>
                            </Badge>
                        </div>
                        <MetaRow icon={<MapPin className="size-3.5" />}>
                            {ZONE_LABELS[
                                item.zone as keyof typeof ZONE_LABELS
                            ] ?? item.zone}
                            {" · "}À domicile
                        </MetaRow>
                        <MetaRow icon={<Stethoscope className="size-3.5" />}>
                            {item.specialtyName ?? "Consultation"}
                            {item.reason ? ` · ${item.reason}` : ""}
                        </MetaRow>
                    </div>

                    <div className="mt-3.5 flex items-center gap-2">
                        <Button
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => openDispatch(item)}
                            className="h-10 flex-1 gap-2 rounded-xl text-xs font-bold"
                        >
                            {busyId === item.id ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Users className="size-4" aria-hidden="true" />
                            )}
                            Affecter un(e) infirmier(ère)
                        </Button>
                        {item.patientPhone && (
                            <IconButton
                                href={`tel:${item.patientPhone}`}
                                label={`Appeler ${item.patientName}`}
                            >
                                <Phone
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </IconButton>
                        )}
                    </div>
                </div>
            </li>
        )
    }

    /** Carte mission — suivi, réaffectation, progression, compte rendu. */
    function MissionCard({ mission }: { mission: MissionDto }) {
        const nurses =
            (mission as any)?.nurses?.length > 0
                ? (mission as any).nurses.map((n: any) => n.fullName).join(", ")
                : mission.nurse?.fullName ?? "Infirmier"
        const status = mission.status as MissionStatus
        const patientName = mission.patient?.fullName ?? "Patient"
        const inProgress = status === "IN_PROGRESS" && mission.startedAt
        const actionable = !["COMPLETED", "CANCELLED"].includes(status)
        return (
            <li className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start gap-3">
                    <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarClass(patientName)}`}
                        aria-hidden="true"
                    >
                        {initialsOf(patientName)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-[15px] font-bold">
                                {patientName}
                            </p>
                            <Badge
                                className={`shrink-0 rounded-full px-2.5 text-[11px] font-bold ${STATUS_BADGE_CLASSES[status] ?? "bg-muted text-muted-foreground"}`}
                                aria-label={`Statut : ${MISSION_STATUS_LABELS[status] ?? mission.status}`}
                            >
                                {MISSION_STATUS_LABELS[status] ??
                                    mission.status}
                            </Badge>
                        </div>
                        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-semibold text-success-foreground dark:text-success">
                            <ArrowRight
                                className="size-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            <span className="min-w-0 truncate">
                                Infr. {nurses}
                            </span>
                        </p>
                    </div>
                </div>

                <div className="mt-3 flex flex-col gap-1.5">
                    <MetaRow icon={<Clock3 className="size-3.5" />}>
                        <span suppressHydrationWarning>
                            {slotCompact(mission.scheduledAt, derived!.now)}
                        </span>
                        {" · "}
                        {mission.type === "DOMICILE"
                            ? "À domicile"
                            : "Au cabinet"}
                        {" · "}
                        {ZONE_LABELS[
                            mission.zone as keyof typeof ZONE_LABELS
                        ] ?? mission.zone}
                    </MetaRow>
                    <MetaRow icon={<Stethoscope className="size-3.5" />}>
                        {mission.appointment.specialty?.name ?? "Consultation"}
                        {mission.appointment.reason
                            ? ` · ${mission.appointment.reason}`
                            : ""}
                    </MetaRow>
                </div>

                {inProgress && (
                    <div className="mt-3">
                        <div
                            className="h-1.5 w-full overflow-hidden rounded-full bg-success/15"
                            role="progressbar"
                            aria-label="Avancement de la visite"
                            aria-valuenow={visitProgress(
                                mission.startedAt!,
                                derived!.now
                            )}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="h-full rounded-full bg-success transition-all"
                                style={{
                                    width: `${visitProgress(mission.startedAt!, derived!.now)}%`,
                                }}
                            />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-success-foreground dark:text-success">
                            <span className="flex min-w-0 items-center gap-1">
                                <Clock3
                                    className="size-3 shrink-0"
                                    aria-hidden="true"
                                />
                                <span
                                    className="truncate"
                                    suppressHydrationWarning
                                >
                                    Visite débutée{" "}
                                    {relativeDelta(
                                        mission.startedAt!,
                                        derived!.now
                                    )}
                                </span>
                            </span>
                            <span className="shrink-0 tabular-nums">
                                Est. fin: {estimateEndTime(mission.startedAt!)}
                            </span>
                        </div>
                    </div>
                )}

                {mission.report && (
                    <details className="mt-2.5 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
                        <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-foreground">
                            <FileText
                                className="size-3.5"
                                aria-hidden="true"
                            />
                            Compte rendu du{" "}
                            <span suppressHydrationWarning>
                                {relativePublishedLabel(
                                    mission.report.createdAt
                                ).toLowerCase()}
                            </span>
                        </summary>
                        <p className="mt-1.5 leading-relaxed">
                            {mission.report.observations}
                        </p>
                        {mission.report.actionsTaken && (
                            <p className="mt-1 leading-relaxed">
                                <strong className="text-foreground">
                                    Actions :
                                </strong>{" "}
                                {mission.report.actionsTaken}
                            </p>
                        )}
                        {mission.report.recommendations && (
                            <p className="mt-1 leading-relaxed">
                                <strong className="text-foreground">
                                    Recommandations :
                                </strong>{" "}
                                {mission.report.recommendations}
                            </p>
                        )}
                    </details>
                )}

                {status === "ASSIGNED" || status === "ACCEPTED" ? (
                    <div className="mt-3.5 flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === mission.id}
                            onClick={() => openReassign(mission)}
                            className="h-10 flex-1 gap-2 rounded-xl text-xs font-bold"
                        >
                            {busyId === mission.id ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <RotateCcw
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            )}
                            Réaffecter
                        </Button>
                        {mission.patient?.phone && (
                            <IconButton
                                href={`sms:${mission.patient.phone}`}
                                label={`Envoyer un SMS à ${patientName}`}
                            >
                                <MessageSquare
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </IconButton>
                        )}
                        {mission.patient?.phone && (
                            <IconButton
                                href={`tel:${mission.patient.phone}`}
                                label={`Appeler ${patientName}`}
                            >
                                <Phone
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </IconButton>
                        )}
                    </div>
                ) : null}

                {inProgress ? (
                    <div className="mt-3.5 flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLiveMissionId(mission.id)}
                            className="h-10 flex-1 gap-2 rounded-xl border-primary/30 bg-primary/5 text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary"
                        >
                            <Radar className="size-4" aria-hidden="true" />
                            Suivi live
                        </Button>
                        {mission.patient?.phone && (
                            <IconButton
                                href={`tel:${mission.patient.phone}`}
                                label={`Appeler ${patientName}`}
                            >
                                <Phone
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </IconButton>
                        )}
                    </div>
                ) : null}
            </li>
        )
    }

    /** En-tête de section (titre + compteur + action droite). */
    function SectionHeader({
        id,
        title,
        count,
        badge,
        action,
    }: {
        id: string
        title: string
        count?: number
        badge?: React.ReactNode
        action?: React.ReactNode
    }) {
        return (
            <div className="mb-2.5 flex items-center justify-between gap-2">
                <h3
                    id={id}
                    className="flex min-w-0 items-center gap-2 text-[15px] font-bold tracking-tight"
                >
                    {title}
                    {typeof count === "number" && count > 0 && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                            {count}
                        </span>
                    )}
                    {badge}
                </h3>
                {action}
            </div>
        )
    }

    const showQueue =
        derived !== null &&
        (statusFilter === "toutes" || statusFilter === "affecter")
    const showMissions =
        derived !== null &&
        (statusFilter === "toutes" ||
            statusFilter === "encours" ||
            statusFilter === "atraiter" ||
            statusFilter === "terminees")

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
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Rechercher patient, soignant, adresse..."
                    aria-label="Rechercher patient, soignant, adresse"
                    className="h-11 rounded-full border-border bg-card pl-10 pr-10 text-sm shadow-sm"
                />
                {query !== "" && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setQuery("")}
                        aria-label="Effacer la recherche"
                        className="absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </Button>
                )}
            </div>

            {loadError && board === null ? (
                <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm font-medium">
                        Impossible de charger les missions.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => void loadAll()}
                        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
                    >
                        Réessayer
                    </Button>
                </div>
            ) : board === null || derived === null ? (
                <div
                    className="flex flex-col gap-4"
                    aria-busy="true"
                    aria-label="Chargement des missions"
                >
                    <div className="grid grid-cols-3 gap-2">
                        {[0, 1, 2].map(index => (
                            <Skeleton
                                key={index}
                                className="h-[52px] rounded-2xl"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    {[0, 1].map(index => (
                        <Skeleton
                            key={index}
                            className="h-[150px] rounded-2xl"
                            aria-hidden="true"
                        />
                    ))}
                </div>
            ) : (
                <>
                    {/* ——— Cartes de synthèse (maquette) ——— */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setStatusFilter(
                                    statusFilter === "affecter"
                                        ? "toutes"
                                        : "affecter"
                                )
                            }
                            aria-pressed={statusFilter === "affecter"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "affecter"
                                    ? "border-warning bg-warning/15"
                                    : "border-warning/30 bg-warning/10 hover:bg-warning/15"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-warning-foreground dark:text-warning">
                                <TriangleAlert
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                À affecter
                            </span>
                            <span className="truncate text-sm font-extrabold text-warning-foreground dark:text-warning">
                                {derived.queue.length}{" "}
                                {derived.urgentCount > 0
                                    ? `urgente${derived.urgentCount > 1 ? "s" : ""}`
                                    : "en attente"}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setStatusFilter(
                                    statusFilter === "encours"
                                        ? "toutes"
                                        : "encours"
                                )
                            }
                            aria-pressed={statusFilter === "encours"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "encours"
                                    ? "border-success bg-success/20"
                                    : "border-success/30 bg-success/10 hover:bg-success/15"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success-foreground dark:text-success">
                                <Activity
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                En cours
                            </span>
                            <span className="truncate text-sm font-extrabold text-success-foreground dark:text-success">
                                {derived.activeCount} active
                                {derived.activeCount > 1 ? "s" : ""}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setStatusFilter(
                                    statusFilter === "terminees"
                                        ? "toutes"
                                        : "terminees"
                                )
                            }
                            aria-pressed={statusFilter === "terminees"}
                            className={`flex min-w-0 flex-col items-start gap-0.5 rounded-2xl border p-2.5 text-left transition-colors ${
                                statusFilter === "terminees"
                                    ? "border-success bg-success/20"
                                    : "border-success/30 bg-success/10 hover:bg-success/15"
                            }`}
                        >
                            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-success-foreground dark:text-success">
                                <CheckCircle2
                                    className="size-3"
                                    aria-hidden="true"
                                />
                                Validées
                            </span>
                            <span className="truncate text-sm font-extrabold text-success-foreground dark:text-success">
                                {derived.completedCount} faite
                                {derived.completedCount > 1 ? "s" : ""}
                            </span>
                        </button>
                    </div>

                    {/* ——— Chips de filtre par statut ——— */}
                    <div
                        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        role="group"
                        aria-label="Filtrer par statut"
                    >
                        {STATUS_FILTERS.map(filter => {
                            const active = statusFilter === filter.id
                            const count =
                                filter.id === "toutes"
                                    ? derived.total
                                    : filter.id === "affecter"
                                      ? derived.queue.length
                                      : filter.id === "encours"
                                        ? derived.activeCount
                                        : filter.id === "atraiter"
                                      ? derived.assignedCount
                                      : derived.completedCount
                            return (
                                <button
                                    key={filter.id}
                                    type="button"
                                    onClick={() => setStatusFilter(filter.id)}
                                    aria-pressed={active}
                                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors ${
                                        active
                                            ? "border-transparent bg-foreground text-background"
                                            : "border-border bg-card text-foreground hover:bg-muted/60"
                                    }`}
                                >
                                    {filter.dot && (
                                        <span
                                            className={`size-1.5 rounded-full ${filter.dot}`}
                                            aria-hidden="true"
                                        />
                                    )}
                                    {filter.label}
                                    <span
                                        className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                                            active
                                                ? "bg-background/20"
                                                : "bg-muted text-muted-foreground"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {derived.searching &&
                    derived.queue.length === 0 &&
                    derived.today.length === 0 &&
                    derived.history.length === 0 ? (
                        <p className="rounded-2xl border border-dashed bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                            Aucun résultat pour «&nbsp;{query}&nbsp;».
                        </p>
                    ) : (
                        <>
                            {/* ——— File « à affecter » — RDV domicile sans mission ——— */}
                            {showQueue && (
                                <section aria-labelledby="dispatch-queue">
                                    <SectionHeader
                                        id="dispatch-queue"
                                        title="À affecter"
                                        count={
                                            // Compteur neutre uniquement s'il n'y a
                                            // aucune urgence (sinon le badge
                                            // « urgente » suffit — maquette).
                                            derived.urgentCount === 0 &&
                                            statusFilter === "toutes"
                                                ? derived.queue.length
                                                : undefined
                                        }
                                        badge={
                                            derived.urgentCount > 0 ? (
                                                <Badge className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground dark:text-warning hover:bg-warning/15">
                                                    {derived.urgentCount} urgente
                                                    {derived.urgentCount > 1
                                                        ? "s"
                                                        : ""}
                                                </Badge>
                                            ) : undefined
                                        }
                                        action={
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => void loadAll()}
                                                aria-label="Rafraîchir les missions"
                                                className="size-8 shrink-0 rounded-full"
                                            >
                                                <RefreshCw
                                                    className={`size-4 ${busyId !== null ? "animate-spin" : ""}`}
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        }
                                    />
                                    {derived.queue.length === 0 ? (
                                        <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                            Aucune consultation à domicile en
                                            attente d&apos;affectation.
                                        </p>
                                    ) : (
                                        <ul className="grid gap-3">
                                            {derived.queue.map(item => (
                                                <DispatchCard
                                                    key={item.id}
                                                    item={item}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            )}

                            {/* ——— Missions du jour (créneau du jour ou à venir) ——— */}
                            {showMissions && (
                                <section aria-labelledby="missions-list">
                                    <SectionHeader
                                        id="missions-list"
                                        title="Missions du jour"
                                        count={
                                            derived.today.length > 0
                                                ? derived.today.length
                                                : undefined
                                        }
                                        action={
                                            <Select
                                                value={sort}
                                                onValueChange={value =>
                                                    setSort(value as SortOption)
                                                }
                                            >
                                                <SelectTrigger
                                                    aria-label="Trier les missions"
                                                    className="h-8 shrink-0 gap-1 rounded-full border-primary/20 bg-primary/10 px-3 text-[11px] font-bold text-primary"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="recentes">
                                                        Plus récentes
                                                    </SelectItem>
                                                    <SelectItem value="anciennes">
                                                        Plus anciennes
                                                    </SelectItem>
                                                    <SelectItem value="rdv">
                                                        Heure du RDV
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        }
                                    />
                                    {derived.today.length === 0 ? (
                                        <p className="rounded-2xl border border-dashed bg-muted/40 p-5 text-center text-sm text-muted-foreground">
                                            {statusFilter === "toutes"
                                                ? "Aucune mission aujourd'hui — affectez d'abord une consultation à domicile."
                                                : "Aucune mission dans ce filtre pour aujourd'hui."}
                                        </p>
                                    ) : (
                                        <ul className="grid gap-3">
                                            {derived.today.map(mission => (
                                                <MissionCard
                                                    key={mission.id}
                                                    mission={mission}
                                                />
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            )}

                            {/* ——— Historique (créneaux passés) ——— */}
                            {showMissions && derived.history.length > 0 && (
                                <section aria-labelledby="missions-history">
                                    <SectionHeader
                                        id="missions-history"
                                        title="Historique"
                                        count={derived.history.length}
                                    />
                                    <ul className="grid gap-3 opacity-90">
                                        {derived.history.map(mission => (
                                            <MissionCard
                                                key={mission.id}
                                                mission={mission}
                                            />
                                        ))}
                                    </ul>
                                </section>
                            )}
                        </>
                    )}
                </>
            )}

            {/* Dialog suivi live — timeline réelle + auto-refresh 20 s */}
            <Dialog
                open={liveMissionId !== null}
                onOpenChange={open => {
                    if (!open) setLiveMissionId(null)
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Suivi de la mission</DialogTitle>
                        <DialogDescription>
                            {liveMission && (
                                <>
                                    {liveMission.patient?.fullName ??
                                        "Patient"}{" "}
                                    ·{" "}
                                    {ZONE_LABELS[
                                        liveMission.zone as keyof typeof ZONE_LABELS
                                    ] ?? liveMission.zone}{" "}
                                    ·{" "}
                                    <span suppressHydrationWarning>
                                        {slotCompact(
                                            liveMission.scheduledAt,
                                            derived?.now
                                        )}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {liveMission && (
                        <div className="flex flex-col gap-4">
                            <ol className="flex flex-col gap-2.5">
                                {(
                                    [
                                        ["Mission affectée", liveMission.assignedAt],
                                        ["Acceptée par l'infirmier", liveMission.acceptedAt],
                                        ["Visite débutée", liveMission.startedAt],
                                        ["Visite terminée", liveMission.completedAt],
                                    ] as const
                                ).map(([label, iso]) => (
                                    <li
                                        key={label}
                                        className="flex items-center gap-2.5 text-sm"
                                    >
                                        {iso ? (
                                            <CheckCircle2
                                                className="size-4 shrink-0 text-success"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <Circle
                                                className="size-4 shrink-0 text-muted-foreground/40"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="flex-1 font-medium">
                                            {label}
                                        </span>
                                        <span
                                            className="shrink-0 text-xs text-muted-foreground"
                                            suppressHydrationWarning
                                        >
                                            {iso
                                                ? relativePublishedLabel(iso)
                                                : "—"}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                            {liveMission.status === "IN_PROGRESS" &&
                                liveMission.startedAt && (
                                    <div>
                                        <div
                                            className="h-1.5 w-full overflow-hidden rounded-full bg-success/15"
                                            role="progressbar"
                                            aria-label="Avancement de la visite"
                                            aria-valuenow={visitProgress(
                                                liveMission.startedAt,
                                                derived?.now ?? new Date()
                                            )}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        >
                                            <div
                                                className="h-full rounded-full bg-success"
                                                style={{
                                                    width: `${visitProgress(liveMission.startedAt, derived?.now ?? new Date())}%`,
                                                }}
                                            />
                                        </div>
                                        <p className="mt-1.5 flex justify-between text-[11px] font-semibold text-success-foreground dark:text-success">
                                            <span suppressHydrationWarning>
                                                Visite débutée{" "}
                                                {relativeDelta(
                                                    liveMission.startedAt,
                                                    derived?.now ?? new Date()
                                                )}
                                            </span>
                                            <span className="tabular-nums">
                                                Est. fin:{" "}
                                                {estimateEndTime(
                                                    liveMission.startedAt
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                )}
                            <p className="text-xs text-muted-foreground">
                                Équipe :{" "}
                                <span className="font-semibold text-foreground">
                                    {(liveMission as any)?.nurses
                                        ?.map((n: any) => n.fullName)
                                        .join(", ") ??
                                        liveMission.nurse?.fullName ??
                                        "Infirmier"}
                                </span>
                                {" · "}
                                {liveMission.appointment.specialty?.name ??
                                    "Consultation"}
                                . Le suivi se rafraîchit automatiquement.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void loadAll()}
                        >
                            <RefreshCw
                                className="size-4"
                                aria-hidden="true"
                            />
                            Rafraîchir
                        </Button>
                        <Button
                            type="button"
                            onClick={() => setLiveMissionId(null)}
                        >
                            Fermer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog dispatch — POST /api/admin/missions */}
            <Dialog
                open={Boolean(dispatchTarget)}
                onOpenChange={open => {
                    if (!open) setDispatchTarget(null)
                }}
            >
                {/* max-h + scroll : la liste d'infirmiers peut dépasser la hauteur
            disponible sur mobile une fois le clavier virtuel ouvert. */}
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Affecter la mission</DialogTitle>
                        <DialogDescription>
                            {dispatchTarget && (
                                <>
                                    {dispatchTarget.patientName} ·{" "}
                                    {ZONE_LABELS[
                                        dispatchTarget.zone as keyof typeof ZONE_LABELS
                                    ] ?? dispatchTarget.zone}{" "}
                                    ·{" "}
                                    <span suppressHydrationWarning>
                                        {formatSlot(dispatchTarget.scheduledAt)}
                                    </span>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={submitDispatch}
                        className="flex flex-col gap-4"
                    >
                        <NurseMultiPicker
                            nurses={board?.nurses ?? []}
                            zone={dispatchTarget?.zone ?? ""}
                            value={dispatchNurseIds}
                            onToggle={id => {
                                setDispatchNurseIds(prev => {
                                    const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
                                    if (next.length > 0) setDispatchError(undefined)
                                    return next
                                })
                            }}
                            error={dispatchError}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDispatchTarget(null)}
                                disabled={busyId !== null}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={busyId !== null}>
                                {busyId !== null && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                Affecter et notifier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Dialog réaffectation — PATCH /api/admin/missions/:id */}
            <Dialog
                open={Boolean(reassignTarget)}
                onOpenChange={open => {
                    if (!open) setReassignTarget(null)
                }}
            >
                <DialogContent className="max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Réaffecter la mission</DialogTitle>
                        <DialogDescription>
                            {reassignTarget && (
                                <>
                                    {reassignTarget.patient?.fullName ??
                                        "Patient"}{" "}
                                    · mission actuellement «{" "}
                                    {MISSION_STATUS_LABELS[
                                        reassignTarget.status as MissionStatus
                                    ] ?? reassignTarget.status}
                                    » — le nouvel infirmier sera notifié et la
                                    mission repassera « À traiter ».
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={submitReassign}
                        className="flex flex-col gap-4"
                    >
                        <NurseMultiPicker
                            nurses={board?.nurses ?? []}
                            zone={reassignTarget?.zone ?? ""}
                            value={reassignNurseIds}
                            onToggle={id => {
                                setReassignNurseIds(prev => {
                                    const next = prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
                                    if (next.length > 0) setReassignError(undefined)
                                    return next
                                })
                            }}
                            error={reassignError}
                        />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setReassignTarget(null)}
                                disabled={busyId !== null}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" disabled={busyId !== null}>
                                {busyId !== null && (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden="true"
                                    />
                                )}
                                Réaffecter et notifier
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ——— Dialog de sélection d'infirmiers (dispatch / réaffectation) ———

// Infirmiers couvrant la zone du RDV d'abord (l'API refuse une affectation
// hors zone — la contrainte est guidée côté UI pour éviter l'erreur 400).
function nursesForZone(
    nurses: NurseDirectoryItem[],
    zone: string
): NurseDirectoryItem[] {
    const same = nurses.filter(n => n.zone === zone)
    const others = nurses.filter(n => n.zone !== zone)
    return [...same, ...others]
}

// « vendredi 9 octobre à 10:00 » — heure Abidjan = UTC+0 (même convention que
// la vue infirmier : l'heure affichée est l'heure locale du patient).
function formatSlot(value: string) {
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Abidjan",
    }).format(new Date(value))
}

// Dialog de sélection d'infirmier — partagé dispatch / réaffectation.
// Déclaré hors de AdminMissionsView : sinon React le démonte et le remonte à
// chaque render, ce qui fait clignoter le Select pendant la saisie.
function NurseMultiPicker({
    nurses,
    zone,
    value,
    onToggle,
    error,
}: {
    nurses: NurseDirectoryItem[]
    zone: string
    value: string[]
    onToggle: (id: string) => void
    error?: string
}) {
    const candidates = nursesForZone(nurses, zone)
    const sameZone = candidates.filter(n => n.zone === zone)
    const otherZone = candidates.filter(n => n.zone !== zone)
    return (
        <div className="flex flex-col gap-1.5">
            <Label>
                Infirmier(e)s — zone{" "}
                {ZONE_LABELS[zone as keyof typeof ZONE_LABELS] ?? zone}
            </Label>
            <div className="max-h-64 overflow-y-auto rounded-xl border">
                {sameZone.length === 0 && otherZone.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                        Aucun(e) infirmier(ère) enregistré(e).
                    </div>
                ) : (
                    <>
                        {sameZone.map(nurse => {
                            const checked = value.includes(nurse.id)
                            return (
                                <label
                                    key={nurse.id}
                                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted"
                                >
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={() => onToggle(nurse.id)}
                                    />
                                    <span className="text-sm">{nurse.fullName}</span>
                                </label>
                            )
                        })}
                        {otherZone.length > 0 && (
                            <>
                                <div className="px-3 py-1.5 text-xs text-muted-foreground">
                                    Autres zones (à refuser si hors zone du RDV)
                                </div>
                                {otherZone.map(nurse => {
                                    const checked = value.includes(nurse.id)
                                    return (
                                        <label
                                            key={nurse.id}
                                            className="flex items-center gap-3 px-3 py-2 opacity-60"
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => onToggle(nurse.id)}
                                            />
                                            <span className="text-sm">
                                                {nurse.fullName} — {ZONE_LABELS[nurse.zone as keyof typeof ZONE_LABELS] ?? nurse.zone}
                                            </span>
                                        </label>
                                    )
                                })}
                            </>
                        )}
                    </>
                )}
            </div>
            <p className="text-xs text-muted-foreground">
                L&apos;infirmier(e) doit couvrir la zone du rendez-vous. Si vous
                sélectionnez un(e) infirmier(ère) hors zone, le serveur refusera
                l&apos;affectation.
            </p>
            {error ? (
                <p
                    className="text-xs font-medium text-destructive"
                    role="alert"
                >
                    {error}
                </p>
            ) : null}
        </div>
    )
}
