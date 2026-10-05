"use client"

import {
    Banknote,
    ClipboardCheck,
    LayoutDashboard,
    LogOut,
    Menu,
    Tags,
    X,
    Stethoscope,
    UserRound,
    UsersRound,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"
import type { AppUser } from "@/stores/auth-store"

export type AdminTab =
    | "accueil"
    | "missions"
    | "equipes"
    | "patients"
    | "infirmiers"
    | "recharges"
    | "specialties"
    | "tarifs"
    | "profil"

// Navigation latérale du Médecin Chef — Task 35 : « Missions & Dispatch »
// rejoint la barre (file à affecter + supervision), à côté des recharges de
// Tokens dont la validation est le second pilier opérationnel.
// FEATURE-ANNUAIRE-ADMIN : « Équipes » (supervision + dispatch des effectifs)
// et les deux annuaires Patients / Infirmiers viennent s'ajouter au pilotage
// opérationnel. « Missions » reste le journal des interventions ; « Équipes »
// est la vue décisionnelle (charge, file à affecter, répartition par zone).
const ITEMS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "accueil", label: "Vue d'ensemble", icon: LayoutDashboard },
    { id: "equipes", label: "Équipes", icon: UsersRound },
    { id: "missions", label: "Missions & Dispatch", icon: ClipboardCheck },
    { id: "patients", label: "Patients", icon: UserRound },
    { id: "infirmiers", label: "Infirmiers", icon: Stethoscope },
    { id: "recharges", label: "Recharges Tokens", icon: Banknote },
    { id: "specialties", label: "Spécialités", icon: Stethoscope },
    { id: "tarifs", label: "Tarifs", icon: Tags },
]

type Props = {
    user: AppUser
    activeTab: AdminTab
    open: boolean
    onOpenChange: (open: boolean) => void
    onSelect: (tab: AdminTab) => void
    onLogout: () => void
}

export function AdminSidebar({
    user,
    activeTab,
    open,
    onOpenChange,
    onSelect,
    onLogout,
}: Props) {
    const content = (
        <aside className="flex h-full w-72 flex-col border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
            <div className="flex items-center justify-between gap-3 px-2 pb-6">
                <div className="leading-tight">
                    <p className="font-bold tracking-tight">Mon doc Pro</p>
                    <p className="text-xs text-sidebar-foreground/60">
                        Administration
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 rounded-lg lg:hidden"
                    onClick={() => onOpenChange(false)}
                    aria-label="Fermer le menu admin"
                >
                    <X className="size-4" aria-hidden="true" />
                </Button>
            </div>

            <nav aria-label="Menu administration" className="flex-1">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50">
                    Gestion
                </p>
                <ul className="grid gap-1">
                    {ITEMS.map(item => {
                        const active = activeTab === item.id
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelect(item.id)
                                        onOpenChange(false)
                                    }}
                                    aria-current={active ? "page" : undefined}
                                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                                        active
                                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    }`}
                                >
                                    <item.icon
                                        className="size-4.5"
                                        aria-hidden="true"
                                    />
                                    {item.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            <div className="border-t border-sidebar-border pt-4">
                <button
                    type="button"
                    onClick={() => {
                        onSelect("profil")
                        onOpenChange(false)
                    }}
                    className={`mb-2 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent ${activeTab === "profil" ? "bg-sidebar-accent" : ""}`}
                >
                    <Avatar className="size-9">
                        <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                            {getInitials(user.fullName)}
                        </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                            {user.fullName}
                        </span>
                        <span className="block text-xs text-sidebar-foreground/60">
                            Médecin Chef
                        </span>
                    </span>
                    <UserRound
                        className="size-4 text-sidebar-foreground/50"
                        aria-hidden="true"
                    />
                </button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onLogout}
                    className="h-10 w-full justify-start gap-3 rounded-xl px-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    <LogOut className="size-4" aria-hidden="true" />
                    Se déconnecter
                </Button>
            </div>
        </aside>
    )

    return (
        <>
            <div className="hidden shrink-0 lg:block">{content}</div>
            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
                        onClick={() => onOpenChange(false)}
                        aria-label="Fermer le menu admin"
                    />
                    <div className="relative h-full w-72 shadow-2xl">
                        {content}
                    </div>
                </div>
            )}
        </>
    )
}

export function AdminMenuButton({ onClick }: { onClick: () => void }) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg lg:hidden"
            onClick={onClick}
            aria-label="Ouvrir le menu admin"
        >
            <Menu className="size-5" aria-hidden="true" />
        </Button>
    )
}
