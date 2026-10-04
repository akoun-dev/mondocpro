"use client"

import { useEffect, useState } from "react"
import { CalendarClock, ChevronRight, Loader2, MapPin, Phone, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { ZONE_LABELS } from "@/lib/auth-schemas"

type MissionStatus = "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
type Mission = {
    id: string
    status: MissionStatus
    scheduledAt: string
    zone: keyof typeof ZONE_LABELS
    type: "CABINET" | "DOMICILE"
    patient?: { fullName?: string; phone?: string }
    appointment?: { reason?: string; specialty?: { name?: string } }
    report?: { observations?: string; actionsTaken?: string; recommendations?: string }
}

const STATUS_LABELS: Record<MissionStatus, string> = {
    ASSIGNED: "À traiter", ACCEPTED: "Acceptée", IN_PROGRESS: "En cours", COMPLETED: "Terminée", CANCELLED: "Annulée",
}
const STATUS_CLASSES: Record<MissionStatus, string> = {
    ASSIGNED: "bg-primary/10 text-primary", ACCEPTED: "bg-success/15 text-success-foreground", IN_PROGRESS: "bg-warning/20 text-warning-foreground",
    COMPLETED: "bg-success/15 text-success-foreground", CANCELLED: "bg-muted text-muted-foreground",
}

function formatSlot(value: string) {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(value))
}

function nextActions(status: MissionStatus): { action: string; label: string }[] {
    if (status === "ASSIGNED") return [{ action: "ACCEPTED", label: "Accepter" }, { action: "CANCELLED", label: "Refuser" }]
    if (status === "ACCEPTED") return [{ action: "IN_PROGRESS", label: "Démarrer l'intervention" }]
    if (status === "IN_PROGRESS") return [{ action: "REPORT", label: "Rédiger le compte rendu" }]
    return []
}

export function NurseMissionsView() {
    const [missions, setMissions] = useState<Mission[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [selected, setSelected] = useState<Mission | null>(null)
    const [reportOpen, setReportOpen] = useState(false)
    const [report, setReport] = useState({ observations: "", actsPerformed: "", recommendations: "" })
    const [saving, setSaving] = useState(false)

    async function refresh() {
        setLoading(true); setError(false)
        try {
            const response = await fetch("/api/nurse/missions", { cache: "no-store" })
            if (!response.ok) throw new Error("missions")
            const payload = await response.json() as { missions?: Mission[] } | Mission[]
            setMissions(Array.isArray(payload) ? payload : payload.missions ?? [])
        } catch { setError(true) } finally { setLoading(false) }
    }
    useEffect(() => { void refresh() }, [])

    async function transition(mission: Mission, action: string) {
        if (action === "REPORT") {
            setSelected(mission); setReport({ observations: "", actsPerformed: "", recommendations: "" }); setReportOpen(true); return
        }
        try {
            const response = await fetch(`/api/nurse/missions/${mission.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action }) })
            if (!response.ok) throw new Error("transition")
            toast({ title: "Mission mise à jour", description: "Le nouveau statut a été enregistré." }); await refresh(); setSelected(null)
        } catch { toast({ title: "Action impossible", description: "Cette mission a peut-être été modifiée entre-temps.", variant: "destructive" }) }
    }

    async function submitReport() {
        if (!selected || report.observations.trim().length < 3) return
        setSaving(true)
        try {
            const response = await fetch(`/api/nurse/missions/${selected.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ observations: report.observations, actionsTaken: report.actsPerformed, recommendations: report.recommendations }) })
            if (!response.ok) throw new Error("report")
            const complete = await fetch(`/api/nurse/missions/${selected.id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) })
            if (!complete.ok) throw new Error("complete")
            toast({ title: "Compte rendu enregistré", description: "La mission est maintenant terminée." }); setReportOpen(false); setSelected(null); await refresh()
        } catch { toast({ title: "Compte rendu non enregistré", description: "Vérifiez les champs puis réessayez.", variant: "destructive" }) } finally { setSaving(false) }
    }

    return <section aria-label="Mes missions" className="space-y-5">
        <div className="flex items-start justify-between gap-3">
            <div><h2 className="text-2xl font-bold tracking-tight">Mes missions</h2><p className="text-sm text-muted-foreground">Consultez vos interventions et mettez à jour leur avancement.</p></div>
            <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Actualiser les missions"><RefreshCw className="size-4" /></Button>
        </div>
        {loading && <div className="flex items-center justify-center rounded-2xl border bg-card py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Chargement des missions…</div>}
        {error && !loading && <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-sm text-muted-foreground">Impossible de charger vos missions.</p><Button variant="outline" onClick={() => void refresh()}>Réessayer</Button></CardContent></Card>}
        {!loading && !error && missions.length === 0 && <Card><CardContent className="flex flex-col items-center gap-2 py-14 text-center"><CalendarClock className="size-8 text-muted-foreground/60" /><p className="font-medium">Aucune mission pour le moment</p><p className="max-w-sm text-sm text-muted-foreground">Les missions qui vous seront affectées apparaîtront ici.</p></CardContent></Card>}
        {!loading && !error && missions.length > 0 && <div className="grid gap-4">{missions.map(mission => <Card key={mission.id} className="rounded-2xl"><CardHeader className="flex-row items-start justify-between gap-3 space-y-0"><div><CardTitle className="text-base">{mission.patient?.fullName ?? "Patient"}</CardTitle><CardDescription className="mt-1 capitalize">{formatSlot(mission.scheduledAt)}</CardDescription></div><Badge className={STATUS_CLASSES[mission.status]}>{STATUS_LABELS[mission.status]}</Badge></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2"><span><MapPin className="mr-1.5 inline size-4" />{mission.type === "DOMICILE" ? "À domicile" : "Au cabinet"} · {ZONE_LABELS[mission.zone] ?? mission.zone}</span><span>{mission.appointment?.specialty?.name ?? "Consultation"}</span></div>{mission.appointment?.reason && <p className="rounded-lg bg-muted/50 p-3 text-sm">Motif : {mission.appointment.reason}</p>}<div className="flex flex-wrap gap-2">{mission.patient?.phone && <Button variant="outline" size="sm" asChild><a href={`tel:${mission.patient.phone}`}><Phone className="mr-1.5 size-4" />Appeler</a></Button>}<Button variant="ghost" size="sm" onClick={() => setSelected(mission)}>Voir le détail<ChevronRight className="ml-1 size-4" /></Button>{nextActions(mission.status).map(item => <Button key={item.action} size="sm" variant={item.action === "REJECT" ? "destructive" : "default"} onClick={() => void transition(mission, item.action)}>{item.label}</Button>)}</div></CardContent></Card>)}</div>}

        <Dialog open={Boolean(selected) && !reportOpen} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent><DialogHeader><DialogTitle>Détail de la mission</DialogTitle><DialogDescription>{selected?.patient?.fullName ?? "Patient"} · {selected && formatSlot(selected.scheduledAt)}</DialogDescription></DialogHeader>{selected && <div className="space-y-3 text-sm"><p><strong>Lieu :</strong> {selected.type === "DOMICILE" ? "À domicile" : "Au cabinet"} · {ZONE_LABELS[selected.zone] ?? selected.zone}</p><p><strong>Spécialité :</strong> {selected.appointment?.specialty?.name ?? "Consultation"}</p>{selected.appointment?.reason && <p><strong>Motif :</strong> {selected.appointment.reason}</p>}<div className="flex flex-wrap gap-2">{nextActions(selected.status).map(item => <Button key={item.action} onClick={() => void transition(selected, item.action)} variant={item.action === "REJECT" ? "destructive" : "default"}>{item.label}</Button>)}</div></div>}</DialogContent></Dialog>
        <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent><DialogHeader><DialogTitle>Compte rendu de visite</DialogTitle><DialogDescription>Documentez l’intervention avant de la clôturer.</DialogDescription></DialogHeader><div className="space-y-4"><label className="grid gap-1.5 text-sm font-medium">Observations <Textarea value={report.observations} onChange={event => setReport(prev => ({ ...prev, observations: event.target.value }))} placeholder="Décrivez les observations utiles…" maxLength={2000} /></label><label className="grid gap-1.5 text-sm font-medium">Actes réalisés <Textarea value={report.actsPerformed} onChange={event => setReport(prev => ({ ...prev, actsPerformed: event.target.value }))} maxLength={2000} /></label><label className="grid gap-1.5 text-sm font-medium">Recommandations <Textarea value={report.recommendations} onChange={event => setReport(prev => ({ ...prev, recommendations: event.target.value }))} maxLength={2000} /></label></div><DialogFooter><Button variant="outline" onClick={() => setReportOpen(false)}>Annuler</Button><Button onClick={() => void submitReport()} disabled={saving || report.observations.trim().length < 3}>{saving && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer le compte rendu</Button></DialogFooter></DialogContent></Dialog>
        </section>
}
