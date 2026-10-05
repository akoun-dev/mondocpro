"use client";

// Task 36 — Bootstrap natif Capacitor, monté une seule fois dans le layout
// racine. Responsabilités :
//  1. Initialiser le shell natif (splash, barre de statut, bouton retour,
//     écoute réseau) — no-op complet dans un navigateur classique.
//  2. Enregistrer le push FCM dès qu'une session valide est détectée, et à
//     chaque reprise de l'app (le jeton peut tourner, le compte changer).
//  3. Afficher un bandeau « hors ligne » alimenté par @capacitor/network.
// Le composant ne rend rien tant que tout va bien — zéro impact visuel.
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { initNativeShell, isNative, registerPush } from "@/lib/native";

export function NativeBootstrap() {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        if (!isNative()) return;

        initNativeShell();

        // Bandeau hors-ligne : état initial + suivi des changements natifs.
        const onNetwork = (event: Event) => {
            setOffline(!(event as CustomEvent<boolean>).detail);
        };
        window.addEventListener("mondocpro:network", onNetwork);

        // Enregistrement push : uniquement avec une session valide (401 sans
        // session → le POST register échouerait de toute façon). Rejoué à
        // chaque reprise : re-registrations idempotentes côté serveur.
        // ADR-010 : déclenché aussi à la CONNEXION (event "mondocpro:session-open"
        // émis par use-auth) — le login est une navigation SPA, sans rechargement,
        // la session doit provisionner le runner sans attendre une reprise.
        let cancelled = false;
        const tryRegisterPush = async () => {
            try {
                const res = await fetch("/api/auth/me", { cache: "no-store" });
                if (!res.ok || cancelled) return;
                const data = (await res.json()) as { user?: unknown };
                if (data.user) void registerPush();
            } catch {
                // hors-ligne / serveur injoignable — retenté à la reprise
            }
        };
        void tryRegisterPush();

        const onSessionOpen = () => void tryRegisterPush();
        window.addEventListener("mondocpro:session-open", onSessionOpen);

        const onVisibility = () => {
            if (document.visibilityState === "visible") void tryRegisterPush();
        };
        document.addEventListener("visibilitychange", onVisibility);

        return () => {
            cancelled = true;
            window.removeEventListener("mondocpro:network", onNetwork);
            window.removeEventListener("mondocpro:session-open", onSessionOpen);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, []);

    if (!offline) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-medium text-white shadow-md"
        >
            <WifiOff className="size-3.5" aria-hidden="true" />
            Vous êtes hors ligne — les notifications et la synchronisation
            reprendront au retour du réseau.
        </div>
    );
}
