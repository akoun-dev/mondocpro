// FEATURE-DARK-MODE (Task 37) — moteur du thème par utilisateur, côté client.
//
// Même philosophie que src/lib/native.ts : un pont unique et inerte hors du
// contexte concerné. Ici, tout est no-op sûr dans un navigateur classique ET
// dans le WebView Capacitor (window/document toujours présents côté client).
//
// Principe :
//   - le choix utilisateur (SYSTEM / LIGHT / DARK) vit dans localStorage
//     (peinture instantanée au boot, sans flash de mauvais thème) ;
//   - la préférence SERVEUR (User.theme, PATCH /api/auth/profile) est la
//     source de vérité quand l'utilisateur est connecté : ThemeInit la
//     récupère via /api/auth/me et écrase le local si divergente ;
//   - le thème est appliqué en posant la classe `dark` sur <html> (Tailwind 4,
//     @custom-variant dark) + mise à jour de <meta name="theme-color"> et de
//     la barre de statut native Capacitor (Task 36) pour une app cohérente.
// Tout échec (SSR, localStorage indisponible, me() 401) est silencieux.

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "mondocpro-theme";

const THEME_COLOR_LIGHT = "#ffffff";
const THEME_COLOR_DARK = "#1b262f";

export function isThemeChoice(value: unknown): value is ThemeChoice {
    return value === "system" || value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeChoice {
    if (typeof window === "undefined") return "system";
    try {
        const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeChoice(raw) ? raw : "system";
    } catch {
        return "system";
    }
}

/** Résout le choix en état sombre effectif (SYSTEM → prefers-color-scheme). */
export function resolvesToDark(choice: ThemeChoice): boolean {
    if (choice === "dark") return true;
    if (choice === "light") return false;
    return (
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
    );
}

/**
 * Abonnement aux changements de thème (useSyncExternalStore) : événement
 * applicatif + cross-onglets. Un choix SYSTEM écoute aussi matchMedia via
 * applyTheme qui rediffuse mondocpro:theme à chaque changement effectif.
 */
export function subscribeTheme(onChange: () => void): () => void {
    window.addEventListener("mondocpro:theme", onChange);
    window.addEventListener("storage", onChange);
    return () => {
        window.removeEventListener("mondocpro:theme", onChange);
        window.removeEventListener("storage", onChange);
    };
}

function syncNativeStatusBar(isDark: boolean): void {
    // Pont natif Capacitor (Task 36) — no-op dans le navigateur.
    type StatusBarLike = {
        setStyle: (o: { style: string }) => Promise<void>;
        setBackgroundColor: (o: { color: string }) => Promise<void>;
    };
    const cap = (
        window as unknown as {
            Capacitor?: {
                isNativePlatform?: () => boolean;
                Plugins?: { StatusBar?: StatusBarLike };
            };
        }
    ).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    const statusBar = cap.Plugins?.StatusBar;
    if (!statusBar) return;
    statusBar
        .setStyle({ style: isDark ? "Dark" : "Light" })
        .then(() => statusBar.setBackgroundColor({ color: isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT }))
        .catch(() => {
            /* jamais bloquant */
        });
}

/** Applique le choix : classe .dark sur <html> + meta theme-color + natif. */
export function applyTheme(choice: ThemeChoice): void {
    if (typeof document === "undefined") return;
    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    } catch {
        /* localStorage indisponible — on applique quand même */
    }
    const isDark = resolvesToDark(choice);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
    }
    meta.content = isDark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
    syncNativeStatusBar(isDark);
    window.dispatchEvent(
        new CustomEvent("mondocpro:theme", { detail: { choice, isDark } }),
    );
}

/**
 * Change la préférence : application locale immédiate + persistance serveur
 * (pour CHAQUE utilisateur — User.theme) si une session est ouverte.
 * Le serveur fait foi au prochain boot (ThemeInit), le localStorage donne la
 * peinture instantanée en attendant. Jamais de throw (feu et oubli).
 */
export function setTheme(choice: ThemeChoice): void {
    applyTheme(choice);
    void (async () => {
        try {
            const res = await fetch("/api/auth/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ theme: choice.toUpperCase() }),
            });
            if (!res.ok) {
                console.warn(
                    `[theme] préférence non persistée (HTTP ${res.status}) — appliquée localement seulement`,
                );
            }
        } catch {
            /* hors-ligne : appliqué localement, sera re-synchronisé */
        }
    })();
}
