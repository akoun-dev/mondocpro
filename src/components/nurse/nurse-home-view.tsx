"use client"

import { useEffect, useMemo, useState } from "react"
import {
    Activity,
    Bell,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock3,
    MapPin,
    Navigation,
    Phone,
    RefreshCw,
    Stethoscope,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import type { AppUser } from "@/stores/auth-store"

type MissionStatus = "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
type Mission = {
    id: string
    status: MissionStatus
    scheduledAt?: string
    zone?: keyof typeof ZONE_LABELS
    patient?: { fullName?: string; phone?: string }
    appointment?: {
        type?: "CABINET" | "DOMICILE"
        zone?: keyof typeof ZONE_LABELS
        reason?: string
        scheduledAt?: string
        specialty?: { name?: string }
    }
}

const ACTIVE_STATUSES: MissionStatus[] = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"]

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Africa/Abidjan",
    }).format(date)
}

function formatTime(value: string) {
    return new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Africa/Abidjan",
    }).format(new Date(value))
}

function isToday(value: string) {
    const date = new Date(value)
    const now = new Date()
    return date.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" }) ===
        now.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })
}

function missionDate(mission: Mission) {
    return mission.scheduledAt ?? mission.appointment?.scheduledAt ?? ""
}

export function NurseHomeView({ user, onOpenMissions }: { user: AppUser; onOpenMissions: () => void }) {
    const [missions, setMissions] = useState<Mission[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [available, setAvailable] = useState(true)

    async function loadMissions() {
        setLoading(true)
        setError(false)
        try {
            const response = await fetch("/api/nurse/missions", { cache: "no-store" })
            if (!response.ok) throw new Error("missions")
            const payload = (await response.json()) as { missions?: Mission[] }
            setMissions(payload.missions ?? [])
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadMissions()
    }, [])

    const todayMissions = useMemo(() => missions.filter(mission => missionDate(mission) && isToday(missionDate(mission))), [missions])
    const completedToday = todayMissions.filter(mission => mission.status === "COMPLETED").length
    const activeToday = todayMissions.filter(mission => ACTIVE_STATUSES.includes(mission.status))
    const nextMission = activeToday
        .filter(mission => new Date(missionDate(mission)).getTime() >= Date.now() - 60_000)
        .sort((a, b) => missionDate(a).localeCompare(missionDate(b)))[0]
    const progress = todayMissions.length > 0 ? Math.round((completedToday / todayMissions.length) * 100) : 0

    return (
        <section aria-label="Accueil infirmier" className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-end">
                <Button variant="ghost" size="icon" onClick={() => void loadMissions()} aria-label="Actualiser l'accueil infirmier" className="size-10 rounded-full">
                    <RefreshCw className="size-4" aria-hidden="true" />
                </Button>
            </div>

            <div className="relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-primary via-primary to-primary-dark p-5 text-primary-foreground shadow-lg shadow-primary/15 sm:p-7">
                <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
                <div className="relative space-y-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        <span suppressHydrationWarning>{formatDate(new Date())}</span>
                    </p>
                    <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                        Bonjour, {user.fullName.trim().split(/\s+/)[0]} <span aria-hidden="true">👋</span>
                    </h2>
                    <p className="max-w-md text-xs leading-relaxed text-white/75 sm:text-sm">
                        Votre espace de soins à domicile, pour suivre vos interventions et vos patients en toute simplicité.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/20">
                            <Stethoscope className="mr-1 inline size-3" aria-hidden="true" /> Infirmier DE
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/20">
                            <MapPin className="mr-1 inline size-3" aria-hidden="true" /> {ZONE_LABELS[user.zone]}
                        </span>
                        <span className="rounded-full bg-success/90 px-3 py-1 text-[11px] font-semibold text-success-foreground">
                            <span className="mr-1 inline-block size-1.5 rounded-full bg-success-foreground" aria-hidden="true" /> En ligne
                        </span>
                    </div>
                </div>
            </div>

            {error && (
                <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
                        <span>Les missions ne peuvent pas être chargées.</span>
                        <Button variant="outline" size="sm" onClick={() => void loadMissions()}>Réessayer</Button>
                    </CardContent>
                </Card>
            )}

            <Card className="rounded-2xl border-0 bg-card shadow-sm ring-1 ring-border/70">
                <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="size-4" aria-hidden="true" /></span>
                            <div><p className="text-sm font-bold">Avancement tournée</p><p className="text-xs text-muted-foreground">{loading ? "Chargement…" : `${completedToday} / ${todayMissions.length} missions effectuées`}</p></div>
                        </div>
                        <Badge className="bg-primary/10 text-primary">{loading ? "—" : `${progress}%`}</Badge>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-0 bg-card shadow-sm ring-1 ring-border/70">
                <CardContent className="p-4 sm:p-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Prochaine intervention</p>
                        {nextMission && <Badge variant="outline" className="gap-1 text-[10px]"><MapPin className="size-3" aria-hidden="true" /> GPS</Badge>}
                    </div>
                    {nextMission ? (
                        <div className="flex items-start gap-3">
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="size-5" aria-hidden="true" /></span>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold">{formatTime(missionDate(nextMission))} · {nextMission.patient?.fullName ?? "Patient"}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{nextMission.appointment?.reason ?? "Consultation de soins"}</p>
                                <p className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"><MapPin className="size-3.5" aria-hidden="true" /> {nextMission.appointment?.type === "DOMICILE" ? "À domicile" : "Au cabinet"} · {ZONE_LABELS[nextMission.appointment?.zone ?? nextMission.zone ?? user.zone]}</p>
                            </div>
                            {nextMission.patient?.phone && <Button variant="outline" size="icon" className="size-10 shrink-0 rounded-xl" asChild><a href={`tel:${nextMission.patient.phone}`} aria-label={`Appeler ${nextMission.patient.fullName ?? "le patient"}`}><Phone className="size-4" aria-hidden="true" /></a></Button>}
                        </div>
                    ) : <div className="rounded-xl bg-muted/60 p-4 text-center text-sm text-muted-foreground">Aucune intervention à venir aujourd'hui.</div>}
                </CardContent>
            </Card>

            <button type="button" onClick={onOpenMissions} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="size-5" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-bold">Mes missions <Badge className="bg-primary/10 text-[10px] text-primary">{activeToday.length} actives</Badge></span><span className="block text-xs text-muted-foreground">Consultez vos interventions et comptes rendus</span></span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>

            <section aria-labelledby="nurse-tools" className="space-y-3">
                <div><h3 id="nurse-tools" className="text-base font-bold">Espace infirmier</h3><p className="text-xs text-muted-foreground">Les outils essentiels pour votre tournée</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-border/70"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-success-light text-success-foreground"><Bell className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Missions en direct</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Recevez les demandes urgentes et suivez vos missions spontanées.</p></div></div><Button type="button" onClick={() => { setAvailable(value => !value); toast({ title: available ? "Mode disponible désactivé" : "Vous êtes disponible", description: available ? "Vous ne recevrez plus de nouvelles demandes." : "Les nouvelles demandes peuvent vous être affectées." }) }} className={`mt-4 h-10 w-full rounded-xl text-xs font-bold ${available ? "bg-success text-success-foreground hover:bg-success/90" : "bg-muted text-muted-foreground hover:bg-muted"}`}><CheckCircle2 className="mr-1.5 size-4" aria-hidden="true" />{available ? "Disponible — ouvrir le radar" : "Indisponible — activer"}</Button></CardContent></Card>
                    <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-border/70"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Navigation className="size-4" aria-hidden="true" /></span><div><p className="text-sm font-bold">Itinéraire optimisé</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Organisez votre tournée à partir de vos interventions confirmées.</p></div></div><Button type="button" variant="outline" onClick={() => toast({ title: "Itinéraire bientôt disponible", description: "La carte sera activée avec la géolocalisation des interventions." })} className="mt-4 h-10 w-full rounded-xl text-xs"><Navigation className="mr-1.5 size-3.5" aria-hidden="true" /> Afficher la carte</Button></CardContent></Card>
                    <Card className="rounded-2xl border-0 shadow-sm ring-1 ring-border/70 sm:col-span-2"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Stethoscope className="size-4" aria-hidden="true" /></span><div className="min-w-0 flex-1"><p className="text-sm font-bold">Comptes rendus & constantes</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Documentez chaque visite et retrouvez vos comptes rendus depuis Mes missions.</p></div></div><Button type="button" variant="outline" onClick={onOpenMissions} className="mt-4 h-10 rounded-xl text-xs">Ouvrir mes comptes rendus <ChevronRight className="ml-1.5 size-3.5" aria-hidden="true" /></Button></CardContent></Card>
                </div>
            </section>
        </section>
    )
}
