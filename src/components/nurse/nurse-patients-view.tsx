"use client"

import { useEffect, useMemo, useState } from "react"
import { CalendarClock, Loader2, MapPin, Phone, RefreshCw, Search, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ZONE_LABELS } from "@/lib/auth-schemas"

type Patient = {
    id: string
    fullName: string
    phone: string
    zone: keyof typeof ZONE_LABELS
    missionCount: number
    lastMission: { status: string; scheduledAt: string; type: string; reason: string | null; specialty: string | null } | null
}

const STATUS_LABELS: Record<string, string> = {
    ASSIGNED: "À traiter",
    ACCEPTED: "Acceptée",
    IN_PROGRESS: "En cours",
    COMPLETED: "Terminée",
    CANCELLED: "Annulée",
}

function formatSlot(value: string) {
    return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }).format(new Date(value))
}

export function NursePatientsView() {
    const [patients, setPatients] = useState<Patient[]>([])
    const [query, setQuery] = useState("")
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    async function refresh() {
        setLoading(true)
        setError(false)
        try {
            const response = await fetch("/api/nurse/patients", { cache: "no-store" })
            if (!response.ok) throw new Error("patients")
            const data = (await response.json()) as { patients?: Patient[] }
            setPatients(data.patients ?? [])
        } catch {
            setError(true)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { void refresh() }, [])

    const filtered = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase("fr-FR")
        if (!normalized) return patients
        return patients.filter(patient => `${patient.fullName} ${patient.phone} ${patient.zone}`.toLocaleLowerCase("fr-FR").includes(normalized))
    }, [patients, query])

    return (
        <section aria-label="Tous les patients" className="space-y-5">
            <div className="flex items-start justify-between gap-3">
                <div><h2 className="text-2xl font-bold tracking-tight">Tous les patients</h2><p className="text-sm text-muted-foreground">Annuaire des patients de Mon doc Pro.</p></div>
                <Button variant="outline" size="icon" onClick={() => void refresh()} aria-label="Actualiser les patients"><RefreshCw className="size-4" aria-hidden="true" /></Button>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Rechercher un patient…" aria-label="Rechercher un patient" className="h-11 rounded-xl pl-9" /></div>
            {loading && <div className="flex items-center justify-center rounded-2xl border bg-card py-16 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Chargement des patients…</div>}
            {error && !loading && <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center"><p className="text-sm text-muted-foreground">Impossible de charger l’annuaire des patients.</p><Button variant="outline" onClick={() => void refresh()}>Réessayer</Button></CardContent></Card>}
            {!loading && !error && filtered.length === 0 && <Card className="rounded-2xl"><CardContent className="flex flex-col items-center gap-2 py-14 text-center"><UsersRound className="size-9 text-muted-foreground/60" /><p className="font-medium">{patients.length === 0 ? "Aucun patient enregistré" : "Aucun résultat"}</p><p className="max-w-sm text-sm text-muted-foreground">{patients.length === 0 ? "Les patients inscrits apparaîtront ici." : "Essayez avec un autre nom ou numéro."}</p></CardContent></Card>}
            {!loading && !error && filtered.length > 0 && <div className="grid gap-3">{filtered.map(patient => <Card key={patient.id} className="rounded-2xl"><CardHeader className="flex-row items-start justify-between gap-3 space-y-0"><div className="flex min-w-0 items-center gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><UsersRound className="size-5" aria-hidden="true" /></span><div className="min-w-0"><CardTitle className="truncate text-base">{patient.fullName}</CardTitle><CardDescription className="mt-1 flex items-center gap-1"><MapPin className="size-3.5" aria-hidden="true" />{ZONE_LABELS[patient.zone] ?? patient.zone} · {patient.missionCount} mission{patient.missionCount > 1 ? "s" : ""}</CardDescription></div></div><Badge className="shrink-0 bg-primary/10 text-primary">{patient.lastMission ? STATUS_LABELS[patient.lastMission.status] ?? patient.lastMission.status : "Patient"}</Badge></CardHeader><CardContent className="space-y-3">{patient.lastMission ? <div className="rounded-xl bg-muted/50 p-3 text-sm"><p className="flex items-center gap-1.5 font-medium"><CalendarClock className="size-4 text-primary" aria-hidden="true" />Dernière intervention : {formatSlot(patient.lastMission.scheduledAt)}</p><p className="mt-1 text-xs text-muted-foreground">{patient.lastMission.specialty ?? "Consultation"} · {patient.lastMission.type === "DOMICILE" ? "À domicile" : "Au cabinet"}{patient.lastMission.reason ? ` · ${patient.lastMission.reason}` : ""}</p></div> : <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Aucune mission enregistrée avec vous.</p>}<Button variant="outline" size="sm" className="h-10 rounded-xl" asChild><a href={`tel:${patient.phone}`}><Phone className="mr-1.5 size-4" aria-hidden="true" />Appeler le patient</a></Button></CardContent></Card>)}</div>}
        </section>
    )
}
