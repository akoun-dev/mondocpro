"use client"

// Espace connecté MVP — US-AUTH-3/4 (SPEC-AUTH)
// Design v3 « app mobile » (refonte UI 2026-10) : barre d'app sticky,
// navigation basse flottante (Accueil / Profil) type application native,
// vues animées sobres framer-motion (DESIGN_SYSTEM §4). Logique intacte.
import Image from "next/image"
import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
    Activity,
    BarChart3,
    BellRing,
    CalendarCheck,
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
import { ZONE_LABELS } from "@/lib/auth-schemas"
import { useAuth } from "@/hooks/use-auth"
import { toast } from "@/hooks/use-toast"
import type { AppRole, AppUser } from "@/stores/auth-store"

const ROLE_LABELS: Record<AppRole, string> = {
    PATIENT: "Patient",
    INFIRMIER: "Infirmier",
    ADMIN: "Médecin Chef",
}

const ROLE_SPACE_ICON: Record<AppRole, LucideIcon> = {
    PATIENT: HeartPulse,
    INFIRMIER: Stethoscope,
    ADMIN: UsersRound,
}

// Contrainte a11y (ADR-002) : jamais de texte blanc sur success/warning —
// les foregrounds foncés des tokens sont utilisés tels quels.
const ROLE_BADGE_CLASSES: Record<AppRole, string> = {
    PATIENT: "bg-primary text-primary-foreground",
    INFIRMIER: "bg-success text-success-foreground",
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
    INFIRMIER: {
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

// Onglets de la navigation basse (style app mobile).
type DashboardTab = "accueil" | "profil"

const DASHBOARD_TABS: { id: DashboardTab; label: string; icon: LucideIcon }[] =
    [
        { id: "accueil", label: "Accueil", icon: Home },
        { id: "profil", label: "Profil", icon: UserRound },
    ]

// Formatage lisible : +2250701020304 → +225 07 01 02 03 04 ; 01020304 → 01 02 03 04
function formatPhoneDisplay(phone: string): string {
    const cleaned = phone.replace(/[\s.-]/g, "")
    const hasPlus = cleaned.startsWith("+")
    const digits = hasPlus ? cleaned.slice(1) : cleaned
    if (!/^\d{8,15}$/.test(digits)) return phone

    if (hasPlus && digits.length > 10) {
        const countryCode = digits.slice(0, digits.length - 10)
        const local = digits.slice(-10)
        return `+${countryCode} ${local.replace(/(\d{2})(?=\d)/g, "$1 ")}`
    }
    return `${hasPlus ? "+" : ""}${digits.replace(/(\d{2})(?=\d)/g, "$1 ")}`
}

function getInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    const first = parts[0].charAt(0)
    const second = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ""
    return `${first}${second}`.toUpperCase()
}

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

    if (!user) return null

    const space = ROLE_SPACE[user.role]
    const SpaceIcon = ROLE_SPACE_ICON[user.role]

    async function handleLogout() {
        await logout()
        toast({
            title: "Déconnecté",
            description: "À bientôt sur Mon doc Pro !",
        })
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
                    <div className="flex items-center gap-2">
                        <Image
                            src="/img/Mon doc Pro.jpeg"
                            alt="Mon doc Pro"
                            width={40}
                            height={40}
                            className="size-10 rounded-full object-cover ring-1 ring-primary/30"
                        />
                        <span className="text-lg font-bold tracking-tight text-primary">
                            Mon doc Pro
                        </span>
                    </div>
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
                        </motion.section>
                    )}
                </AnimatePresence>
            </div>

            {/* Navigation basse flottante — style app native, safe-area iOS respectée */}
            <nav
                aria-label="Navigation principale"
                className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            >
                <ul className="mx-auto flex max-w-sm items-center justify-around gap-1 rounded-2xl border border-border/70 bg-card/95 p-1.5 shadow-lg shadow-primary/[0.08] backdrop-blur-md">
                    {DASHBOARD_TABS.map(item => {
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
