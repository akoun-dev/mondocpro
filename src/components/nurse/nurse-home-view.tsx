"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, CheckCircle2, ClipboardCheck, Loader2, MapPin, Phone, RefreshCw, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import type { AppUser } from "@/stores/auth-store"

type MissionStatus = "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
type Mission = {
    id: string
    status: MissionStatus
    scheduledAt?: string
    zone?: keyof typeof ZONE_LABELS
    patient?: { fullName?: string; phone?: string }
    appointment?: { scheduledAt?: string; type?: "CABINET" | "DOMICILE"; zone?: keyof typeof ZONE_LABELS; reason?: string }
}

const ACTIVE: MissionStatus[] = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]
const STATUS_LABELS: Record<MissionStatus, string> = {
    ASSIGNED: "À traiter", ACCEPTED: "Acceptée", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée",
}

function dateOf(mission: Mission) {
    return mission.scheduledAt ?? mission.appointment?.scheduledAt ?? ""
}

function today(value: string) {
    return new Date(value).toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" }) === new Date().toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })
}

function formatTime(value: string) {
    return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(value))
}

function formatDate() {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" }).format(new Date())
}

function Kpi({ icon: Icon, label, value, detail, onClick }: { icon: typeof ClipboardCheck; label: string; value: string; detail: string; onClick: () => void }) {
    return <button type="button" onClick={onClick} className="group flex min-h-36 flex-col gap-2 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4.5" aria-hidden="true" /></span>
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        <span className="mt-auto"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs leading-snug text-muted-foreground">{detail}</span></span>
    </button>
}

export function NurseHomeView({ user, onOpenMissions, onOpenPatients }: { user: AppUser; onOpenMissions: () => void; onOpenPatients?: () => void }) {
    const [missions, setMissions] = useState<Mission[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    async function refresh() {
        setLoading(true)
        setError(false)
        try {
            const response = await fetch("/api/nurse/missions", { cache: "no-store" })
            if (!response.ok) throw new Error("missions")
            const data = (await response.json()) as { missions?: Mission[] }
            setMissions(data.missions ?? [])
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void refresh() }, [])

    const todayMissions = useMemo(() => missions.filter(mission => dateOf(mission) && today(dateOf(mission))), [missions])
    const active = missions.filter(mission => ACTIVE.includes(mission.status))
    const completed = todayMissions.filter(mission => mission.status === "COMPLETED")
    const patientCount = new Set(missions.map(mission => mission.patient?.fullName).filter(Boolean)).size
    const next = active.filter(mission => new Date(dateOf(mission)).getTime() >= Date.now() - 60_000).sort((a, b) => dateOf(a).localeCompare(dateOf(b)))[0]

    return <section aria-label="Accueil infirmier" className="space-y-5">
        <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm capitalize text-muted-foreground">{formatDate()}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Bonjour, {user.fullName.trim().split(/\s+/)[0]}</h2><p className="mt-1 text-sm text-muted-foreground">Voici le résumé de votre activité.</p></div>
            <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Actualiser le tableau de bord infirmier"><RefreshCw className="size-4" aria-hidden="true" /></Button>
        </div>

        {error && <Card className="border-destructive/30 bg-destructive/5"><CardContent className="flex items-center justify-between gap-3 p-4 text-sm"><span>Impossible de charger les indicateurs.</span><Button variant="outline" size="sm" onClick={() => void refresh()}>Réessayer</Button></CardContent></Card>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {loading ? Array.from({ length: 4 }, (_, index) => <Card key={index} className="min-h-36 rounded-2xl"><CardContent className="space-y-3 p-4"><Skeleton className="size-9 rounded-xl" /><Skeleton className="h-8 w-14" /><Skeleton className="h-4 w-24" /></CardContent></Card>) : <>
                <Kpi icon={CalendarClock} value={String(todayMissions.length)} label="Missions du jour" detail="créneaux planifiés" onClick={onOpenMissions} />
                <Kpi icon={CheckCircle2} value={String(completed.length)} label="Terminées" detail="aujourd'hui" onClick={onOpenMissions} />
                <Kpi icon={ClipboardCheck} value={String(active.length)} label="À traiter" detail="missions actives" onClick={onOpenMissions} />
                <Kpi icon={UsersRound} value={String(patientCount)} label="Patients suivis" detail="ouvrir l'annuaire" onClick={onOpenPatients ?? onOpenMissions} />
            </>}
        </div>

        <Card className="rounded-2xl">
            <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Prochaine intervention</CardTitle><Badge variant="outline"><MapPin className="mr-1 size-3" aria-hidden="true" />{ZONE_LABELS[user.zone]}</Badge></CardHeader>
            <CardContent>{loading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Chargement…</div> : next ? <div className="flex items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="font-semibold">{formatTime(dateOf(next))} · {next.patient?.fullName ?? "Patient"}</p><p className="mt-1 text-xs text-muted-foreground">{next.appointment?.reason ?? "Consultation de soins"} · {next.appointment?.type === "DOMICILE" ? "À domicile" : "Au cabinet"}</p><p className="mt-1 text-xs text-primary">{STATUS_LABELS[next.status]}</p></div>{next.patient?.phone && <Button asChild variant="outline" size="icon" className="size-10 rounded-xl"><a href={`tel:${next.patient.phone}`} aria-label={`Appeler ${next.patient.fullName ?? "le patient"}`}><Phone className="size-4" aria-hidden="true" /></a></Button>}</div> : <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">Aucune intervention à venir.</p>}</CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2"><Button type="button" className="h-12 justify-start rounded-xl" onClick={onOpenMissions}><ClipboardCheck className="mr-2 size-4" aria-hidden="true" />Voir mes missions</Button><Button type="button" variant="outline" className="h-12 justify-start rounded-xl" onClick={onOpenPatients ?? onOpenMissions}><UsersRound className="mr-2 size-4" aria-hidden="true" />Voir mes patients</Button></div>
    </section>
}
