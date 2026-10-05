// FEATURE-PUSH / ADR-010 — Backend des identifiants d'appareils natifs.
// Serveur uniquement. La table `device_tokens` porte deux populations :
//  1. les jetons FCM dormants (ADR-009 — aucun projet Firebase, jamais
//     alimentés en pratique) ;
//  2. les CLÉS DE SONDAGE du Background Runner (ADR-010) : un secret
//     généré par le serveur, présenté par l'appareil en `Authorization:
//     Bearer` pour lire GET /api/notifications/poll — c'est la voie « app
//     fermée » sans Firebase.
// Sécurité : seule l'empreinte SHA-256 de la clé est stockée (même posture
// que Session.tokenHash dans lib/auth.ts). Une fuite de la base ne permet
// pas de rejouer une clé.
import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// ——— Enregistrement des identifiants d'appareils ———

export type DevicePlatform = "android" | "ios" | "web";

export type DeviceTokenInput = {
    token: string;
    platform: DevicePlatform;
    deviceName?: string | null;
    appVersion?: string | null;
};

// Empreinte SHA-256 hexadécimale (64 caractères) — format stocké en base.
function hashIdentifier(identifier: string): string {
    return createHash("sha256").update(identifier).digest("hex");
}

// Durée de vie d'une clé de sondage. Compromis : assez longue pour ne pas
// casser la notification « app fermée » des utilisateurs réguliers, assez
// courte pour qu'une clé de appareil perdu cesse d'être valide même sans
// déconnexion. Renouvelée à chaque provisionning réussi de l'app.
export const DEVICE_KEY_TTL_DAYS = 180;

export type IssuedDeviceKey = {
    /** Clé en clair — retournée UNE seule fois à l'appareil. */
    key: string;
    expiresAt: Date;
};

// Émet une NOUVELLE clé de sondage pour l'utilisateur : 32 octets aléatoires
// (CSPRNG node:crypto), stockage du SHA-256 uniquement, TTL 180 jours.
// Les clés expirées de la table sont écrémées à l'occasion (pas de cron).
export async function issueDeviceKey(
    userId: string,
    input: Omit<DeviceTokenInput, "token">,
): Promise<IssuedDeviceKey> {
    const key = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + DEVICE_KEY_TTL_DAYS * 24 * 3_600_000);

    // Écrémage opportun des clés expirées (coût négligeable, table petite).
    await db.deviceToken
        .deleteMany({ where: { expiresAt: { lt: new Date() } } })
        .catch(() => undefined);

    await db.deviceToken.create({
        data: {
            userId,
            token: hashIdentifier(key),
            platform: input.platform,
            deviceName: input.deviceName ?? null,
            appVersion: input.appVersion ?? null,
            expiresAt,
        },
    });

    return { key, expiresAt };
}

// Vérifie une clé Bearer et renvoie l'utilisateur propriétaire — OUVERTURE
// DE SESSION pour /api/notifications/poll (le runner n'a pas de cookie).
// Refus si : clé inconnue, expirée, ou compte supprimé (relation manquante).
export async function findUserByDeviceKey(key: string): Promise<{
    id: string;
    fullName: string;
    role: "PATIENT" | "NURSE" | "ADMIN";
} | null> {
    const record = await db.deviceToken.findUnique({
        where: { token: hashIdentifier(key) },
        select: {
            expiresAt: true,
            user: { select: { id: true, fullName: true, role: true } },
        },
    });
    if (!record) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;
    return record.user;
}

// Upsert par identifiant (ré-déclaration d'un appareil existant : update de
// lastSeenAt et réattribution au compte courant — un appareil ne suit que
// l'utilisateur qui vient de se connecter).
export async function registerDeviceToken(
    userId: string,
    input: DeviceTokenInput,
): Promise<void> {
    await db.deviceToken.upsert({
        where: { token: hashIdentifier(input.token) },
        create: {
            userId,
            token: hashIdentifier(input.token),
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

// Révocation d'UN identifiant (déconnexion de l'appareil courant) ou de
// TOUS les identifiants de l'utilisateur. Idempotent : supprimer un
// identifiant absent n'est pas une erreur.
export async function removeDeviceToken(identifier: string): Promise<void> {
    await db.deviceToken.deleteMany({ where: { token: hashIdentifier(identifier) } });
}

export async function removeAllDeviceTokens(userId: string): Promise<void> {
    await db.deviceToken.deleteMany({ where: { userId } });
}
