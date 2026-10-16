"use client"

// Accueil du Médecin Chef — TABLEAU DE BORD (FEATURE-ADMIN-DASHBOARD,
// redesign maquette PO « Vue d'ensemble ») : héros bleu avec prochain RDV
// du jour, grille de 6 KPI cliquables, graphique 7 jours avec tendance,
// répartition par zone et trois files d'action. Un seul appel :
// GET /api/admin/overview (KPI réels, visites terminées, files à traiter).
// Langage visuel identique aux vues Missions / Patients (avatars initiales,
// badges de zone colorés, chips rounded-full, cartes rounded-2xl).
import { useCallback, useEffect, useState } from "react"
import {
    ArrowRight,
    Banknote,
    CalendarCheck,
    CalendarClock,
    ChevronRight,
    CircleCheck,
    ClipboardCheck,
    Hourglass,
    Loader2,
    RefreshCw,
    Stethoscope,
    UserRound,
} from "lucide-react"
import {
    Bar,
    BarChart,
    Cell,
    XAxis,
} from "recharts"

import type { AdminTab } from "@/components/admin/admin-sidebar"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import {
    formatCardSlotUTC,
    formatTimeUTC,
    relativePublishedLabel,
} from "@/lib/datetime"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import type {
    AdminOverview,
} from "@/lib/admin-overview-schemas"
import type { MissionStatus } from "@/lib/nurse-schemas"

type Props = {
    userName: string
    onNavigate: (tab: AdminTab) => void
}

const chartConfig = {
    visites: {
        label: "Visites terminées",
        color: "var(--chart-1)",
    },
} satisfies ChartConfig

// ——— Constantes design (langage maquette, identique Missions / Patients) ———

// Pastille d'avatar initiales — teinte déterministe par nom.
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

// Badge de zone coloré (Yopougon bleu, Songon teal, PK22 ambre, N'Dotré violet).
const ZONE_BADGE_CLASSES: Record<string, string> = {
    YOPOUGON: "bg-primary/10 text-primary",
    SONGON: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
    PK22: "bg-amber-500/15 text-amber-700 dark:text-amber-500",
    NDOTRE: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
}

function zoneBadgeClass(zone: string): string {
    return ZONE_BADGE_CLASSES[zone] ?? "bg-muted text-muted-foreground"
}

// Libellés des statuts de mission (même vocabulaire que la vue Missions).
const STATUS_LABELS: Record<MissionStatus, string> = {
    ASSIGNED: "À traiter",
    ACCEPTED: "Acceptée",
    IN_PROGRESS: "En cours",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
}

// Pastilles de statut (maquette : à valider ambre, en cours bleu, fait vert).
const STATUS_PILL_CLASSES: Record<MissionStatus, string> = {
    ASSIGNED: "bg-warning/15 text-warning-foreground dark:text-warning",
    ACCEPTED: "bg-primary/10 text-primary",
    IN_PROGRESS: "bg-primary/10 text-primary",
    COMPLETED: "bg-success/15 text-success-foreground dark:text-success",
    CANCELLED: "bg-muted text-muted-foreground",
}

// Chip « +N à affecter » — ambre doux, lisible clair comme sombre.
const QUEUE_CHIP =
    "rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning-foreground dark:text-warning"

// Carte KPI — toute la carte est un raccourci vers la vue d'action
// (maquette : pastille d'icône, grand chiffre, libellé, sous-titre ; les
// cartes nécessitant une action passent en ambre).
function KpiCard({
    icon: Icon,
    label,
    value,
    sub,
    alert,
    onClick,
}: {
    icon: typeof UserRound
    label: string
    value: string
    sub: string
    alert?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group flex flex-col gap-2 rounded-2xl border p-4 text-left shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                alert
                    ? "border-warning/40 bg-warning/10 hover:border-warning/60"
                    : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
            }`}
        >
            <span className="flex items-center justify-between gap-2">
                <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        alert
                            ? "bg-warning/20 text-warning-foreground"
                            : "bg-primary/10 text-primary"
                    }`}
                >
                    <Icon className="size-4.5" aria-hidden="true" />
                </span>
                {alert && (
                    <span
                        className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-foreground"
                        aria-label="Action requise"
                    >
                        Action
                    </span>
                )}
            </span>
            <span
                className={`text-3xl font-bold tracking-tight tabular-nums ${
                    alert ? "text-warning-foreground" : "text-foreground"
                }`}
            >
                {value}
            </span>
            <span className="flex flex-col">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs leading-snug text-muted-foreground">
                    {sub}
                </span>
            </span>
        </button>
    )
}

export function AdminHomeView({ userName, onNavigate }: Props) {
    const [overview, setOverview] = useState<AdminOverview | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const loadAll = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/admin/overview", {
                cache: "no-store",
            })
            if (res.ok) {
                const body = (await res.json()) as { overview: AdminOverview }
                setOverview(body.overview)
            } else {
                const body = (await res.json().catch(() => ({}))) as {
                    error?: string
                }
                setError(body.error ?? "Réessayez dans un instant.")
            }
        } catch {
            setError(
                "Impossible de contacter le serveur. Vérifiez votre connexion internet puis réessayez."
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadAll()
    }, [loadAll])

    const kpis = overview?.kpis
    const chartData =
        overview?.completedByDay.map(day => ({
            label: day.label,
            visites: day.count,
        })) ?? []
    const currentTotal = chartData.reduce((sum, day) => sum + day.visites, 0)

    // Tendance « +X % » (maquette) : comparaison avec les 7 jours précédents.
    let trend: { text: string; className: string } | null = null
    if (overview) {
        const previous = overview.completedPrevious7d
        if (previous === 0 && currentTotal === 0) {
            trend = null
        } else if (previous === 0) {
            trend = {
                text: "Nouveau",
                className:
                    "bg-success/15 text-success-foreground dark:text-success",
            }
        } else {
            const percent = Math.round(
                ((currentTotal - previous) / previous) * 100
            )
            if (percent === 0) {
                trend = {
                    text: "Stable",
                    className: "bg-muted text-muted-foreground",
                }
            } else if (percent > 0) {
                trend = {
                    text: `+${percent} %`,
                    className:
                        "bg-success/15 text-success-foreground dark:text-success",
                }
            } else {
                trend = {
                    text: `${percent} %`,
                    className:
                        "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                }
            }
        }
    }

    // Compteur « à traiter » des demandes reçues (statut ASSIGNED).
    const assignedCount =
        overview?.recentMissions.filter(m => m.status === "ASSIGNED").length ?? 0

    // Maquette : « Bonjour, Dr Kadjane » — le nom complet est affiché tel
    // quel (l'honorifique fait partie du nom du compte).
    const nextAppt = overview?.nextAppointmentToday ?? null

    return (
        <div className="flex flex-col gap-6">
            {/* Héros — prochain RDV du jour, salutation et raccourcis
                (maquette : carte bleue, chips blanc translucide) */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-primary-foreground sm:p-8">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/[0.07] blur-xl" />
                </div>
                <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-2.5">
                        {nextAppt && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                                    <CalendarClock
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    Prochain RDV ·{" "}
                                    {nextAppt.specialtyName ?? "Consultation"}
                                </span>
                                <span
                                    className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold tabular-nums ring-1 ring-white/25"
                                    suppressHydrationWarning
                                >
                                    {formatTimeUTC(nextAppt.scheduledAt)}
                                </span>
                                <span className="rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold text-warning-foreground">
                                    Aujourd&apos;hui
                                </span>
                            </div>
                        )}
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Bonjour, {userName}
                        </h2>
                        {kpis && (
                            <p className="max-w-xl text-sm leading-relaxed text-white/80">
                                Vous avez{" "}
                                <strong className="font-semibold text-white">
                                    {kpis.appointmentsToday} consultation
                                    {kpis.appointmentsToday > 1 ? "s" : ""}
                                </strong>{" "}
                                aujourd&apos;hui, dont{" "}
                                <strong className="font-semibold text-white">
                                    {kpis.missionsToday} mission
                                    {kpis.missionsToday > 1 ? "s" : ""} terrain
                                </strong>
                                . Toutes les informations sont dans Missions et
                                dans le Calendrier.
                            </p>
                        )}
                        {kpis && (
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                <button
                                    type="button"
                                    onClick={() => onNavigate("missions")}
                                    className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold ring-1 ring-white/25 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    <CalendarCheck
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {kpis.missionsToday} mission
                                    {kpis.missionsToday > 1 ? "s" : ""}{" "}
                                    aujourd&apos;hui
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onNavigate("patients")}
                                    className="flex h-8 items-center gap-1.5 rounded-full bg-white/15 px-3 text-xs font-semibold ring-1 ring-white/25 transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                                >
                                    <UserRound
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {kpis.patientsTotal} patient
                                    {kpis.patientsTotal > 1 ? "s" : ""}
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                        {overview && (
                            <span
                                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25"
                                suppressHydrationWarning
                            >
                                Actualisé à{" "}
                                {new Date(overview.generatedAt).toLocaleTimeString(
                                    "fr-FR",
                                    { hour: "2-digit", minute: "2-digit" }
                                )}
                            </span>
                        )}
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void loadAll()}
                            disabled={loading}
                            className="h-9 gap-1.5 rounded-full bg-white/15 text-xs font-semibold text-white ring-1 ring-white/25 hover:bg-white/25"
                        >
                            {loading ? (
                                <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <RefreshCw
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                            )}
                            Actualiser
                        </Button>
                    </div>
                </div>
            </div>

            {error && !overview ? (
                <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm font-medium">{error}</p>
                    <Button
                        variant="outline"
                        onClick={() => void loadAll()}
                        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
                    >
                        Réessayer
                    </Button>
                </div>
            ) : loading && !overview ? (
                <div className="flex flex-col gap-6" aria-busy="true">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                        {[0, 1, 2, 3, 4, 5].map(index => (
                            <Skeleton
                                key={index}
                                className="h-[136px] rounded-2xl"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Skeleton
                            className="h-[280px] rounded-2xl"
                            aria-hidden="true"
                        />
                        <Skeleton
                            className="h-[280px] rounded-2xl"
                            aria-hidden="true"
                        />
                    </div>
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        {[0, 1, 2].map(index => (
                            <Skeleton
                                key={index}
                                className="h-[260px] rounded-2xl"
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                </div>
            ) : overview && kpis ? (
                <>
                    {/* Grille KPI — les 6 piliers opérationnels, chacun
                        renvoyant vers la vue qui permet d'agir (maquette :
                        Patients, Infirmiers, Missions, À affecter, Recharges,
                        RDV du jour) */}
                    <div
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
                        aria-label="Indicateurs clés de la plateforme"
                    >
                        <KpiCard
                            icon={UserRound}
                            label="Patients"
                            value={String(kpis.patientsTotal)}
                            sub={`${kpis.patientsActive} dossier${kpis.patientsActive > 1 ? "s" : ""} actif${kpis.patientsActive > 1 ? "s" : ""}`}
                            onClick={() => onNavigate("patients")}
                        />
                        <KpiCard
                            icon={Stethoscope}
                            label="Infirmiers"
                            value={`${kpis.nursesActive}/${kpis.nursesTotal}`}
                            sub="en activité"
                            onClick={() => onNavigate("infirmiers")}
                        />
                        <KpiCard
                            icon={ClipboardCheck}
                            label="Missions actives"
                            value={String(kpis.missionsActive)}
                            sub="engagées & à venir"
                            onClick={() => onNavigate("missions")}
                        />
                        <KpiCard
                            icon={Hourglass}
                            label="À affecter"
                            value={String(kpis.toDispatch)}
                            sub="RDV à domicile sans soignant"
                            alert={kpis.toDispatch > 0}
                            onClick={() => onNavigate("equipes")}
                        />
                        <KpiCard
                            icon={Banknote}
                            label="Recharges"
                            value={String(kpis.rechargesPending)}
                            sub={`${kpis.rechargesPendingFcfa.toLocaleString("fr-FR")} FCFA à confirmer`}
                            alert={kpis.rechargesPending > 0}
                            onClick={() => onNavigate("recharges")}
                        />
                        <KpiCard
                            icon={CalendarCheck}
                            label="RDV du jour"
                            value={String(kpis.appointmentsToday)}
                            sub="consultations prévues"
                            onClick={() => onNavigate("missions")}
                        />
                    </div>

                    {/* Statistiques — activité hebdomadaire (tendance vs 7
                        jours précédents) + répartition par zone */}
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <Card className="rounded-2xl">
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base">
                                        Missions réalisées sur les 7 derniers
                                        jours
                                    </CardTitle>
                                    {trend && (
                                        <span
                                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${trend.className}`}
                                        >
                                            {trend.text}
                                        </span>
                                    )}
                                </div>
                                <CardDescription>
                                    {currentTotal} visite
                                    {currentTotal > 1 ? "s" : ""} terminée
                                    {currentTotal > 1 ? "s" : ""} — par rapport
                                    aux 7 jours précédents
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <ChartContainer
                                        config={chartConfig}
                                        className="h-[200px] w-full"
                                    >
                                        <BarChart
                                            accessibilityLayer
                                            data={chartData}
                                            margin={{ top: 8 }}
                                        >
                                            <XAxis
                                                dataKey="label"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                            />
                                            <ChartTooltip
                                                cursor={false}
                                                content={
                                                    <ChartTooltipContent
                                                        hideLabel
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="visites"
                                                radius={8}
                                            >
                                                {chartData.map(
                                                    (entry, index) => (
                                                        <Cell
                                                            key={entry.label}
                                                            fill="var(--color-visites)"
                                                            fillOpacity={
                                                                index ===
                                                                chartData.length -
                                                                    1
                                                                    ? 1
                                                                    : 0.22
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Bar>
                                        </BarChart>
                                    </ChartContainer>
                                    {currentTotal === 0 && (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                            <p className="text-xs text-muted-foreground">
                                                Aucune visite terminée cette
                                                semaine
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Missions actives par zone
                                </CardTitle>
                                <CardDescription>
                                    Charge des territoires — file
                                    d&apos;affectation incluse
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-1.5">
                                {overview.activeByZone.map(stat => (
                                    <div
                                        key={stat.zone}
                                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${
                                            stat.queue > 0 ? "bg-muted/60" : ""
                                        }`}
                                    >
                                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="text-sm font-semibold">
                                                {ZONE_LABELS[stat.zone]}
                                            </span>
                                            {stat.queue > 0 && (
                                                <span className={QUEUE_CHIP}>
                                                    +{stat.queue} à affecter
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`text-sm font-bold tabular-nums ${
                                                stat.active === 0
                                                    ? "text-muted-foreground"
                                                    : "text-foreground"
                                            }`}
                                        >
                                            {stat.active}
                                        </span>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Files d'action — demandes reçues, dispatch, paiements */}
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                        <Card className="rounded-2xl">
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base">
                                        Demandes reçues
                                    </CardTitle>
                                    {assignedCount > 0 ? (
                                        <span className={QUEUE_CHIP}>
                                            {assignedCount} à traiter
                                        </span>
                                    ) : (
                                        <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success-foreground dark:text-success">
                                            À jour
                                        </span>
                                    )}
                                </div>
                                <CardDescription>
                                    Les 5 dernières demandes de mission
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {overview.recentMissions.length > 0 ? (
                                    <>
                                        <ul className="flex flex-col gap-3">
                                            {overview.recentMissions.map(
                                                mission => (
                                                    <li
                                                        key={mission.id}
                                                        className="flex items-start gap-3"
                                                    >
                                                        <span
                                                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass(mission.patient.fullName)}`}
                                                            aria-hidden="true"
                                                        >
                                                            {initialsOf(
                                                                mission.patient
                                                                    .fullName
                                                            )}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold leading-tight">
                                                                {
                                                                    mission
                                                                        .patient
                                                                        .fullName
                                                                }
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {
                                                                    mission
                                                                        .appointment
                                                                        .specialty
                                                                        ?.name ??
                                                                    "Consultation"
                                                                }{" "}
                                                                ·{" "}
                                                                {
                                                                    mission
                                                                        .nurse
                                                                        .fullName
                                                                }{" "}
                                                                ·{" "}
                                                                <span suppressHydrationWarning>
                                                                    {relativePublishedLabel(
                                                                        mission.assignedAt
                                                                    )}
                                                                </span>
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${STATUS_PILL_CLASSES[mission.status]}`}
                                                        >
                                                            {
                                                                STATUS_LABELS[
                                                                    mission
                                                                        .status
                                                                ]
                                                            }
                                                        </span>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                onNavigate("missions")
                                            }
                                            className="mt-auto h-9 justify-between gap-1 rounded-full px-3 text-xs font-semibold text-primary hover:text-primary-dark"
                                        >
                                            Tout voir
                                            <ChevronRight
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </>
                                ) : (
                                    <p className="py-6 text-center text-sm text-muted-foreground">
                                        Aucune mission pour l&apos;instant.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        <Card
                            className={`rounded-2xl transition-colors ${
                                kpis.toDispatch > 0
                                    ? "border-warning/40 bg-warning/10"
                                    : ""
                            }`}
                        >
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base">
                                        À affecter
                                    </CardTitle>
                                    {kpis.toDispatch > 0 && (
                                        <span className="rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold text-warning-foreground">
                                            {kpis.toDispatch}
                                        </span>
                                    )}
                                </div>
                                <CardDescription>
                                    {kpis.toDispatch > 0
                                        ? `${kpis.toDispatch} RDV à domicile ${kpis.toDispatch > 1 ? "attendent" : "attend"} un infirmier`
                                        : "Prochains créneaux à domicile sans infirmier"}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {overview.upcomingVisits.length > 0 ? (
                                    <>
                                        <ul className="flex flex-col gap-3">
                                            {overview.upcomingVisits.map(
                                                visit => (
                                                    <li
                                                        key={visit.id}
                                                        className="flex items-start gap-3"
                                                    >
                                                        <span
                                                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass(visit.patientName)}`}
                                                            aria-hidden="true"
                                                        >
                                                            {initialsOf(
                                                                visit.patientName
                                                            )}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold leading-tight">
                                                                {
                                                                    visit.patientName
                                                                }
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                <span suppressHydrationWarning>
                                                                    {formatCardSlotUTC(
                                                                        visit.scheduledAt
                                                                    )}
                                                                </span>
                                                                {visit.specialtyName
                                                                    ? ` · ${visit.specialtyName}`
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                        <span
                                                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${zoneBadgeClass(visit.zone)}`}
                                                        >
                                                            {
                                                                ZONE_LABELS[
                                                                    visit.zone
                                                                ]
                                                            }
                                                        </span>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                        <Button
                                            type="button"
                                            onClick={() =>
                                                onNavigate("equipes")
                                            }
                                            className="mt-auto h-10 w-full justify-center gap-1.5 rounded-full bg-warning text-xs font-bold text-warning-foreground hover:bg-warning/90"
                                        >
                                            Ouvrir le dispatch
                                            <ArrowRight
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                                        <CircleCheck
                                            className="size-6 text-success"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            File vide — toutes les demandes à
                                            domicile ont leur infirmier.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card
                            className={`rounded-2xl transition-colors ${
                                kpis.rechargesPending > 0
                                    ? "border-warning/40 bg-warning/10"
                                    : ""
                            }`}
                        >
                            <CardHeader>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <CardTitle className="text-base">
                                        Recharges à valider
                                    </CardTitle>
                                    {kpis.rechargesPending > 0 && (
                                        <span className="rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-bold text-warning-foreground">
                                            {kpis.rechargesPending}
                                        </span>
                                    )}
                                </div>
                                <CardDescription>
                                    Paiements patients en attente de
                                    rapprochement
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-3">
                                {overview.pendingRecharges.length > 0 ? (
                                    <>
                                        <ul className="flex flex-col gap-3">
                                            {overview.pendingRecharges.map(
                                                recharge => (
                                                    <li
                                                        key={recharge.id}
                                                        className="flex items-start gap-3"
                                                    >
                                                        <span
                                                            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarClass(recharge.patientName)}`}
                                                            aria-hidden="true"
                                                        >
                                                            {initialsOf(
                                                                recharge.patientName
                                                            )}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-semibold leading-tight">
                                                                {
                                                                    recharge.patientName
                                                                }
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                <span suppressHydrationWarning>
                                                                    {relativePublishedLabel(
                                                                        recharge.createdAt
                                                                    )}
                                                                </span>{" "}
                                                                ·{" "}
                                                                {
                                                                    recharge.tokens
                                                                }{" "}
                                                                Token
                                                                {recharge.tokens >
                                                                1
                                                                    ? "s"
                                                                    : ""}
                                                            </p>
                                                        </div>
                                                        <span className="shrink-0 text-sm font-bold tabular-nums">
                                                            {recharge.amountFcfa.toLocaleString(
                                                                "fr-FR"
                                                            )}{" "}
                                                            FCFA
                                                        </span>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                onNavigate("recharges")
                                            }
                                            className="mt-auto h-9 justify-between gap-1 rounded-full px-3 text-xs font-semibold text-primary hover:text-primary-dark"
                                        >
                                            Valider les paiements
                                            <ChevronRight
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-6 text-center">
                                        <CircleCheck
                                            className="size-6 text-success"
                                            aria-hidden="true"
                                        />
                                        <p className="text-sm text-muted-foreground">
                                            Aucune recharge en attente —
                                            rapprochements à jour.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            ) : null}
        </div>
    )
}
