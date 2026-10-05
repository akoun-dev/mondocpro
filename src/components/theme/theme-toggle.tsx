// FEATURE-DARK-MODE (Task 37) — bouton compact de bascule clair/sombre pour
// les en-têtes de dashboard (patient, infirmier, admin). Le choix explicite
// (LIGHT/DARK) est persisté pour l'utilisateur via setTheme (local + PATCH
// /api/auth/profile). Le mode SYSTEM reste sélectionnable depuis la vue
// Profil (« Apparence ») — ici on passe d'un état concret à l'autre.
//
// useSyncExternalStore : le thème est une valeur externe mutable (classe sur
// <html> + localStorage) — le snapshot serveur (false) évite tout mismatch
// d'hydratation, l'icône lune s'affiche avant hydratation puis se corrige.
"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import {
    getStoredTheme,
    resolvesToDark,
    setTheme,
    subscribeTheme,
} from "@/lib/theme";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const isDark = useSyncExternalStore(
        subscribeTheme,
        () => resolvesToDark(getStoredTheme()),
        () => false,
    );

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
            title={isDark ? "Thème clair" : "Thème sombre"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            // 44px sur mobile (cible tactile minimale WCAG 2.2), 36px sur
            // desktop où la souris n'a pas de contrainte de précision. Aligné
            // sur la cloche de notifications, voisine immédiate dans le même
            // en-tête : deux boutons d'actions doivent avoir la même hauteur.
            className="size-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:size-9"
        >
            {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>
    );
}
