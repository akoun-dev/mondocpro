"use client"

// Accueil patient — maquette PO 2026-10 v2 : barre zone/date, salutation,
// carte héros « État consultations », raccourci « Mes rendez-vous » et
// campagnes de santé. Données partagées (usePatientData, monté dans
// UserDashboard) ; la réservation (BookAppointmentDialog) et la recharge
// (wallet réel du profil, FEATURE-TOKENS) sont portées par UserDashboard.
import { useState } from "react"
import { motion } from "framer-motion"
import { CalendarCheck, ChevronRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PatientData } from "@/hooks/use-patient-data"
import type { AppointmentDto } from "@/lib/appointments"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import type { AppUser } from "@/stores/auth-store"
import { formatHeaderDate } from "@/lib/datetime"
import type { SensibilisationDto } from "@/lib/sensibilisations"
import { NextAppointmentCard } from "./next-appointment-card"
import { HealthAlertCard } from "./health-alert-card"
import { AppointmentDetailDialog } from "./appointment-detail-dialog"

type Props = {
    user: AppUser
    data: PatientData
    onOpenAppointments: () => void
    onOpenArticle: (item: SensibilisationDto) => void
    onBook: () => void
    onRecharge: () => void
}

const WELCOME_TAGLINE =
    "Bienvenue sur notre portail de télémédecine et consultations de proximité à Abidjan."

// Transition d'entrée commune aux cartes (DESIGN_SYSTEM §4 : 220 ms, sobre).
const cardEntrance = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: "easeOut" as const, delay },
})

export function PatientHome({
    user,
    data,
    onOpenAppointments,
    onOpenArticle,
    onBook,
    onRecharge,
}: Props) {
    const [detail, setDetail] = useState<AppointmentDto | null>(null)
    const firstName = user.fullName.trim().split(/\s+/)[0] ?? ""

    return (
        <div className="flex flex-col gap-5">
            {data.stale && (
                <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-foreground"
                >
                    <span>Les données affichées peuvent être obsolètes.</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void data.refresh()}
                        className="h-8 shrink-0 rounded-lg text-xs"
                    >
                        Réessayer
                    </Button>
                </div>
            )}
            {data.error && data.appointments === null ? (
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
            ) : (
                <>
                    {/* Barre zone + date — maquette : pill commune à gauche, date UTC+0 à droite */}
                    <motion.section
                        {...cardEntrance()}
                        aria-label="Localisation et date"
                        className="flex items-center justify-between gap-3"
                    >
                        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-foreground">
                            <MapPin
                                className="size-3.5 shrink-0 text-primary"
                                aria-hidden="true"
                            />
                            <span className="truncate">
                                {ZONE_LABELS[user.zone]}, Abidjan
                            </span>
                        </span>
                        <span
                            className="shrink-0 text-xs text-muted-foreground"
                            suppressHydrationWarning
                        >
                            {formatHeaderDate()}
                        </span>
                    </motion.section>

                    {/* Salutation — maquette : titre + chip zone à droite, tagline, sans carte */}
                    <motion.section
                        {...cardEntrance(0.02)}
                        aria-label="Bienvenue"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                                Bonjour, {firstName} 👋
                            </h2>
                            <span className="inline-flex shrink-0 items-center rounded-full bg-muted/70 px-3 py-1.5 text-xs font-semibold text-foreground">
                                {ZONE_LABELS[user.zone]}
                            </span>
                        </div>
                        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
                            {WELCOME_TAGLINE}
                        </p>
                    </motion.section>

                    <NextAppointmentCard
                        appointments={data.appointments}
                        loading={data.loading}
                        onOpenDetail={setDetail}
                        onBook={onBook}
                        onRecharge={onRecharge}
                    />

                    {/* Raccourci « Mes rendez-vous » — maquette : carte-lien avec « Consulter » */}
                    <motion.section {...cardEntrance(0.04)}>
                        <button
                            type="button"
                            onClick={onOpenAppointments}
                            className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                        >
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <CalendarCheck
                                    className="size-5"
                                    aria-hidden="true"
                                />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold">
                                    Mes rendez-vous
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                    Historique des consultations et ordonnances
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                                Consulter
                                <ChevronRight
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </span>
                        </button>
                    </motion.section>

                    <HealthAlertCard
                        feed={data.sensibilisations}
                        loading={data.loading}
                        onOpenArticle={onOpenArticle}
                    />
                </>
            )}

            <AppointmentDetailDialog
                appointment={detail}
                onClose={() => setDetail(null)}
                onCancelled={() => void data.refresh()}
            />
        </div>
    )
}
