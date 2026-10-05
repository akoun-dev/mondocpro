// FEATURE-PUSH — Backend des jetons d'appareils natifs (Capacitor).
// Serveur uniquement : enregistrement (upsert/révocation) des jetons
// déclarés par l'APK, prêt à servir de carnet d'adresses à tout futur
// transport de push.
//
// Décision ADR-009 (2026-10-05) — AUCUN projet Firebase, aucun envoi :
//  - firebase-admin et tout le code d'envoi FCM sont SUPPRIMÉS du serveur
//    (aucune dépendance Google, aucune clé de service, aucun coût).
//  - Les notifications restent assurées par les canaux InApp (panneau +
//    badge) et locales (rappels RDV) — 100 % fonctionnels sans config.
//  - Le canal push DISTANT est dormant : le client (garde isPushCapable)
//    n'envoie un jeton que si Firebase était initialisé dans l'APK — jamais
//    le cas aujourd'hui. Ces routes restent donc saines (200) mais ne sont
//    plus appelées en pratique.
//  - Ré-activation un jour : configurer le projet Firebase côté APK
//    (google-services.json) puis rétablir l'envoi côté serveur (git revert
//    du commit ADR-009 + FIREBASE_SERVICE_ACCOUNT_JSON sur Vercel).
import "server-only";
import { db } from "@/lib/db";

// ——— Enregistrement des jetons d'appareils ———

export type DevicePlatform = "android" | "ios" | "web";

export type DeviceTokenInput = {
    token: string;
    platform: DevicePlatform;
    deviceName?: string | null;
    appVersion?: string | null;
};

// Upsert par token : si l'appareil était lié à un autre compte, le jeton est
// RÉATTRIBUÉ au compte courant (un appareil ne pousse que pour l'utilisateur
// qui vient de se connecter — jamais pour l'ancien).
export async function registerDeviceToken(
    userId: string,
    input: DeviceTokenInput,
): Promise<void> {
    await db.deviceToken.upsert({
        where: { token: input.token },
        create: {
            userId,
            token: input.token,
            platform: input.platform,
            deviceName: input.deviceName ?? null,
            appVersion: input.appVersion ?? null,
        },
        update: {
            userId,
            platform: input.platform,
            deviceName: input.deviceName ?? null,
            appVersion: input.appVersion ?? null,
            lastSeenAt: new Date(),
        },
    });
}

// Révocation d'UN jeton (déconnexion de l'appareil courant) ou de TOUS les
// jetons de l'utilisateur (future « déconnexion partout »). Idempotent :
// supprimer un jeton absent n'est pas une erreur.
export async function removeDeviceToken(token: string): Promise<void> {
    await db.deviceToken.deleteMany({ where: { token } });
}

export async function removeAllDeviceTokens(userId: string): Promise<void> {
    await db.deviceToken.deleteMany({ where: { userId } });
}
