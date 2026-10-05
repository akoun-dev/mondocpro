"use client"

// Espace connecté MVP — US-AUTH-3/4 (SPEC-AUTH) + FEATURE-PATIENT UI (maquette PO 2026-10)
// Design v3 « app mobile » : barre d'app sticky (zone, actualiser, notifications),
// navigation basse flottante (patient : Accueil / Rendez-vous / Profil — autres
// rôles : Accueil / Profil), vues animées sobres framer-motion
// (DESIGN_SYSTEM §4). Accueil patient dédié (src/components/patient/) branché sur les
// API contractées ; rôles NURSE/ADMIN inchangés (cartes « à venir »).
import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
    Activity,
    BarChart3,
    Bell,
    BellRing,
    CalendarCheck,
    ChevronRight,
    CircleCheck,
    ClipboardCheck,
    Clock,
    HeartPulse,
    Home,
    LogOut,
    MapPin,
    MapPinned,
    Megaphone,
    Phone,
    Stethoscope,
    Tags,
    UserRound,
    UsersRound,
    Wallet,
    type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme/theme-toggle"
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
import { TOKEN_VALUE_FCFA } from "@/lib/token-schemas"
import { relativePublishedLabel, relativeSlotLabel } from "@/lib/datetime"
import { formatPhoneDisplay } from "@/lib/phone"
import { getInitials } from "@/lib/utils"
import { useAuth } from "@/hooks/use-auth"
import { usePatientData } from "@/hooks/use-patient-data"
import { toast } from "@/hooks/use-toast"
import type { AppRole, AppUser } from "@/stores/auth-store"
import type { PatientData } from "@/hooks/use-patient-data"
import type { SensibilisationDto } from "@/lib/sensibilisations"
import type { AppointmentDto } from "@/lib/appointments"
import {
    notificationFamily,
    type NotificationDto,
    type NotificationsResponse,
} from "@/lib/notifications"
import {
    cancelAppointmentReminders,
    hapticSuccess,
    scheduleAppointmentReminders,
} from "@/lib/native"
import { PatientHome } from "@/components/patient/patient-home"
import { AppointmentsView } from "@/components/patient/appointments-view"
import { SensibilisationsView } from "@/components/patient/sensibilisations-view"
import { ProfileView } from "@/components/patient/profile-view"
import { BookAppointmentDialog } from "@/components/patient/book-appointment-dialog"
import { SensibilisationDialog } from "@/components/patient/sensibilisation-dialog"
import { SpecialtiesView } from "@/components/admin/specialties-view"
import { RechargesView } from "@/components/admin/recharges-view"
import { WalletSection } from "@/components/patient/wallet-section"
import { TariffsView } from "@/components/admin/tariffs-view"
import { AdminMissionsView } from "@/components/admin/missions-view"
import { AdminTeamsView } from "@/components/admin/teams-view"
import { AdminPatientsView } from "@/components/admin/patients-view"
import { AdminNursesView } from "@/components/admin/nurses-view"
import { NurseMissionsView } from "@/components/nurse/nurse-missions-view"
import { NurseProfileView } from "@/components/nurse/nurse-profile-view"
import { AdminProfileView } from "@/components/profile/admin-profile-view"
import {
    AdminMenuButton,
    AdminSidebar,
    type AdminTab,
} from "@/components/admin/admin-sidebar"

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
    // Task 35 : une fonctionnalité passée en live reste dans la carte mais
    // devient un raccourci cliquable (badge vert « Disponible ») — plus de
    // carte mentalement obsolète à côté de raccourcis déjà actifs.
    live?: boolean
    tab?: DashboardTab
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
                live: true,
                tab: "missions",
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
                live: true,
                tab: "missions",
            },
        ],
    },
    ADMIN: {
        title: "Espace Médecin Chef",
        description: "Supervision et dispatch des équipes",
        features: [
            // FEATURE-ANNUAIRE-ADMIN : Supervision et Dispatch pointaient
            // toutes deux vers « missions », donc deux cartes pour un seul
            // écran. Dispatch va desormais sur la vue Équipes (la file
            // d'affectation y est utilisable sans changer d'onglet) ;
            // Supervision y trouve la charge et la répartition par zone.
            {
                icon: Activity,
                title: "Supervision",
                description: "Suivez l'activité des équipes soignantes.",
                live: true,
                tab: "equipes",
            },
            {
                icon: UsersRound,
                title: "Dispatch",
                description: "Affectez les missions entre infirmiers.",
                live: true,
                tab: "equipes",
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
// « senso » (entrée « Tout voir ») ; admin « specialties » / « recharges » /
// « missions » (sidebar latérale — FEATURE-TOKENS et FEATURE-NURSE).
type DashboardTab =
    | "accueil"
    | "rdv"
    | "missions"
    | "equipes"
    | "patients"
    | "infirmiers"
    | "wallet"
    | "senso"
    | "specialties"
    | "recharges"
    | "tarifs"
    | "profil"

// URL d'un onglet — l'accueil reste l'URL nue (pas de ?tab=), les autres
// onglets l'encodent pour être partageables et relançables (deep links).
function tabUrl(tab: DashboardTab): string {
    if (tab === "accueil") return window.location.pathname
    return `${window.location.pathname}?tab=${tab}`
}

// Titre + sous-titre de la vue courante, rendus dans le header. Les vues ne
// portent plus leur propre en-tête : un seul emplacement de titre dans
// l'app, identique quel que soit l'onglet.
// « missions » existe pour deux rôles (dispatch admin / interventions
// infirmier) d'où un sous-titre dépendant du rôle.
function viewHeading(
    tab: DashboardTab,
    user: AppUser,
): { title: string; subtitle: string } {
    const zone = ZONE_LABELS[user.zone]
    switch (tab) {
        case "rdv":
            return {
                title: "Mes rendez-vous",
                subtitle: "Consultez et gérez vos consultations",
            }
        case "missions":
            return user.role === "ADMIN"
                ? {
                    title: "Missions & Dispatch",
                    subtitle:
                        "Soins à domicile — affectez vos équipes et suivez les interventions",
                }
                : {
                    title: "Mes missions",
                    subtitle:
                        "Consultez vos interventions et mettez à jour leur avancement",
                }
        // FEATURE-ANNUAIRE-ADMIN : supervision + dispatch de l'effectif.
        case "equipes":
            return {
                title: "Équipes",
                subtitle: "Supervision des effectifs et dispatch des soins à domicile",
            }
        case "patients":
            return {
                title: "Patients",
                subtitle: "Annuaire des dossiers et historique des consultations",
            }
        case "infirmiers":
            return {
                title: "Infirmiers",
                subtitle: "Annuaire des soignants, charge de travail et historique de missions",
            }
        case "wallet":
            return {
                title: "Portefeuille santé",
                subtitle: "Épargne santé & tokens médicaux",
            }
        case "senso":
            return {
                title: "Sensibilisations",
                subtitle: `Conseils et alertes santé — ${zone} et Abidjan`,
            }
        case "specialties":
            return {
                title: "Spécialités",
                subtitle: "Catalogue proposé aux patients à la prise de rendez-vous",
            }
        case "recharges":
            return {
                title: "Recharges de Tokens",
                subtitle: `Rapprochement des paiements patients — 1 Token = ${TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA`,
            }
        case "tarifs":
            return {
                title: "Tarifs des consultations",
                subtitle: "Grille en vigueur — 1 Token = 2 500 FCFA",
            }
        case "profil":
            return { title: "Mon profil", subtitle: ROLE_LABELS[user.role] }
        default:
            return { title: "Accueil", subtitle: "Vue d'ensemble" }
    }
}

const PATIENT_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "rdv", label: "RDV", icon: CalendarCheck },
    { id: "wallet", label: "Wallet", icon: Wallet },
]

const BASE_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "profil", label: "Profil", icon: UserRound },
]

const NURSE_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "missions", label: "Missions", icon: ClipboardCheck },
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

// ——— Task 35 — Routage du clic notification ———
// Chaque type de notification mène à la vue qui permet d'AGIR : patient →
// Wallet pour les recharges, Mes rendez-vous pour tout le cycle RDV/missions ;
// infirmier → Missions ; Médecin Chef → Recharges (cycle financier) ou
// Missions & Dispatch (file à affecter, suivi). Source unique, testée dans
// scripts/audit-e2e-admin-notifications.sh.
function notificationDestination(type: string, role: AppRole): DashboardTab {
    const family = notificationFamily(type)
    if (role === "PATIENT") {
        return family === "recharge" ? "wallet" : "rdv"
    }
    if (role === "NURSE") return "missions"
    // ADMIN — le Médecin Chef est orienté vers l'outil d'action.
    return family === "recharge" ? "recharges" : "missions"
}

// Icône + couleur par FAMILLE (lecture instantanée du fil) : Coins pour le
// cycle financier, CalendarCheck pour le cycle RDV, ClipboardCheck pour le
// cycle missions — le BellRing générique ne reste que pour les futurs types.
function notificationVisual(type: string): {
    Icon: LucideIcon
    classes: string
} {
    const family = notificationFamily(type)
    if (family === "recharge")
        return {
            Icon: Wallet,
            classes: "bg-warning/15 text-warning-foreground",
        }
    if (family === "appointment")
        return { Icon: CalendarCheck, classes: "bg-primary/10 text-primary" }
    return {
        Icon: ClipboardCheck,
        classes: "bg-success/15 text-success-foreground",
    }
}

// Séparateur de groupe dans le panneau de notifications. Le panneau fusionne
// trois sources sans les distinguer (notifications persistées, prochain
// rendez-vous, conseils santé) : sans étiquette, une ligne de conseil de
// santé se lit comme une alerte de mission. `role="presentation"` car ce n'est
// pas une entrée de liste.
function NotificationGroupLabel({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <li
            role="presentation"
            className="border-t border-dashed px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:border-t-0 first:pt-2"
        >
            {children}
        </li>
    )
}

// Compteurs de travail du Médecin Chef (accueil admin) — files RÉELLES des
// deux piliers opérationnels : recharges à valider (GET /api/admin/recharges)
// et consultations à domicile à affecter (GET /api/admin/missions —
// dispatchQueue, Task 35). Chargement une fois au montage ; les vues
// elles-mêmes rechargent à l'ouverture (source de vérité fraîche). Échec =
// compteurs absents (les raccourcis restent utilisables).
type AdminCounters = {
    rechargesPending: number
    toDispatch: number
    activeMissions: number
} | null

function useAdminCounters(enabled: boolean): AdminCounters {
    const [counters, setCounters] = useState<AdminCounters>(null)
    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        ;(async () => {
            try {
                const [rechargesRes, missionsRes] = await Promise.all([
                    fetch("/api/admin/recharges", { cache: "no-store" }),
                    fetch("/api/admin/missions", { cache: "no-store" }),
                ])
                if (!rechargesRes.ok || !missionsRes.ok) return
                const recharges = (await rechargesRes.json()) as {
                    pending?: unknown[]
                }
                const board = (await missionsRes.json()) as {
                    dispatchQueue?: unknown[]
                    missions?: Array<{ status: string }>
                }
                if (cancelled) return
                setCounters({
                    rechargesPending: recharges.pending?.length ?? 0,
                    toDispatch: board.dispatchQueue?.length ?? 0,
                    activeMissions: (board.missions ?? []).filter(m =>
                        ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"].includes(
                            m.status
                        )
                    ).length,
                })
            } catch {
                // silencieux — compteurs non critiques
            }
        })()
        return () => {
            cancelled = true
        }
    }, [enabled])
    return counters
}

export function UserDashboard() {
    const { user, logout } = useAuth()
    const [tab, setTabState] = useState<DashboardTab>("accueil")
    // Le bouton retour matériel (Capacitor) et le retour navigateurcalling
    // history.back() ne peuvent revenir à l'onglet précédent que si chaque
    // onglet pousse une entrée d'historique. Sans cela, « retour » depuis
    // Missions sortait de l'app au lieu de ramener à l'accueil.
    const tabRef = useRef<DashboardTab>("accueil")
    const setTab = useCallback((next: DashboardTab) => {
        if (tabRef.current === next) return
        tabRef.current = next
        window.history.pushState({ mondocproTab: next }, "", tabUrl(next))
        setTabState(next)
    }, [])
    const [openArticle, setOpenArticle] = useState<SensibilisationDto | null>(
        null
    )
    const [notifOpen, setNotifOpen] = useState(false)
    const [bookingOpen, setBookingOpen] = useState(false)
    const [rechargeRequested, setRechargeRequested] = useState(false)
    const [adminSidebarOpen, setAdminSidebarOpen] = useState(false)
    // Espace patient : RDV + sensibilisations partagés par le header (cloche),
    // l'accueil et la vue « Mes rendez-vous » (une annulation rafraîchit tout).
    const isPatient = user?.role === "PATIENT"
    const isAdmin = user?.role === "ADMIN"
    // Les missions produisent aussi des notifications pour l'ADMIN (supervision)
    // et pour l'infirmier affecté. La cloche doit donc être disponible pour les
    // trois rôles, même si les notifications de rendez-vous restent patient.
    // UserDashboard est monté uniquement pour un utilisateur authentifié ; la
    // garde reste dans l'effet pour couvrir le premier rendu de transition.
    const isNotificationUser = true
    const patientData: PatientData = usePatientData(isPatient)
    // Task 35 — compteurs de travail du Médecin Chef (files réelles, accueil).
    const adminCounters = useAdminCounters(isAdmin)

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
        if (!isNotificationUser) return
        void refreshNotifications()
        const interval = setInterval(() => void refreshNotifications(), 60_000)
        return () => clearInterval(interval)
    }, [isNotificationUser, refreshNotifications])

    // Task 36 — push reçue app ouverte : NativeBootstrap diffuse cet événement,
    // le badge et le fil se rafraîchissent immédiatement (pas d'attente du tick 60 s).
    useEffect(() => {
        const handler = () => void refreshNotifications()
        window.addEventListener("mondocpro:notifications-changed", handler)
        return () =>
            window.removeEventListener(
                "mondocpro:notifications-changed",
                handler
            )
    }, [refreshNotifications])

    // Task 36 — lien profond depuis une notification PUSH (?tab=…) : au
    // montage, un onglet valide pour le rôle est affiché (patient → wallet/rdv,
    // infirmier → missions, admin → recharges/missions…). Les onglets hors
    // rôle sont ignorés (aucun rendu vide).
    //
    // OBLIGATOIRE pour le bouton retour matériel : cet onglet EST l'entrée
    // racine de la pile. Si on la laisse sans état, le premier « retour »
    // depuis Missions ferait history.back() vers une entrée sans ?tab= —
    // donc vers l'accueil, ce qui est le comportement attendu. replaceState
    // (et non pushState) évite d'ajouter une entrée parasite au montage.
    useEffect(() => {
        if (!user) return
        const requested = new URLSearchParams(window.location.search).get("tab")
        if (!requested) {
            window.history.replaceState(
                { mondocproTab: "accueil" },
                "",
                tabUrl("accueil")
            )
            return
        }
        const allowed: Record<AppRole, DashboardTab[]> = {
            PATIENT: ["accueil", "rdv", "wallet", "senso", "profil"],
            NURSE: ["accueil", "missions", "profil"],
            ADMIN: [
                "accueil",
                "profil",
                "recharges",
                "specialties",
                "missions",
                "equipes",
                "patients",
                "infirmiers",
                "tarifs",
            ],
        }
        if (allowed[user.role].includes(requested as DashboardTab)) {
            window.history.replaceState(
                { mondocproTab: requested },
                "",
                tabUrl(requested as DashboardTab)
            )
            tabRef.current = requested as DashboardTab
            setTabState(requested as DashboardTab)
        }
    }, [user])

    // Retour système / navigateur : on restaure l'onglet porté par l'entrée
    // d'historique atteinte. Si l'entrée n'a pas d'état (page ouverte hors
    // dashboard, lien profond ancien), on retombe sur l'accueil.
    useEffect(() => {
        const onPopState = () => {
            const state = window.history.state as {
                mondocproTab?: DashboardTab
            } | null
            const next = state?.mondocproTab ?? "accueil"
            tabRef.current = next
            setTabState(next)
        }
        window.addEventListener("popstate", onPopState)
        return () => window.removeEventListener("popstate", onPopState)
    }, [])

    if (!user) return null

    const space = ROLE_SPACE[user.role]
    const SpaceIcon = ROLE_SPACE_ICON[user.role]

    // Prochain RDV actif — « à la une » du panneau notifications (dérivé,
    // non persisté ; les vraies notifications persistées sont Task 24).
    const nextPatientAppointment: AppointmentDto | null = isPatient
        ? ((patientData.appointments ?? [])
              .filter(
                  appointment =>
                      (appointment.status === "PENDING" ||
                          appointment.status === "CONFIRMED") &&
                      new Date(appointment.scheduledAt).getTime() >=
                          Date.now() - 60_000
              )
              .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ??
          null)
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
                }))
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
                n.id === id
                    ? { ...n, readAt: n.readAt ?? new Date().toISOString() }
                    : n
            )
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

    const heading = viewHeading(tab, user)

    return (
        <div
            className={
                user.role === "ADMIN"
                    ? "flex min-h-screen w-full"
                    : "flex w-full flex-col"
            }
        >
            {user.role === "ADMIN" && (
                <AdminSidebar
                    user={user}
                    activeTab={tab as AdminTab}
                    open={adminSidebarOpen}
                    onOpenChange={setAdminSidebarOpen}
                    onSelect={setTab}
                    onLogout={handleLogout}
                />
            )}
            <div className="flex min-w-0 flex-1 flex-col">
                {/* Barre d'app — sticky avec flou en verre dépoli */}
                <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-md">
                    {/* Demande PO 2026-10 : les écrans du Médecin Chef s'étendent
                        sur toute la largeur (sidebar + contenu w-full) ; les
                        autres rôles restent centrés sur max-w-5xl. */}
                    <div
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 ${
                            user.role === "ADMIN" ? "" : "mx-auto max-w-5xl"
                        }`}
                    >
                        <div className="flex min-w-0 items-center gap-2.5">
                            {user.role === "ADMIN" && (
                                <AdminMenuButton
                                    onClick={() => setAdminSidebarOpen(true)}
                                />
                            )}
                            {/* Titre + sous-titre de la vue courante (helper
                                viewHeading). Les vues ne portent plus leur
                                propre en-tête : un seul titre dans l'app.
                                min-w-0 + truncate : un titre long ne doit pas
                                pousser la cloche hors de l'écran. */}
                            <div className="flex min-w-0 flex-col leading-tight">
                                <span className="flex min-w-0 items-center gap-1.5">
                                    <span className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">
                                        {heading.title}
                                    </span>
                                    {isPatient && (
                                        <span className="rounded-md bg-success/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-success-foreground">
                                            PRO
                                        </span>
                                    )}
                                </span>
                                <span className="truncate text-[11px] text-muted-foreground sm:text-xs">
                                    {heading.subtitle}
                                </span>
                            </div>
                        </div>
                        {isNotificationUser ? (
                            <div className="flex items-center gap-1 sm:gap-1.5">
                                {/* FEATURE-DARK-MODE (Task 37) — bascule clair/sombre */}
                                <ThemeToggle />
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
                                            className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
                                        >
                                            <Bell
                                                className="size-5 sm:size-4.5"
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
                                        collisionPadding={12}
                                        className="w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-2xl p-0"
                                    >
                                        {/* Panneau adaptatif : la largeur suit
                                        l'écran (w-80 = 320px déborde sous 320px
                                        de large) et la hauteur de la liste est
                                        bornée par la fenêtre, pas en dur —
                                        sinon la liste recouvre tout l'écran
                                        sur un petit téléphone.
                                        L'en-tête reste hors zone de défilement :
                                        « tout marquer comme lu » doit rester
                                        atteignable quel que soit le scroll. */}
                                        <div className="flex items-center justify-between gap-2 border-b bg-popover px-4 py-3">
                                            <p className="text-sm font-semibold">
                                                Notifications
                                            </p>
                                            {unreadCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        void markAllNotificationsRead()
                                                    }
                                                    className="shrink-0 rounded-lg px-1 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    Tout marquer comme lu
                                                </button>
                                            )}
                                        </div>
                                        <ul className="max-h-[min(70dvh,26rem)] overscroll-contain overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                                            {/* Rappels de RDV — notifications InApp
                                            persistées (Task 24) : pastille + titre
                                            gras tant que non lues, horodatage
                                            relatif, clic → « Mes rendez-vous ». */}
                                            {notifications.length > 0 && (
                                                <NotificationGroupLabel>
                                                    Alertes & rappels
                                                </NotificationGroupLabel>
                                            )}
                                            {notifications.map(n => {
                                                const visual =
                                                    notificationVisual(n.type)
                                                const NotifIcon = visual.Icon
                                                return (
                                                    <li key={n.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNotifOpen(
                                                                    false
                                                                )
                                                                if (!n.readAt) {
                                                                    markOneNotificationRead(
                                                                        n.id
                                                                    )
                                                                }
                                                                // Task 35 — destination
                                                                // par rôle + famille :
                                                                // la notification mène
                                                                // à l'outil d'action.
                                                                setTab(
                                                                    notificationDestination(
                                                                        n.type,
                                                                        user.role
                                                                    )
                                                                )
                                                            }}
                                                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                                                        >
                                                            <span
                                                                className={`relative mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${visual.classes}`}
                                                            >
                                                                <NotifIcon
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
                                                                    {relativePublishedLabel(
                                                                        n.createdAt
                                                                    )}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </li>
                                                )
                                            })}
                                            {nextPatientAppointment && (
                                                <NotificationGroupLabel>
                                                    Prochain rendez-vous
                                                </NotificationGroupLabel>
                                            )}
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
                                                                Rendez-vous{" "}
                                                                {relativeSlotLabel(
                                                                    nextPatientAppointment.scheduledAt
                                                                )}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                Mes rendez-vous
                                                            </span>
                                                        </span>
                                                    </button>
                                                </li>
                                            )}
                                            {(patientData.sensibilisations ?? [])
                                                .length > 0 && (
                                                <NotificationGroupLabel>
                                                    Conseils santé
                                                </NotificationGroupLabel>
                                            )}
                                            {(patientData.sensibilisations ?? [])
                                                .slice(0, 5)
                                                .map(item => (
                                                    <li key={item.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setNotifOpen(
                                                                    false
                                                                )
                                                                setOpenArticle(
                                                                    item
                                                                )
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
                                                                    {relativePublishedLabel(
                                                                        item.publishedAt
                                                                    )}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    </li>
                                                ))}
                                            {notifications.length === 0 &&
                                                !nextPatientAppointment &&
                                                (
                                                    patientData.sensibilisations ??
                                                    []
                                                ).length === 0 && (
                                                    <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                                                        Aucune notification pour
                                                        le moment
                                                    </li>
                                                )}
                                        </ul>
                                    </PopoverContent>
                                </Popover>
                                <button
                                    type="button"
                                    onClick={() => setTab("profil")}
                                    aria-label="Ouvrir mon profil"
                                    className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Avatar className="size-10 ring-2 ring-primary/20">
                                        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                                            {getInitials(user.fullName)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {/* Pastille « en ligne » — maquette PO v2 */}
                                    <span
                                        aria-hidden="true"
                                        className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-card"
                                    />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {/* FEATURE-DARK-MODE (Task 37) */}
                                <ThemeToggle />
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

                {/* Demande PO 2026-10 : vues admin en pleine largeur (w-full,
                    plus de max-w-5xl) — les tableaux de supervision (équipes,
                    annuaires, missions) gagnent la place des grands écrans.
                    Patient / infirmier restent bornés à max-w-3xl. */}
                <div
                    className={`w-full px-4 py-6 sm:py-8 ${user.role === "ADMIN" ? "pb-8" : "mx-auto max-w-3xl pb-32"}`}
                >
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
                                        onBook={() => setBookingOpen(true)}
                                        onRecharge={() => {
                                            setRechargeRequested(true)
                                            setTab("wallet")
                                        }}
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
                                                    <span
                                                        suppressHydrationWarning
                                                    >
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
                                                    Bonjour,{" "}
                                                    {getFirstName(
                                                        user.fullName
                                                    )}
                                                </h2>
                                                <p className="max-w-lg text-sm leading-relaxed text-white/80">
                                                    Votre espace santé Mon doc
                                                    Pro — consultations, épargne
                                                    et suivi, proches de chez
                                                    vous.
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

                                        {/* Raccourci ADMIN — Missions & Dispatch (Task 35 :
                                FEATURE-NURSE exposée au Médecin Chef) + validation des
                                recharges de Tokens (FEATURE-TOKENS) — les deux piliers
                                opérationnels, avec compteurs de file RÉELS. */}
                                        {user.role === "ADMIN" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTab("missions")
                                                }
                                                className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                            >
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <ClipboardCheck
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-bold">
                                                        Missions &amp; Dispatch
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Affectez les
                                                        consultations à domicile
                                                        et suivez les équipes
                                                    </span>
                                                    {adminCounters &&
                                                        adminCounters.toDispatch >
                                                            0 && (
                                                            <Badge className="mt-1.5 bg-warning text-warning-foreground">
                                                                {
                                                                    adminCounters.toDispatch
                                                                }{" "}
                                                                à affecter
                                                            </Badge>
                                                        )}
                                                </span>
                                                <ChevronRight
                                                    className="size-5 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        )}

                                        {user.role === "ADMIN" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTab("recharges")
                                                }
                                                className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                            >
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <Wallet
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-bold">
                                                        Recharges de Tokens
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Valider les paiements
                                                        patients (Wave, OM, MTN,
                                                        Visa)
                                                    </span>
                                                    {adminCounters &&
                                                        adminCounters.rechargesPending >
                                                            0 && (
                                                            <Badge className="mt-1.5 bg-warning text-warning-foreground">
                                                                {
                                                                    adminCounters.rechargesPending
                                                                }{" "}
                                                                en attente
                                                            </Badge>
                                                        )}
                                                </span>
                                                <ChevronRight
                                                    className="size-5 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        )}

                                        {user.role === "NURSE" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTab("missions")
                                                }
                                                className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                            >
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <ClipboardCheck
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-bold">
                                                        Mes missions
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Consultez vos
                                                        interventions et comptes
                                                        rendus
                                                    </span>
                                                </span>
                                                <ChevronRight
                                                    className="size-5 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        )}

                                        {/* Raccourci ADMIN — gestion du catalogue de spécialités
                                consommé par l'étape 2 du wizard patient (feature live,
                                contrairement aux modules « à venir » ci-dessous) */}
                                        {user.role === "ADMIN" && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setTab("specialties")
                                                }
                                                className="mb-6 flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
                                            >
                                                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                    <Stethoscope
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-bold">
                                                        Gérer les spécialités
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Catalogue proposé aux
                                                        patients à la prise de
                                                        RDV
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                                                    Ouvrir
                                                    <ChevronRight
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
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
                                                    <Tags
                                                        className="size-5"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-bold">
                                                        Tarifs des consultations
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Fixer le prix en Tokens
                                                        de chaque consultation
                                                    </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-primary">
                                                    Ouvrir
                                                    <ChevronRight
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </span>
                                            </button>
                                        )}

                                        {/* Espace par rôle — cartes fonctionnalités : passées en
                                live = raccourcis cliquables (badge vert), les autres
                                restent annoncées « à venir » */}
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
                                                    {space.features.map(
                                                        feature => (
                                                            <li
                                                                key={
                                                                    feature.title
                                                                }
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
                                                                        {
                                                                            feature.title
                                                                        }
                                                                    </span>
                                                                    <span className="text-sm leading-relaxed text-muted-foreground">
                                                                        {
                                                                            feature.description
                                                                        }
                                                                    </span>
                                                                </span>
                                                                {feature.live &&
                                                                feature.tab ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setTab(
                                                                                feature.tab!
                                                                            )
                                                                        }
                                                                        className="mt-auto flex w-fit items-center gap-1 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-success-foreground transition-colors hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                        aria-label={`Ouvrir ${feature.title}`}
                                                                    >
                                                                        <CircleCheck
                                                                            className="size-3"
                                                                            aria-hidden="true"
                                                                        />
                                                                        Disponible
                                                                        — ouvrir
                                                                    </button>
                                                                ) : (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="mt-auto w-fit gap-1"
                                                                    >
                                                                        <Clock
                                                                            className="size-3"
                                                                            aria-hidden="true"
                                                                        />
                                                                        Bientôt
                                                                        disponible
                                                                    </Badge>
                                                                )}
                                                            </li>
                                                        )
                                                    )}
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

                        {tab === "missions" && user.role === "NURSE" && (
                            <motion.section
                                key="missions"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Mes missions"
                            >
                                <NurseMissionsView />
                            </motion.section>
                        )}

                        {/* Task 35 — « Missions & Dispatch » du Médecin Chef : file
                    à affecter + supervision + réaffectation (sidebar latérale
                    et raccourci accueil, même destination). */}
                        {tab === "missions" && user.role === "ADMIN" && (
                            <motion.section
                                key="missions-admin"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Missions et dispatch"
                            >
                                <AdminMissionsView />
                            </motion.section>
                        )}

                        {/* FEATURE-ANNUAIRE-ADMIN — équipes : supervision de
                    l'effectif + dispatch ; annuaires patients / infirmiers avec
                    suspension de compte. */}
                        {tab === "equipes" && user.role === "ADMIN" && (
                            <motion.section
                                key="equipes"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Supervision et dispatch des équipes"
                            >
                                <AdminTeamsView />
                            </motion.section>
                        )}

                        {tab === "patients" && user.role === "ADMIN" && (
                            <motion.section
                                key="patients"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Annuaire des patients"
                            >
                                <AdminPatientsView />
                            </motion.section>
                        )}

                        {tab === "infirmiers" && user.role === "ADMIN" && (
                            <motion.section
                                key="infirmiers"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Annuaire des infirmiers"
                            >
                                <AdminNursesView />
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
                                    onRefresh={() => void patientData.refresh()}
                                    onOpenArticle={setOpenArticle}
                                />
                            </motion.section>
                        )}

                        {tab === "wallet" && isPatient && (
                            <motion.section
                                key="wallet"
                                variants={tabVariants}
                                initial="enter"
                                animate="center"
                                exit="exit"
                                aria-label="Wallet"
                            >
                                <WalletSection
                                    openRecharge={rechargeRequested}
                                    onRechargeOpened={() =>
                                        setRechargeRequested(false)
                                    }
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
                                <SpecialtiesView />
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
                                <RechargesView />
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
                                <TariffsView />
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
                                ) : user.role === "NURSE" ? (
                                    // Profil infirmier complet — Task 34 : activité
                                    // missions réelle, infos éditables, mot de passe
                                    // fonctionnel, préférences persistées.
                                    <NurseProfileView
                                        user={user}
                                        onLogout={handleLogout}
                                    />
                                ) : (
                                    // Profil Médecin Chef complet — Task 35 : activité de
                                    // supervision réelle, infos éditables (dialogs partagés),
                                    // mot de passe fonctionnel (contrat Task 34),
                                    // confidentialité médicale renforcée.
                                    <AdminProfileView
                                        user={user}
                                        onLogout={handleLogout}
                                    />
                                )}
                            </motion.section>
                        )}
                    </AnimatePresence>
                </div>
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
                    onBooked={appointment => {
                        void patientData.refresh()
                        // Task 36 — rappels LOCAUX H-24 / H-1 planifiés sur
                        // l'appareil (fonctionnent sans Firebase ni réseau) +
                        // retour haptique de succès.
                        void scheduleAppointmentReminders({
                            id: appointment.id,
                            type: appointment.type,
                            scheduledAt: appointment.scheduledAt,
                            enabled: user.appointmentReminders,
                        })
                        void hapticSuccess()
                    }}
                    onRecharge={() => {
                        setBookingOpen(false)
                        setRechargeRequested(true)
                        setTab("wallet")
                    }}
                    zone={user.zone}
                />
            )}

            {/* Navigation basse flottante — style app native, safe-area iOS respectée.
                Le Médecin Chef n'en a pas : sa navigation vit dans la sidebar
                latérale (accueil, missions, recharges, spécialités, tarifs, profil). */}
            {!isAdmin && (
                <nav
                    aria-label="Navigation principale"
                    className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
                >
                    <ul className="mx-auto flex max-w-md items-center justify-around gap-1 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-lg shadow-primary/[0.08] backdrop-blur-md">
                        {(isPatient
                            ? PATIENT_TABS
                            : user.role === "NURSE"
                              ? NURSE_TABS
                              : BASE_TABS
                        ).map(item => {
                            const isActive = tab === item.id
                            return (
                                <li key={item.id} className="flex-1">
                                    <button
                                        type="button"
                                        onClick={() => setTab(item.id)}
                                        aria-current={
                                            isActive ? "page" : undefined
                                        }
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
            )}
        </div>
    )
}
