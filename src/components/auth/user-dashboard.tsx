"use client"

// Espace connecté MVP — US-AUTH-3/4 (SPEC-AUTH) + FEATURE-PATIENT UI (maquette PO 2026-10)
// Design v3 « app mobile » : barre d'app sticky (zone, actualiser, notifications),
// navigation basse flottante (patient : Accueil / Rendez-vous / Profil — autres
// rôles : Accueil / Profil), vues animées sobres framer-motion
// (DESIGN_SYSTEM §4). Accueil patient dédié (src/components/patient/) branché sur les
// API contractées ; rôles NURSE/ADMIN inchangés (cartes « à venir »).
import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
    Activity,
    BarChart3,
    Bell,
    BellRing,
    CalendarCheck,
    ChevronRight,
    ClipboardCheck,
    Clock,
    HeartPulse,
    Home,
    LogOut,
    MapPin,
    MapPinned,
    Megaphone,
    Phone,
    RefreshCw,
    Stethoscope,
    Tags,
    UserRound,
    UsersRound,
    Wallet,
    type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ZONE_LABELS } from "@/lib/auth-schemas"
import {
    relativePublishedLabel,
    relativeSlotLabel,
} from "@/lib/datetime"
import { formatPhoneDisplay } from "@/lib/phone"
import { getInitials } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { usePatientData } from "@/hooks/use-patient-data"
import { toast } from "@/hooks/use-toast"
import type { AppRole, AppUser } from "@/stores/auth-store"
import type { PatientData } from "@/hooks/use-patient-data"
import type { SensibilisationDto } from "@/lib/sensibilisations"
import type { AppointmentDto } from "@/lib/appointments"
import type {
    NotificationDto,
    NotificationsResponse,
} from "@/lib/notifications"
import { PatientHome } from "@/components/patient/patient-home"
import { AppointmentsView } from "@/components/patient/appointments-view"
import { SensibilisationsView } from "@/components/patient/sensibilisations-view"
import { ProfileView } from "@/components/patient/profile-view"
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog"
import { SensibilisationDialog } from "@/components/patient/sensibilisation-dialog"
import { SpecialtiesView } from "@/components/admin/specialties-view"
import { RechargesView } from "@/components/admin/recharges-view"
import { TariffsView } from "@/components/admin/tariffs-view"

const ROLE_LABELS: Record<AppRole, string> = {
    PATIENT: "Patient",
    NURSE: "Infirmier",
    ADMIN: "Médecin Chef",
}

const ROLE_SPACE_ICON: Record<AppRole, LucideIcon> = {
    PATIENT: HeartPulse,
    NURSE: Stethoscope,
    ADMIN: UsersRound,
}

// Contrainte a11y (ADR-002) : jamais de texte blanc sur success/warning —
// les foregrounds foncés des tokens sont utilisés tels quels.
const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
    PATIENT: "bg-primary text-primary-foreground",
    NURSE: "bg-success text-success-foreground",
    ADMIN: "bg-warning text-warning-foreground",
}

interface SpaceFeature {
    icon: LucideIcon
    title: string
    description: string
}

const ROLE_SPACE: Record<
    AppRole,
    { title: string; description: string; features: SpaceFeature[] }
> = {
    PATIENT: {
        title: "Espace Patient",
        description: "Prise de rendez-vous et épargne santé Tokens — à venir",
        features: [
            {
                icon: CalendarCheck,
                title: "Rendez-vous",
                description:
                    "Au cabinet ou à domicile, planifiez vos consultations.",
            },
            {
                icon: Wallet,
                title: "Épargne santé",
                description:
                    "Constituez votre épargne en Tokens, à votre rythme.",
            },
            {
                icon: Megaphone,
                title: "Sensibilisations",
                description: "Recevez des conseils et alertes santé fiables.",
            },
        ],
    },
    NURSE: {
        title: "Espace Infirmier",
        description: "Missions et géolocalisation — à venir",
        features: [
            {
                icon: BellRing,
                title: "Missions en direct",
                description: "Recevez les missions en temps réel.",
            },
            {
                icon: MapPinned,
                title: "Géolocalisation",
                description: "Suivez vos interventions trajet par trajet.",
            },
            {
                icon: ClipboardCheck,
                title: "Comptes rendus",
                description: "Documentez chaque visite effectuée.",
            },
        ],
    },
    ADMIN: {
        title: "Espace Médecin Chef",
        description: "Supervision et dispatch des équipes — à venir",
        features: [
            {
                icon: Activity,
                title: "Supervision",
                description: "Suivez l'activité des équipes soignantes.",
            },
            {
                icon: UsersRound,
                title: "Dispatch",
                description: "Affectez les missions entre infirmiers.",
            },
            {
                icon: BarChart3,
                title: "Statistiques",
                description: "Analysez l'activité zone par zone.",
            },
        ],
    },
}

// Onglets de la navigation basse (style app mobile), par rôle : le patient a
// « Rendez-vous » en accès direct (menu de 1er niveau) ; les autres rôles
// conservent Accueil / Profil. Sous-vues hors navigation basse : patient
// « senso » (entrée « Tout voir ») ; admin « specialties » (entrée « Gérer
// les spécialités ») et « recharges » (FEATURE-TOKENS — rapprochement des
// paiements patients, Médecin Chef seul).
type DashboardTab = "accueil" | "rdv" | "senso" | "specialties" | "recharges" | "tarifs" | "profil"

const PATIENT_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "rdv", label: "Rendez-vous", icon: CalendarCheck },
    { id: "profil", label: "Profil", icon: UserRound },
]

const BASE_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "profil", label: "Profil", icon: UserRound },
]

// Onglets ADMIN (Médecin Chef) : accueil + recharges de Tokens (FEATURE-
// TOKENS) + profil — les recharges consomment la navigation basse dédiée.
const ADMIN_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "recharges", label: "Recharges", icon: Wallet },
    { id: "profil", label: "Profil", icon: UserRound },
]

// Formatage lisible du téléphone : source unique src/lib/phone.ts
// (+225 07 01 02 03 04) — la copie locale historique est retirée.

function getFirstName(fullName: string): string {
    return fullName.trim().split(/\s+/)[0] ?? ""
}

function RoleBadge({ role, className }: { role: AppRole; className?: string }) {
    return (
        <Badge
            className={ROLE_BADGE_CLASSES[role]}
            aria-label={`Rôle : ${ROLE_LABELS[role]}`}
        >
            {ROLE_LABELS[role]}
        </Badge>
    )
}

// Transition de vue sobre (DESIGN_SYSTEM §4 : 220 ms, décalage vertical léger).
const tabVariants = {
    enter: { y: 14, opacity: 0 },
    center: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.22, ease: "easeOut" as const },
    },
    exit: {
        y: -10,
        opacity: 0,
        transition: { duration: 0.15, ease: "easeIn" as const },
    },
}

export function UserDashboard() {
    const { user, logout } = useAuth()
    const [tab, setTab] = useState<DashboardTab>("accueil")
    const [openArticle, setOpenArticle] =
        useState<SensibilisationDto | null>(null)
    const [notifOpen, setNotifOpen] = useState(false)
    const [bookingOpen, setBookingOpen] = useState(false)

    // Espace patient : RDV + sensibilisations partagés par le header (cloche),
    // l'accueil et la vue « Mes rendez-vous » (une annulation rafraîchit tout).
    const isPatient = user?.role === "PATIENT"
    const patientData: PatientData = usePatientData(isPatient)

    // ——— Notifications InApp (Task 24) — rappels de RDV persistés ———
    // Fetch au montage (badge visible sans ouvrir le panneau), toutes les
    // 60 s et à chaque ouverture du panneau. Silencieux en cas d'échec : la
    // cloche ne doit jamais casser le reste du dashboard.
    const [notifications, setNotifications] = useState<NotificationDto[]>([])
    const [unreadCount, setUnreadCount] = useState(0)

    const refreshNotifications = useCallback(async () => {
        try {
            const res = await fetch("/api/notifications")
            if (!res.ok) return
            const data = (await res.json()) as NotificationsResponse
            setNotifications(data.notifications)
            setUnreadCount(data.unreadCount)
        } catch {
            // ignoré volontairement — badge non critique
        }
    }, [])

    useEffect(() => {
        if (!isPatient) return
        void refreshNotifications()
        const interval = setInterval(() => void refreshNotifications(), 60_000)
        return () => clearInterval(interval)
    }, [isPatient, refreshNotifications])

    if (!user) return null

    const space = ROLE_SPACE[user.role]
    const SpaceIcon = ROLE_SPACE_ICON[user.role]

    // Prochain RDV actif — « à la une » du panneau notifications (dérivé,
    // non persisté ; les vraies notifications persistées sont Task 24).
    const nextPatientAppointment: AppointmentDto | null = isPatient
        ? (patientData.appointments ?? [])
              .filter(
                  appointment =>
                      (appointment.status === "PENDING" ||
                          appointment.status === "CONFIRMED") &&
                      new Date(appointment.scheduledAt).getTime() >=
                          Date.now() - 60_000,
              )
              .sort((a, b) =>
                  a.scheduledAt.localeCompare(b.scheduledAt),
              )[0] ?? null
        : null

    async function handleLogout() {
        await logout()
        toast({
            title: "Déconnecté",
            description: "À bientôt sur Mon doc Pro !",
        })
    }

    // Marquer TOUT comme lu (POST { all: true }) — badge aligné sur la vérité
    // serveur, liste mise à jour localement (readAt renseigné en optimiste).
    async function markAllNotificationsRead() {
        try {
            const res = await fetch("/api/notifications/read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true }),
            })
            if (!res.ok) throw new Error("read-all failed")
            const data = (await res.json()) as { unreadCount: number }
            setUnreadCount(data.unreadCount)
            setNotifications(prev =>
                prev.map(n => ({
                    ...n,
                    readAt: n.readAt ?? new Date().toISOString(),
                })),
            )
        } catch {
            toast({
                title: "Impossible de mettre à jour les notifications",
                description: "Vérifiez votre connexion puis réessayez.",
                variant: "destructive",
            })
        }
    }

    // Marquer UNE notification comme lue (POST { id }) — fire-and-forget :
    // la navigation vers « Mes rendez-vous » ne doit pas attendre l'API ; le
    // badge est réaligné sur la vérité serveur dès que la réponse arrive.
    function markOneNotificationRead(id: string) {
        setNotifications(prev =>
            prev.map(n =>
                n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n,
            ),
        )
        setUnreadCount(count => Math.max(0, count - 1))
        void fetch("/api/notifications/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
        })
            .then(res => (res.ok ? res.json() : null))
            .then((data: { unreadCount: number } | null) => {
                if (data && typeof data.unreadCount === "number") {
                    setUnreadCount(data.unreadCount)
                }
            })
            .catch(() => undefined)
    }

    const profileFields: { icon: LucideIcon; label: string; value: string }[] =
        [
            { icon: UserRound, label: "Nom complet", value: user.fullName },
            {
                icon: Phone,
                label: "Téléphone",
                value: formatPhoneDisplay(user.phone),
            },
            {
                icon: MapPin,
                label: "Zone de résidence",
                value: ZONE_LABELS[user.zone],
            },
        ]

    return (
        <div className="flex w-full flex-col">
            {/* Barre d'app — sticky avec flou en verre dépoli */}
            <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <Image
                            src="/img/Mon doc Pro.jpeg"
                            alt="Mon doc Pro"
                            width={40}
                            height={40}
                            className="size-10 rounded-xl object-cover ring-1 ring-primary/30"
                        />
                        <div className="flex flex-col leading-tight">
                            <span className="text-base font-bold tracking-tight text-primary sm:text-lg">
                                Mon doc Pro
                            </span>
                            {isPatient && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                    {ZONE_LABELS[user.zone]}, Abidjan
                                </span>
                            )}
                        </div>
                    </div>
                    {isPatient ? (
                        <div className="flex items-center gap-1 sm:gap-1.5">
                            <button
                                type="button"
                                onClick={() => void patientData.refresh()}
                                aria-label="Actualiser mes données"
                                className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <RefreshCw
                                    className={`size-4.5 ${patientData.refreshing ? "animate-spin" : ""}`}
                                    aria-hidden="true"
                                />
                            </button>
                            <Popover
                                open={notifOpen}
                                onOpenChange={open => {
                                    setNotifOpen(open)
                                    if (open) void refreshNotifications()
                                }}
                            >
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={
                                            unreadCount > 0
                                                ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? "s" : ""})`
                                                : "Notifications"
                                        }
                                        className="relative flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Bell
                                            className="size-4.5"
                                            aria-hidden="true"
                                        />
                                        {unreadCount > 0 && (
                                            <span
                                                aria-hidden="true"
                                                className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
                                            >
                                                {unreadCount > 9
                                                    ? "9+"
                                                    : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="w-80 rounded-xl p-0"
                                >
                                    <div className="flex items-center justify-between border-b px-4 py-3">
                                        <p className="text-sm font-semibold">
                                            Notifications
                                        </p>
                                        {unreadCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void markAllNotificationsRead()
                                                }
                                                className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                Tout marquer comme lu
                                            </button>
                                        )}
                                    </div>
                                    <ul className="max-h-80 overflow-y-auto">
                                        {/* Rappels de RDV — notifications InApp
                                            persistées (Task 24) : pastille + titre
                                            gras tant que non lues, horodatage
                                            relatif, clic → « Mes rendez-vous ». */}
                                        {notifications.map(n => (
                                            <li key={n.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNotifOpen(false)
                                                        if (!n.readAt) {
                                                            markOneNotificationRead(n.id)
                                                        }
                                                        setTab("rdv")
                                                    }}
                                                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                                >
                                                    <span className="relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                        <BellRing
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                        {!n.readAt && (
                                                            <span
                                                                aria-hidden="true"
                                                                className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background"
                                                            />
                                                        )}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span
                                                            className={`block truncate text-sm ${n.readAt ? "font-medium text-muted-foreground" : "font-semibold"}`}
                                                        >
                                                            {n.title}
                                                        </span>
                                                        <span className="block line-clamp-2 text-xs text-muted-foreground">
                                                            {n.body}
                                                        </span>
                                                        <span
                                                            className="text-xs text-muted-foreground"
                                                            suppressHydrationWarning
                                                        >
                                                            {relativePublishedLabel(n.createdAt)}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                        {nextPatientAppointment && (
                                            <li>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNotifOpen(false)
                                                        setTab("rdv")
                                                    }}
                                                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                                >
                                                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                        <CalendarCheck
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span
                                                            className="block truncate text-sm font-medium"
                                                            suppressHydrationWarning
                                                        >
                                                            Rendez-vous {relativeSlotLabel(nextPatientAppointment.scheduledAt)}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            Mes rendez-vous
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        )}
                                        {(patientData.sensibilisations ?? [])
                                            .slice(0, 5)
                                            .map(item => (
                                                <li key={item.id}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setNotifOpen(false)
                                                            setOpenArticle(item)
                                                        }}
                                                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                                    >
                                                        <span
                                                            aria-hidden="true"
                                                            className={`mt-1.5 size-2 shrink-0 rounded-full ${item.category === "ALERT" ? "bg-destructive" : "bg-success"}`}
                                                        />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium">
                                                                {item.title}
                                                            </span>
                                                            <span
                                                                className="text-xs text-muted-foreground"
                                                                suppressHydrationWarning
                                                            >
                                                                {relativePublishedLabel(item.publishedAt)}
                                                            </span>
                                                        </span>
                                                    </button>
                                                </li>
                                            ))}
                                        {notifications.length === 0 &&
                                            !nextPatientAppointment &&
                                            (patientData.sensibilisations ?? [])
                                                .length === 0 && (
                                                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                    Aucune notification pour le moment
                                                </li>
                                            )}
                                    </ul>
                                </PopoverContent>
                            </Popover>
                            <button
                                type="button"
                                onClick={() => setTab("profil")}
                                aria-label="Ouvrir mon profil"
                                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <Avatar className="size-10 ring-2 ring-primary/20">
                                    <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                                        {getInitials(user.fullName)}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-0.5">
                                <span className="max-w-[10rem] truncate text-sm font-medium sm:max-w-none">
                                    {user.fullName}
                                </span>
                                <RoleBadge
                                    role={user.role}
                                    className="hidden sm:inline-flex"
                                />
                            </div>
                            <Avatar className="size-10 ring-2 ring-primary/20">
                                <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                                    {getInitials(user.fullName)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    )}
                </div>
            </header>

            {/* Contenu rendu à l'intérieur du <main> de app/page.tsx (HTML sémantique :
          un seul élément <main> par page). */}
            <h1 className="sr-only">Mon espace Mon doc Pro</h1>

            <div className="mx-auto w-full max-w-3xl px-4 py-6 pb-32 sm:py-8">
                <AnimatePresence mode="wait" initial={false}>
                    {tab === "accueil" && (
                        <motion.section
                            key="accueil"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Accueil"
                        >
                            {isPatient ? (
                                <PatientHome
                                    user={user}
                                    data={patientData}
                                    onOpenAppointments={() => setTab("rdv")}
                                    onOpenArticle={setOpenArticle}
                                    onOpenAllArticles={() => setTab("senso")}
                                    onBook={() => setBookingOpen(true)}
                                />
                            ) : (
                            <>
                            {/* Hero de bienvenue — dégradé médical, texte blanc AA sur primary/dark */}
                            <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-primary-foreground sm:p-8">
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-0"
                                >
                                    <div className="absolute -right-16 -top-16 size-48 rounded-full bg-white/10 blur-xl" />
                                    <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/[0.07] blur-xl" />
                                </div>
                                <div className="relative flex flex-col gap-3">
                                    <p className="text-sm text-white/80">
                                        <Clock
                                            className="mr-1.5 inline size-3.5 -translate-y-px"
                                            aria-hidden="true"
                                        />
                                        <span suppressHydrationWarning>
                                            {new Date().toLocaleDateString(
                                                "fr-FR",
                                                {
                                                    weekday: "long",
                                                    day: "numeric",
                                                    month: "long",
                                                }
                                            )}
                                        </span>
                                    </p>
                                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                                        Bonjour, {getFirstName(user.fullName)}
                                    </h2>
                                    <p className="max-w-lg text-sm leading-relaxed text-white/80">
                                        Votre espace santé Mon doc Pro —
                                        consultations, épargne et suivi, proches
                                        de chez vous.
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
                                            {ROLE_LABELS[user.role]}
                                        </span>
                                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium ring-1 ring-white/25">
                                            <MapPin
                                                className="mr-1 inline size-3 -translate-y-px"
                                                aria-hidden="true"
                                            />
                                            {ZONE_LABELS[user.zone]}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Raccourci ADMIN — validation des recharges de Tokens
                                (FEATURE-TOKENS : cycle financier de la consultation) */}
                            {user.role === "ADMIN" && (
                                <button
                                    type="button"
                                    onClick={() => setTab("recharges")}
                                    className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Wallet className="size-5" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold">
                                            Recharges de Tokens
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            Valider les paiements patients (Wave, OM, MTN, Visa)
                                        </span>
                                    </span>
                                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                </button>
                            )}

                            {/* Raccourci ADMIN — gestion du catalogue de spécialités
                                consommé par l'étape 2 du wizard patient (feature live,
                                contrairement aux modules « à venir » ci-dessous) */}
                            {user.role === "ADMIN" && (
                                <button
                                    type="button"
                                    onClick={() => setTab("specialties")}
                                    className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Stethoscope className="size-5" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold">
                                            Gérer les spécialités
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            Catalogue proposé aux patients à la prise de RDV
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                                        Ouvrir
                                        <ChevronRight className="size-4" aria-hidden="true" />
                                    </span>
                                </button>
                            )}

                            {/* Raccourci ADMIN — grille tarifaire des consultations
                                (FEATURE-TOKENS : tarifs configurables, demande PO
                                2026-10-03 — le Médecin Chef fixe le prix en Tokens) */}
                            {user.role === "ADMIN" && (
                                <button
                                    type="button"
                                    onClick={() => setTab("tarifs")}
                                    className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                >
                                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Tags className="size-5" aria-hidden="true" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm font-bold">
                                            Tarifs des consultations
                                        </span>
                                        <span className="block text-xs text-muted-foreground">
                                            Fixer le prix en Tokens de chaque consultation
                                        </span>
                                    </span>
                                    <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                                        Ouvrir
                                        <ChevronRight className="size-4" aria-hidden="true" />
                                    </span>
                                </button>
                            )}

                            {/* Espace par rôle — cartes fonctionnalités avec badges « à venir » */}
                            <Card className="rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2.5">
                                        <span className="flex size-9 items-center justify-center rounded-lg bg-success-light text-success-foreground">
                                            <SpaceIcon
                                                className="size-4.5"
                                                aria-hidden="true"
                                            />
                                        </span>
                                        {space.title}
                                    </CardTitle>
                                    <CardDescription>
                                        {space.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="grid gap-3 sm:grid-cols-3">
                                        {space.features.map(feature => (
                                            <li
                                                key={feature.title}
                                                className="group flex flex-col gap-2.5 rounded-xl border p-4 transition-colors hover:border-primary/40 hover:bg-muted/40"
                                            >
                                                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                                                    <feature.icon
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold">
                                                        {feature.title}
                                                    </span>
                                                    <span className="text-sm leading-relaxed text-muted-foreground">
                                                        {feature.description}
                                                    </span>
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="mt-auto w-fit gap-1"
                                                >
                                                    <Clock
                                                        className="size-3"
                                                        aria-hidden="true"
                                                    />
                                                    Bientôt disponible
                                                </Badge>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                            </>
                            )}
                        </motion.section>
                    )}

                    {tab === "rdv" && isPatient && (
                        <motion.section
                            key="rdv"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Mes rendez-vous"
                        >
                            <AppointmentsView
                                data={patientData}
                                onBook={() => setBookingOpen(true)}
                            />
                        </motion.section>
                    )}

                    {tab === "senso" && isPatient && (
                        <motion.section
                            key="senso"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Sensibilisations"
                        >
                            <SensibilisationsView
                                feed={patientData.sensibilisations}
                                zone={user.zone}
                                loading={patientData.loading}
                                error={patientData.error}
                                onBack={() => setTab("accueil")}
                                onRefresh={() => void patientData.refresh()}
                                onOpenArticle={setOpenArticle}
                            />
                        </motion.section>
                    )}

                    {tab === "specialties" && user.role === "ADMIN" && (
                        <motion.section
                            key="specialties"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Gestion des spécialités"
                        >
                            <SpecialtiesView onBack={() => setTab("accueil")} />
                        </motion.section>
                    )}

                    {tab === "recharges" && user.role === "ADMIN" && (
                        <motion.section
                            key="recharges"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Recharges de Tokens"
                        >
                            <RechargesView onBack={() => setTab("accueil")} />
                        </motion.section>
                    )}

                    {tab === "tarifs" && user.role === "ADMIN" && (
                        <motion.section
                            key="tarifs"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Tarifs des consultations"
                        >
                            <TariffsView onBack={() => setTab("accueil")} />
                        </motion.section>
                    )}

                    {tab === "profil" && (
                        <motion.section
                            key="profil"
                            variants={tabVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            aria-label="Mon profil"
                        >
                            {isPatient ? (
                                // Profil patient — maquette PO 2026-10-03
                                // (héro, infos, sécurité RGPD, préférences, urgences)
                                <ProfileView
                                    user={user}
                                    onLogout={handleLogout}
                                />
                            ) : (
                            <>
                            <Card className="rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="flex flex-wrap items-center justify-between gap-2">
                                        <span>Mon profil</span>
                                        <RoleBadge role={user.role} />
                                    </CardTitle>
                                    <CardDescription>
                                        Vos informations de compte
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ul className="grid gap-3 sm:grid-cols-3">
                                        {profileFields.map(field => (
                                            <li
                                                key={field.label}
                                                className="flex items-start gap-3 rounded-xl border bg-muted/40 p-3"
                                            >
                                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                    <field.icon
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="flex min-w-0 flex-col">
                                                    <span className="text-xs text-muted-foreground">
                                                        {field.label}
                                                    </span>
                                                    <span className="truncate text-sm font-medium">
                                                        {field.value}
                                                    </span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>

                            <Button
                                variant="outline"
                                onClick={handleLogout}
                                disabled={!user}
                                className="mt-6 h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive sm:w-auto"
                            >
                                <LogOut className="size-4" aria-hidden="true" />
                                Se déconnecter
                            </Button>
                            </>
                            )}
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>

            {/* Article sensibilisation — dialog partagé accueil / vues / notifications */}
            {isPatient && (
                <SensibilisationDialog
                    sensibilisation={openArticle}
                    onClose={() => setOpenArticle(null)}
                />
            )}

            {/* Réservation — dialog partagé accueil / vue RDV, POST réel (201) */}
            {isPatient && (
                <BookAppointmentDialog
                    open={bookingOpen}
                    onClose={() => setBookingOpen(false)}
                    onBooked={() => void patientData.refresh()}
                    zone={user.zone}
                />
            )}

            {/* Navigation basse flottante — style app native, safe-area iOS respectée */}
            <nav
                aria-label="Navigation principale"
                className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            >
                <ul className="mx-auto flex max-w-md items-center justify-around gap-1 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-lg shadow-primary/[0.08] backdrop-blur-md">
                    {(isPatient
                        ? PATIENT_TABS
                        : user.role === "ADMIN"
                          ? ADMIN_TABS
                          : BASE_TABS
                    ).map(item => {
                        const isActive = tab === item.id
                        return (
                            <li key={item.id} className="flex-1">
                                <button
                                    type="button"
                                    onClick={() => setTab(item.id)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={`flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                        isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                >
                                    <item.icon
                                        className="size-5"
                                        aria-hidden="true"
                                    />
                                    {item.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </div>
    )
}
