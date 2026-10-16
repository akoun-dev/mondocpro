"use client"

// Tableau de bord réel de l'accueil Médecin Chef — remplace les cartes
// « fonctionnalités bientôt disponibles » par des indicateurs exploités de
// bout en bout : files à traiter, activité des 14 derniers jours, charge par
// zone et répartition des missions. Un seul appel (GET /api/admin/stats)
// alimente tous les blocs pour que les chiffres ne se contredisent pas.
//
// Les KPI opérationnels sont cliquables (mêmes cibles que la barre latérale) :
// un indicateur qui alerte doit mener en un geste à l'écran qui le traite.
import {
  Activity,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Stethoscope,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LoadError,
  useAdminResource,
} from "@/components/admin/admin-directory-shared"
import { TOKEN_VALUE_FCFA } from "@/lib/token-schemas"
import type { AdminTab } from "@/components/admin/admin-sidebar"
import type { AdminStats } from "@/lib/admin-stats-schemas"

const MISSION_SERIES: ChartConfig = {
  missionsAssigned: { label: "Créées", color: "var(--chart-1)" },
  missionsCompleted: { label: "Terminées", color: "var(--chart-2)" },
}

const RECHARGE_SERIES: ChartConfig = {
  rechargeFcfa: { label: "FCFA crédités", color: "var(--chart-4)" },
}

const ZONE_SERIES: ChartConfig = {
  activeMissions: { label: "Missions actives", color: "var(--chart-1)" },
  unassigned: { label: "À affecter", color: "var(--chart-4)" },
}

function formatInt(value: number): string {
  return value.toLocaleString("fr-FR")
}

/** Axe Y monétaire compact : « 25 k » plutôt que « 25 000 ». */
function compactFcfa(value: number): string {
  if (value >= 1_000_000)
    return `${(value / 1_000_000).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} M`
  if (value >= 1_000) return `${Math.round(value / 1_000)} k`
  return `${value}`
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  alert,
  onClick,
}: {
  icon: LucideIcon
  label: string
  value: number
  hint?: string
  alert?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={`flex size-9 items-center justify-center rounded-lg ${
          alert
            ? "bg-warning/20 text-warning-foreground"
            : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span className="text-2xl font-bold tabular-nums">{formatInt(value)}</span>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {hint && (
        <span className="text-xs text-muted-foreground/80">{hint}</span>
      )}
    </button>
  )
}

function ChartCard({
  title,
  description,
  config,
  children,
}: {
  title: string
  description: string
  config: ChartConfig
  children: React.ReactElement
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
        {children}
      </ChartContainer>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Chargement">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[128px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-[260px] rounded-2xl" />
        <Skeleton className="h-[260px] rounded-2xl" />
      </div>
    </div>
  )
}

function StatsBody({
  stats,
  onOpenTab,
}: {
  stats: AdminStats
  onOpenTab: (tab: AdminTab) => void
}) {
  const { kpis } = stats
  const statusTotal = stats.statuses.reduce((sum, row) => sum + row.count, 0)
  return (
    <div className="grid gap-4">
      {/* KPI opérationnels — cliquables : l'alerte mène à l'écran qui traite. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardCheck}
          label="RDV à affecter"
          value={kpis.toDispatch}
          hint="File d'attente du dispatch"
          alert={kpis.toDispatch > 0}
          onClick={() => onOpenTab("missions")}
        />
        <KpiCard
          icon={Wallet}
          label="Recharges en attente"
          value={kpis.rechargesPending}
          hint="Paiements à rapprocher"
          alert={kpis.rechargesPending > 0}
          onClick={() => onOpenTab("recharges")}
        />
        <KpiCard
          icon={Activity}
          label="Missions actives"
          value={kpis.activeMissions}
          hint="Affectées, en cours"
          onClick={() => onOpenTab("missions")}
        />
        <KpiCard
          icon={Users}
          label="Équipes actives"
          value={kpis.activeNurses}
          hint={`${formatInt(kpis.inactiveNurses)} suspendu(e)s`}
          onClick={() => onOpenTab("infirmiers")}
        />
      </div>

      {/* Bandeau secondaire — contexte de la semaine, non cliquable. */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-3 sm:grid-cols-4">
        <SecondaryStat
          icon={CalendarClock}
          label="RDV aujourd'hui"
          value={formatInt(kpis.rdvToday)}
        />
        <SecondaryStat
          icon={Stethoscope}
          label="Patients actifs"
          value={formatInt(kpis.patients)}
        />
        <SecondaryStat
          icon={Activity}
          label="Terminées ce mois"
          value={formatInt(kpis.completedThisMonth)}
        />
        <SecondaryStat
          icon={Wallet}
          label="Tokens crédités (30 j)"
          value={`${formatInt(kpis.tokensCredited30d)} · ${formatInt(
            kpis.fcfaCredited30d
          )} FCFA`}
        />
      </div>

      {/* Séries glissantes — 14 jours. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Missions — 14 derniers jours"
          description="Créées le jour J vs terminées le jour J"
          config={MISSION_SERIES}
        >
          <BarChart data={stats.days} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              allowDecimals={false}
              width={28}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="missionsAssigned"
              fill="var(--color-missionsAssigned)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="missionsCompleted"
              fill="var(--color-missionsCompleted)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Recharges confirmées — 14 derniers jours"
          description={`Montant rapproché · 1 Token = ${formatInt(TOKEN_VALUE_FCFA)} FCFA`}
          config={RECHARGE_SERIES}
        >
          <BarChart data={stats.days}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              width={38}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tickFormatter={compactFcfa}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="rechargeFcfa"
              fill="var(--color-rechargeFcfa)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Charge par zone"
          description="Missions actives vs RDV encore à affecter"
          config={ZONE_SERIES}
        >
          <BarChart data={stats.zones} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
            />
            <YAxis
              allowDecimals={false}
              width={28}
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="activeMissions"
              fill="var(--color-activeMissions)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="unassigned"
              fill="var(--color-unassigned)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartCard>

        <div className="rounded-2xl border p-4">
          <p className="text-sm font-semibold">Missions par statut</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Toutes missions confondues, du plus récent
          </p>
          {stats.statuses.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Aucune mission enregistrée.
            </p>
          ) : (
            <ul className="grid gap-3">
              {stats.statuses.map(row => (
                <li key={row.status} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm">{row.label}</span>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatInt(row.count)}
                    </span>
                  </div>
                  <Progress
                    value={
                      statusTotal === 0 ? 0 : (row.count / statusTotal) * 100
                    }
                    aria-label={`${row.label} : ${row.count}`}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function SecondaryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

export function AdminOverview({
  onOpenTab,
}: {
  onOpenTab: (tab: AdminTab) => void
}) {
  const { data, loading, error, reload } = useAdminResource<AdminStats>(
    "/api/admin/stats"
  )

  const updatedAt = data
    ? new Date(data.generatedAt).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null

  return (
    <Card className="rounded-2xl">
      <CardHeader className="gap-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-success-light text-success-foreground">
                <Activity className="size-4.5" aria-hidden="true" />
              </span>
              Espace Médecin Chef
            </CardTitle>
            <CardDescription>
              {updatedAt
                ? `Indicateurs temps réel · actualisé à ${updatedAt}`
                : "Indicateurs temps réel de l'activité"}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
            className="h-9 shrink-0 rounded-xl"
            aria-label="Actualiser les indicateurs"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <LoadError onRetry={() => void reload()} />
        ) : loading && !data ? (
          <StatsSkeleton />
        ) : data ? (
          <StatsBody stats={data} onOpenTab={onOpenTab} />
        ) : null}
      </CardContent>
    </Card>
  )
}
