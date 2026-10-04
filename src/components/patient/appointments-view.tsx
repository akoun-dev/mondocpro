"use client"

// Vue « Mes rendez-vous » — maquette PO 2026-10 (pastedImage 1790982…):
// titre + sous-titre + bouton « + Nouveau RDV », onglets segmentés
// À venir (n) / Passées (n), cartes RDV (réf, badge statut, type • spécialité,
// créneau bleu, actions Détail / Annuler). Vue de 1er niveau (menu « Rendez-vous »
// de la navigation basse — pas de flèche retour). Réservation via le dialog
// partagé BookAppointmentDialog (monté dans UserDashboard) ; annulation via le détail.
import { useMemo, useState } from "react"
import {
    Building2,
    CalendarDays,
    CalendarPlus,
    CalendarX2,
    CircleX,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { PatientData } from "@/hooks/use-patient-data"
import type { AppointmentDto } from "@/lib/appointments"
import { cancelAppointmentReminders } from "@/lib/native"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import { appointmentRef, formatCardSlotUTC } from "@/lib/datetime"
import { APPOINTMENT_TYPE_LABELS, AppointmentStatusBadge } from "./shared"
import { AppointmentDetailDialog } from "./appointment-detail-dialog"

type Props = {
    data: PatientData
    onBook: () => void
}

type RdvTab = "upcoming" | "past"

const NOW_MARGIN_MS = 60_000

export function AppointmentsView({ data, onBook }: Props) {
    const [tab, setTab] = useState<RdvTab>("upcoming")
    const [detail, setDetail] = useState<AppointmentDto | null>(null)

    const { upcoming, history } = useMemo(() => {
        const now = Date.now()
        const list = data.appointments ?? []
        const active = list.filter(
            appointment =>
                (appointment.status === "PENDING" ||
                    appointment.status === "CONFIRMED") &&
                new Date(appointment.scheduledAt).getTime() >=
                    now - NOW_MARGIN_MS
        )
        active.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        const past = list.filter(appointment => !active.includes(appointment))
        past.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
        return { upcoming: active, history: past }
    }, [data.appointments])

    // Carte RDV maquette : réf + badge, bloc praticien (icône, intitulé,
    // spécialité • zone), créneau en bleu, actions Détail (+ Annuler si actif).
    const renderCard = (appointment: AppointmentDto) => {
        const isActive =
            appointment.status === "PENDING" ||
            appointment.status === "CONFIRMED"
        return (
            <li
                key={appointment.id}
                className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
                aria-label={`Rendez-vous ${appointmentRef(appointment.id)}`}
            >
                <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        {appointmentRef(appointment.id)}
                    </p>
                    <AppointmentStatusBadge status={appointment.status} />
                </div>

                <div className="mt-3 flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {appointment.type === "CABINET" ? (
                            <Building2 className="size-5" aria-hidden="true" />
                        ) : (
                            <CalendarDays
                                className="size-5"
                                aria-hidden="true"
                            />
                        )}
                    </span>
                    <div className="min-w-0">
                        <p className="truncate text-[15px] font-bold leading-tight">
                            {APPOINTMENT_TYPE_LABELS[appointment.type]}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {appointment.specialty?.name ?? "Médecine générale"}{" "}
                            • {ZONE_LABELS[appointment.zone]}
                        </p>
                    </div>
                </div>

                <p
                    className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-primary"
                    suppressHydrationWarning
                >
                    <CalendarDays className="size-4" aria-hidden="true" />
                    {formatCardSlotUTC(appointment.scheduledAt)}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3.5">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDetail(appointment)}
                        className="h-9 min-w-24 rounded-lg text-xs font-semibold"
                    >
                        Détail
                    </Button>
                    {isActive ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetail(appointment)}
                            className="h-9 gap-1.5 rounded-lg px-3 text-xs font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                            <CircleX className="size-4" aria-hidden="true" />
                            Annuler
                        </Button>
                    ) : (
                        <span />
                    )}
                </div>
            </li>
        )
    }

    const tabButton = (id: RdvTab, label: string, count: number) => (
        <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`min-h-9 flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                tab === id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {label}
            {count > 0 ? ` (${count})` : ""}
        </button>
    )

    const visible = tab === "upcoming" ? upcoming : history

    return (
        <div className="flex flex-col gap-5">
            {/* En-tête maquette : titre + sous-titre à gauche, « + Nouveau RDV » à droite */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                        Mes rendez-vous
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                        Consultez et gérez vos consultations
                    </p>
                </div>
                <Button
                    onClick={onBook}
                    className="h-10 shrink-0 gap-1.5 rounded-xl text-sm font-semibold"
                >
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    Nouveau RDV
                </Button>
            </div>

            {/* Onglets segmentés — conteneur gris, actif bleu primaire (maquette) */}
            <div
                role="group"
                aria-label="Filtrer les rendez-vous"
                className="flex items-center gap-1 rounded-xl bg-muted p-1"
            >
                {tabButton("upcoming", "À venir", upcoming.length)}
                {tabButton("past", "Passées", history.length)}
            </div>

            {data.stale && (
                <div
                    role="status"
                    className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs"
                >
                    Les données affichées peuvent être obsolètes. Réessayez
                    depuis le bouton d’actualisation.
                </div>
            )}

            {data.loading && data.appointments === null ? (
                <ul
                    className="grid gap-3"
                    aria-busy="true"
                    aria-label="Chargement des rendez-vous"
                >
                    {[0, 1, 2].map(index => (
                        <li key={index}>
                            <Skeleton
                                className="h-[172px] rounded-2xl"
                                aria-hidden="true"
                            />
                        </li>
                    ))}
                </ul>
            ) : data.error && data.appointments === null ? (
                <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
                    <p className="text-sm font-medium">{data.error}</p>
                    <Button
                        variant="outline"
                        onClick={() => void data.refresh()}
                        className="mt-4 h-10 gap-2 rounded-xl text-sm font-semibold"
                    >
                        Réessayer
                    </Button>
                </div>
            ) : visible.length > 0 ? (
                <ul className="grid gap-3">{visible.map(renderCard)}</ul>
            ) : (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 p-8 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <CalendarX2 className="size-6" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="font-bold">
                            {tab === "upcoming"
                                ? "Aucun rendez-vous à venir"
                                : "Aucune consultation passée"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {tab === "upcoming"
                                ? "Prenez rendez-vous en un instant, du lundi au vendredi."
                                : "Vos consultations passées apparaîtront ici."}
                        </p>
                    </div>
                    {tab === "upcoming" && (
                        <Button
                            onClick={onBook}
                            className="mt-1 h-10 gap-1.5 rounded-xl text-sm font-semibold"
                        >
                            <CalendarPlus
                                className="size-4"
                                aria-hidden="true"
                            />
                            Prendre rendez-vous
                        </Button>
                    )}
                </div>
            )}

            <AppointmentDetailDialog
                appointment={detail}
                onClose={() => setDetail(null)}
                onCancelled={(appointment) => {
                    void data.refresh()
                    // Task 36 — rappels LOCAUX retirés de l'appareil.
                    void cancelAppointmentReminders(appointment.id)
                }}
            />
        </div>
    )
}
