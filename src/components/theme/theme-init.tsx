// FEATURE-DARK-MODE (Task 37) — initialisation du thème, montée dans le
// RootLayout (à côté de NativeBootstrap). No-op rendu serveur ; tout se passe
// après hydratation :
//   1. peinture instantanée : applique le choix localStorage (évite le flash
//      du mauvais thème au chargement) ;
//   2. synchronisation serveur : /api/auth/me → User.theme (préférence par
//      utilisateur, source de vérité si connecté) écrase le local si divergent ;
//   3. mode SYSTEM : suit les changements de prefers-color-scheme en direct.
"use client";

import { useEffect } from "react";
import {
    applyTheme,
    getStoredTheme,
    isThemeChoice,
    resolvesToDark,
    type ThemeChoice,
} from "@/lib/theme";

export function ThemeInit() {
    useEffect(() => {
        // 1) Boot depuis localStorage (peinture immédiate).
        applyTheme(getStoredTheme());

        let current: ThemeChoice = getStoredTheme();
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const onMediaChange = () => {
            if (current === "system") applyTheme("system");
        };
        media.addEventListener("change", onMediaChange);

        // 2) La préférence SERVEUR (par utilisateur) fait foi une fois la
        //    session vérifiée — ThemeInit ne modifie JAMAIS la base ici.
        void (async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok) return; // 401 : visiteur — le local suffit.
                const data = (await res.json()) as {
                    user?: { theme?: string };
                };
                const serverTheme = data.user?.theme;
                if (isThemeChoice(serverTheme?.toLowerCase() as unknown)) {
                    const choice = serverTheme!.toLowerCase() as ThemeChoice;
                    if (choice !== getStoredTheme()) applyTheme(choice);
                    current = choice;
                }
            } catch {
                /* hors-ligne / réseau : le local reste appliqué */
            }
        })();

        return () => media.removeEventListener("change", onMediaChange);
    }, []);

    // Composant invisible : aucune empreinte DOM.
    return null;
}
