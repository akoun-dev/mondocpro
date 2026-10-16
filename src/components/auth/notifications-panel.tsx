"use client"

// Panneau de notifications — cloche + contenu, pour les trois rôles.
//
// Un seul contenu, deux présentations selon la largeur (bascule à 768px) :
//   · mobile  → Sheet bottom, `h-[85dvh]` : la zone de lecture est large et le
//     pouce atteint la croix et « Tout marquer comme lu », figés en haut.
//     Sorties : croix, tap sur l'overlay, bouton retour système (la Sheet sort
//     en role="dialog", ciblé par OPEN_LAYER_SELECTOR dans lib/native.ts).
//     Pas de swipe vers le bas : Dialog Radix ne le gère pas et vaul n'est pas
//     une dépendance du projet.
//   · desktop → Popover ancré à la cloche, à `max-h` et largeur bornée.
import { useState } from "react"
import {
    Bell,
    CalendarCheck,
    ClipboardCheck,
    Wallet,
    XIcon,
    type LucideIcon,
} from "lucide-react"

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Sheet,
    SheetContent,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"
import { relativePublishedLabel, relativeSlotLabel } from "@/lib/datetime"
import { notificationFamily, type NotificationDto } from "@/lib/notifications"
import type { SensibilisationDto } from "@/lib/sensibilisations"
import type { AppointmentDto } from "@/lib/appointments"

// Icone + teinte par famille de notification — `notificationFamily` (lib/
// notifications) porte la regle de famille, seul le rendu visuel est local.
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

// Séparateur de groupe. Le panneau fusionne trois sources sans les distinguer
// (notifications persistées, prochain rendez-vous, conseils santé) : sans
// étiquette, une ligne de conseil santé se lit comme une alerte de mission.
// `role="presentation"` car ce n'est pas une entrée de liste.
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

export type NotificationsBellProps = {
    notifications: NotificationDto[]
    unreadCount: number
    nextAppointment: AppointmentDto | null
    sensibilisations: SensibilisationDto[]
    onRefresh: () => Promise<void>
    onMarkAllRead: () => Promise<void>
    onMarkOneRead: (id: string) => void
    /** Destination calculée par le dashboard (routage par rôle). */
    onSelectNotification: (type: string) => void
    onOpenAppointments: () => void
    onOpenArticle: (item: SensibilisationDto) => void
}

// Contenu du panneau — partagé par la Sheet et le Popover.
function NotificationPanel({
    notifications,
    unreadCount,
    nextAppointment,
    sensibilisations,
    onClose,
    onMarkAllRead,
    onMarkOneRead,
    onSelectNotification,
    onOpenAppointments,
    onOpenArticle,
    inSheet,
}: Omit<NotificationsBellProps, "onRefresh"> & {
    onClose: () => void
    /** false = presentation Popover (defaut). */
    inSheet?: boolean
}) {
    return (
        <>
            {/* En-tête hors zone de défilement : « tout marquer comme lu »
                doit rester atteignable quel que soit le scroll — sur mobile la
                liste occupe presque toute la hauteur restante. */}
            <div
                className={cn(
                    "relative flex items-center justify-between gap-2 border-b bg-popover px-4 py-3",
                    // place pour la croix 44px de la Sheet, qui chevauchait
                    // sinon « Tout marquer comme lu » sur écran étroit
                    inSheet && "pr-14"
                )}
            >
                <p className="text-sm font-semibold">Notifications</p>
                {unreadCount > 0 && (
                    <button
                        type="button"
                        onClick={() => void onMarkAllRead()}
                        className="shrink-0 whitespace-nowrap rounded-lg px-1 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Tout marquer comme lu
                    </button>
                )}
                {/* Croix de la Sheet : celle de shadcn est un <button> de 16px
                    absolu en haut à droite — trop petit au doigt et en
                    collision avec l'action ci-dessus. C'est aussi le geste de
                    sortie explicite au mobile (l'overlay et le retour système
                    restent actifs). */}
                {inSheet && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fermer les notifications"
                        className="absolute right-1.5 top-0.5 flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <XIcon className="size-5" aria-hidden="true" />
                    </button>
                )}
            </div>

            <ul
                className={
                    inSheet
                        ? "min-h-0 flex-1 overscroll-contain overflow-y-auto pb-[env(safe-area-inset-bottom)]"
                        : "max-h-[min(70dvh,26rem)] overscroll-contain overflow-y-auto pb-[env(safe-area-inset-bottom)]"
                }
            >
                {notifications.length > 0 && (
                    <NotificationGroupLabel>Alertes &amp; rappels</NotificationGroupLabel>
                )}
                {notifications.map(n => {
                    const visual = notificationVisual(n.type)
                    const NotifIcon = visual.Icon
                    return (
                        <li key={n.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    onClose()
                                    if (!n.readAt) onMarkOneRead(n.id)
                                    onSelectNotification(n.type)
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
                                            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card"
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
                    )
                })}

                {nextAppointment && (
                    <NotificationGroupLabel>
                        Prochain rendez-vous
                    </NotificationGroupLabel>
                )}
                {nextAppointment && (
                    <li>
                        <button
                            type="button"
                            onClick={() => {
                                onClose()
                                onOpenAppointments()
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
                                        nextAppointment.scheduledAt
                                    )}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Mes rendez-vous
                                </span>
                            </span>
                        </button>
                    </li>
                )}

                {sensibilisations.length > 0 && (
                    <NotificationGroupLabel>Conseils santé</NotificationGroupLabel>
                )}
                {sensibilisations.slice(0, 5).map(item => (
                    <li key={item.id}>
                        <button
                            type="button"
                            onClick={() => {
                                onClose()
                                onOpenArticle(item)
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
                    !nextAppointment &&
                    sensibilisations.length === 0 && (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                            Aucune notification pour le moment
                        </li>
                    )}
            </ul>
        </>
    )
}

// Cloche + pastille de non-lus. Déclarée hors du composant parent : sinon
// React la démonte/remonte à chaque render et le Popover/Sheet se referme.
// Pas de onClick maison : le Trigger Radix (via Slot) fournit l'ouverture. Mais
// Slot injecte ce handler (et `data-state`, `aria-haspopup`, `ref`…) en PROPS
// sur son enfant direct : il faut donc les réétaler sur le <button>, sinon le
// clic n'atteint jamais le Trigger et rien ne s'ouvre.
function BellTrigger({
    unreadCount,
    open,
    ...buttonProps
}: {
    unreadCount: number
    open: boolean
} & React.ComponentProps<"button">) {
    return (
        <button
            {...buttonProps}
            type="button"
            aria-label={
                unreadCount > 0
                    ? `Notifications (${unreadCount} non lue${unreadCount > 1 ? "s" : ""})`
                    : "Notifications"
            }
            aria-expanded={open}
            // 44px sur mobile (cible tactile WCAG 2.2), 36px desktop — aligné
            // sur le toggle thème voisin.
            className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9"
        >
            <Bell className="size-5 sm:size-4.5" aria-hidden="true" />
            {unreadCount > 0 && (
                <span
                    aria-hidden="true"
                    className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground"
                >
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            )}
        </button>
    )
}

// Une présentation = une instance. La `key` du wrapper ci-dessous fait
// demonter l'ancienne quand la largeur bascule : son `open` repart de false au
// lieu d'etre reporte sur l'autre présentation (Radix ne se désabonne pas en
// démontant son Portal). Evite aussi un setState dans un effet.
function NotificationsVariant({
    variant,
    ...props
}: NotificationsBellProps & { variant: "sheet" | "popover" }) {
    const [open, setOpen] = useState(false)
    const inSheet = variant === "sheet"

    const panelProps = {
        notifications: props.notifications,
        unreadCount: props.unreadCount,
        nextAppointment: props.nextAppointment,
        sensibilisations: props.sensibilisations,
        onMarkAllRead: props.onMarkAllRead,
        onMarkOneRead: props.onMarkOneRead,
        onSelectNotification: props.onSelectNotification,
        onOpenAppointments: props.onOpenAppointments,
        onOpenArticle: props.onOpenArticle,
    }

    // Unique point de bascule : `onOpenChange` recharge la liste à l'ouverture.
    // Le retour système Capacitor passe par là aussi — la Sheet sort en
    // role="dialog", ciblé par OPEN_LAYER_SELECTOR dans lib/native.ts.
    // Ouverture/fermeture restent internes au composant : faire remonter l'état
    // dans le dashboard rerendrait ses ~1600 lignes à chaque ouverture.
    function handleOpenChange(next: boolean) {
        setOpen(next)
        if (next) void props.onRefresh()
    }

    if (inSheet) {
        return (
            <Sheet open={open} onOpenChange={handleOpenChange}>
                <SheetTrigger asChild>
                    <BellTrigger
                        unreadCount={props.unreadCount}
                        open={open}
                    />
                </SheetTrigger>
                {/* h-[85dvh] : la feuille occupe la quasi-totalité de l'écran, la
                    liste défile dans le reste. `flex flex-col` + `min-h-0` sur
                    le <ul> = le scroll ne pousse pas l'en-tête hors champ.
                    `[&>button]:hidden` retire la croix 16px de shadcn (remplacée
                    par celle du panneau, 44px). Le titre Radix est requis pour
                    l'a11y mais masqué : le titre visible est celui du panneau. */}
                <SheetContent
                    side="bottom"
                    className="flex h-[85dvh] flex-col gap-0 p-0 [&>button]:hidden"
                >
                    <SheetTitle className="sr-only">Notifications</SheetTitle>
                    <NotificationPanel
                        {...panelProps}
                        onClose={() => setOpen(false)}
                        inSheet
                    />
                </SheetContent>
            </Sheet>
        )
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <BellTrigger
                    unreadCount={props.unreadCount}
                    open={open}
                />
            </PopoverTrigger>
            <PopoverContent
                align="end"
                collisionPadding={12}
                className="w-[calc(100vw-1.5rem)] max-w-[22rem] overflow-hidden rounded-2xl p-0"
            >
                <NotificationPanel
                    {...panelProps}
                    onClose={() => setOpen(false)}
                />
            </PopoverContent>
        </Popover>
    )
}

export function NotificationsBell(props: NotificationsBellProps) {
    const isMobile = useIsMobile()
    const variant = isMobile ? "sheet" : "popover"
    return <NotificationsVariant key={variant} variant={variant} {...props} />
}
