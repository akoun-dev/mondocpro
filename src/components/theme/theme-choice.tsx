// FEATURE-DARK-MODE (Task 37) — sélecteur « Apparence » des vues Profil
// (patient, infirmier, admin) : Système / Clair / Sombre. Chaque choix est
// appliqué immédiatement (setTheme) et persisté pour l'utilisateur courant
// (PATCH /api/auth/profile). Radiogroup ARIA, navigation clavier native.
//
// useSyncExternalStore : le thème est une valeur externe (localStorage) ;
// snapshot serveur « system » — aucun mismatch d'hydratation.
"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
    getStoredTheme,
    setTheme,
    subscribeTheme,
    type ThemeChoice,
} from "@/lib/theme";

const OPTIONS: Array<{
    value: ThemeChoice;
    label: string;
    description: string;
    icon: typeof Monitor;
}> = [
    {
        value: "system",
        label: "Système",
        description: "Suit le réglage de votre appareil",
        icon: Monitor,
    },
    {
        value: "light",
        label: "Clair",
        description: "Toujours en thème clair",
        icon: Sun,
    },
    {
        value: "dark",
        label: "Sombre",
        description: "Toujours en thème sombre",
        icon: Moon,
    },
];

export function ThemeChoice() {
    const choice = useSyncExternalStore(
        subscribeTheme,
        getStoredTheme,
        () => "system",
    );

    return (
        <div
            role="radiogroup"
            aria-label="Apparence"
            className="grid grid-cols-3 gap-2"
        >
            {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const selected = choice === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setTheme(opt.value)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                    >
                        <Icon
                            className={`size-5 ${selected ? "text-primary" : ""}`}
                            aria-hidden
                        />
                        <span className="text-xs font-semibold">{opt.label}</span>
                        <span className="hidden text-[10px] leading-tight sm:block">
                            {opt.description}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
