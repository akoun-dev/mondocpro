"use client"

// Accueil du Médecin Chef — TABLEAU DE BORD (FEATURE-ADMIN-DASHBOARD,
// demande PO 2026-10-05 : « propose une meilleure dashboard pour admin,
// avec des cards et stats »). Remplace l'ancien empilement de raccourcis
// par une photosynthèse en un appel : GET /api/admin/overview (KPI réels,
// visites terminées 7 jours, répartition par zone, trois files d'action).
// Chaque carte est un raccourci vers la vue qui permet d'agir.
import { useCallback, useEffect, useState } from "react"
import {
    Banknote,
    CalendarCheck,
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
    CartesianGrid,
    XAxis,
} from "recharts"

import type { AdminTab } from "@/components/admin/admin-sidebar"
import { Badge } from "@/components/ui/badge"
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

// Même langage visuel que les vues missions (badge de statut).
const STATUS_LABELS: Record<MissionStatus, string> = {
    ASSIGNED: "À traiter",
    ACCEPTED: "Acceptée",
    IN_PROGRESS: "En cours",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
}

const STATUS_CLASSES: Record<MissionStatus, string> = {
    ASSIGNED: "bg-primary/10 text-primary",
    ACCEPTED: "bg-success/15 text-success-foreground",
    IN_PROGRESS: "bg-warning/20 text-warning-foreground",
    COMPLETED: "bg-success/15 text-success-foreground",
    CANCELLED: "bg-muted text-muted-foreground",
}

// Carte KPI — toute la carte est un raccourci vers la vue d'action.
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
    value: number
    sub: string
    alert?: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="flex items-center justify-between gap-2">
                <span
                    className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                        alert
                            ? "bg-warning/15 text-warning-foreground"
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
    const zoneMax = Math.max(
        1,
        ...(overview?.activeByZone.map(stat => stat.active) ?? [0])
    )
    const chartData =
        overview?.completedByDay.map(day => ({
            label: day.label,
            visites: day.count,
        })) ?? []

    return (
        <div className="flex flex-col gap-6">
            {/* Héro de bienvenue — dégradé médical, texte blanc AA */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-primary-foreground sm:p-8">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/[0.07] blur-xl" />
                </div>
                <div className="relative flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-2">
                        <p className="text-sm text-white/80">
                            <RefreshCw
                                className="mr-1.5 inline size-3.5 -translate-y-px"
                                aria-hidden="true"
                            />
                            <span suppressHydrationWarning>
                                {new Date().toLocaleDateString("fr-FR", {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                })}
                            </span>
                        </p>
                        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            Bonjour, {userName}
                        </h2>
                        <p className="max-w-xl text-sm leading-relaxed text-white/80">
                            Voici l&apos;état de votre plateforme — patients,
                            équipes, missions et paiements en un coup d&apos;œil.
                        </p>
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
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Skeleton
                            className="h-[280px] rounded-2xl"
                            aria-hidden="true"
                        />
                        <Skeleton
                            className="h-[280px] rounded-2xl"
                            aria-hidden="true"
                        />
                    </div>
                    <div className="grid gap-4 xl:grid-cols-3">
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
                    {/* Cartes KPI — les 6 piliers opérationnels, chacun
                        renvoyant vers la vue qui permet d'agir */}
                    <div
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
                        aria-label="Indicateurs clés de la plateforme"
                    >
                        <KpiCard
                            icon={UserRound}
                            label="Patients"
                            value={kpis.patientsTotal}
                            sub={`${kpis.patientsActive} compte${kpis.patientsActive > 1 ? "s" : ""} actif${kpis.patientsActive > 1 ? "s" : ""}`}
                            onClick={() => onNavigate("patients")}
                        />
                        <KpiCard
                            icon={Stethoscope}
                            label="Infirmiers"
                            value={kpis.nursesTotal}
                            sub={`${kpis.nursesActive} en activité`}
                            onClick={() => onNavigate("infirmiers")}
                        />
                        <KpiCard
                            icon={ClipboardCheck}
                            label="Missions actives"
                            value={kpis.missionsActive}
                            sub="assignées à en cours"
                            onClick={() => onNavigate("missions")}
                        />
                        <KpiCard
                            icon={Hourglass}
                            label="À affecter"
                            value={kpis.toDispatch}
                            sub="RDV à domicile sans soignant"
                            alert={kpis.toDispatch > 0}
                            onClick={() => onNavigate("equipes")}
                        />
                        <KpiCard
                            icon={Banknote}
                            label="Recharges"
                            value={kpis.rechargesPending}
                            sub={`${kpis.rechargesPendingFcfa.toLocaleString("fr-FR")} FCFA à confirmer`}
                            alert={kpis.rechargesPending > 0}
                            onClick={() => onNavigate("recharges")}
                        />
                        <KpiCard
                            icon={CalendarCheck}
                            label="RDV du jour"
                            value={kpis.appointmentsToday}
                            sub="consultations prévues"
                            onClick={() => onNavigate("missions")}
                        />
                    </div>

                    {/* Statistiques — activité hebdomadaire + répartition
                        par zone */}
                    <div className="grid gap-4 xl:grid-cols-2">
                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Visites terminées
                                </CardTitle>
                                <CardDescription>
                                    Missions réalisées sur les 7 derniers jours
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ChartContainer
                                    config={chartConfig}
                                    className="h-[220px] w-full"
                                >
                                    <BarChart
                                        accessibilityLayer
                                        data={chartData}
                                    >
                                        <CartesianGrid vertical={false} />
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
                                            fill="var(--color-visites)"
                                            radius={6}
                                        />
                                    </BarChart>
                                </ChartContainer>
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
                            <CardContent className="flex flex-col gap-4">
                                {overview.activeByZone.map(stat => (
                                    <div
                                        key={stat.zone}
                                        className="flex flex-col gap-1.5"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold">
                                                {ZONE_LABELS[stat.zone]}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                {stat.queue > 0 && (
                                                    <Badge className="bg-warning text-warning-foreground">
                                                        +{stat.queue} à
                                                        affecter
                                                    </Badge>
                                                )}
                                                <span className="text-sm font-bold tabular-nums">
                                                    {stat.active}
                                                </span>
                                            </span>
                                        </div>
                                        <div
                                            className="h-2 overflow-hidden rounded-full bg-muted"
                                            role="img"
                                            aria-label={`${ZONE_LABELS[stat.zone]} : ${stat.active} mission${stat.active > 1 ? "s" : ""} active${stat.active > 1 ? "s" : ""}, ${stat.queue} en file`}
                                        >
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{
                                                    width: `${Math.max(
                                                        stat.active > 0
                                                            ? 8
                                                            : 0,
                                                        (stat.active /
                                                            zoneMax) *
                                                            100
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Files d'action — missions récentes, dispatch, paiements */}
                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Dernières missions
                                </CardTitle>
                                <CardDescription>
                                    Les 5 interventions les plus récentes
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
                                                        className="flex items-start justify-between gap-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">
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
                                                        <Badge
                                                            className={`shrink-0 ${STATUS_CLASSES[mission.status]}`}
                                                        >
                                                            {
                                                                STATUS_LABELS[
                                                                    mission
                                                                        .status
                                                                ]
                                                            }
                                                        </Badge>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                onNavigate("missions")
                                            }
                                            className="mt-auto h-9 justify-between gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:text-primary-dark"
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

                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    À affecter
                                    {kpis.toDispatch > 0 && (
                                        <Badge className="bg-warning text-warning-foreground">
                                            {kpis.toDispatch}
                                        </Badge>
                                    )}
                                </CardTitle>
                                <CardDescription>
                                    Prochains créneaux à domicile sans
                                    infirmier
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
                                                        className="flex items-start justify-between gap-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">
                                                                {
                                                                    visit.patientName
                                                                }
                                                            </p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                <span suppressHydrationWarning>
                                                                    {formatCardSlotUTC(
                                                                        visit.scheduledAt
                                                                    )}
                                                                </span>{" "}
                                                                ·{" "}
                                                                {
                                                                    visit.specialtyName ??
                                                                    "Consultation"
                                                                }
                                                            </p>
                                                        </div>
                                                        <Badge
                                                            variant="outline"
                                                            className="shrink-0 text-xs font-semibold"
                                                        >
                                                            {
                                                                ZONE_LABELS[
                                                                    visit.zone
                                                                ]
                                                            }
                                                        </Badge>
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                        <Button
                                            variant="ghost"
                                            onClick={() =>
                                                onNavigate("equipes")
                                            }
                                            className="mt-auto h-9 justify-between gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:text-primary-dark"
                                        >
                                            Ouvrir le dispatch
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
                                            File vide — toutes les demandes à
                                            domicile ont leur infirmier.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    Recharges à valider
                                    {kpis.rechargesPending > 0 && (
                                        <Badge className="bg-warning text-warning-foreground">
                                            {kpis.rechargesPending}
                                        </Badge>
                                    )}
                                </CardTitle>
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
                                                        className="flex items-start justify-between gap-3"
                                                    >
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-semibold">
                                                                {
                                                                    recharge.patientName
                                                                }
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                <span suppressHydrationWarning>
                                                                    {relativePublishedLabel(
                                                                        recharge.createdAt
                                                                    )}
                                                                </span>{" "}
                                                                ·{" "}
                                                                {recharge.tokens}{" "}
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
                                            className="mt-auto h-9 justify-between gap-1 rounded-lg px-2 text-xs font-semibold text-primary hover:text-primary-dark"
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
