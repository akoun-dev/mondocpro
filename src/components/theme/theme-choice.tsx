// FEATURE-DARK-MODE (Task 37) — sélecteur « Apparence » des vues Profil
// (patient, infirmier, admin) : Système / Clair / Sombre, en CONTRÔLE
// SEGMENTÉ (maquette « Mon profil » : pastille du choix actif en bg-card
// avec icône et texte primary). Chaque choix est appliqué immédiatement
// (setTheme) et persisté pour l'utilisateur courant (PATCH /api/auth/profile).
// Radiogroup ARIA, navigation clavier native.
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
    icon: typeof Monitor;
}> = [
    { value: "system", label: "Système", icon: Monitor },
    { value: "light", label: "Clair", icon: Sun },
    { value: "dark", label: "Sombre", icon: Moon },
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
            className="flex gap-1 rounded-2xl bg-muted p-1"
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
                        className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            selected
                                ? "bg-card text-primary shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon className="size-4.5" aria-hidden />
                        <span className="text-xs font-semibold">
                            {opt.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
