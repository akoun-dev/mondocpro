// FEATURE-PUSH (Task 36) — Backend des notifications PUSH natives (FCM).
// Serveur uniquement : enregistrement des jetons d'appareils Capacitor
// (upsert/révocation) et envoi Firebase Cloud Messaging.
//
// Philosophie (alignée sur lib/notifications.ts) :
//  - Le push accompagne TOUJOURS une notification InApp (double canal) ;
//    il ne la remplace jamais et ne bloque jamais l'opération métier.
//  - Aucun envoi ne doit faire échouer la route appelante : les helpers
//    d'envoi attrapent TOUTES les erreurs (fire-and-forget `void sendPush…`
//    dans les routes) et journalisent côté serveur.
//  - Firebase est OPTIONNEL : tant que FIREBASE_SERVICE_ACCOUNT_JSON (ou les
//    3 variables décomposées) est absente, l'enregistrement des jetons
//    fonctionne, mais l'envoi est no-op (log d'information unique). Le setup
//    est documenté dans .ai/APK_BUILD.md §4 — aucune dépendance de build.
import "server-only";
import { db } from "@/lib/db";
import { notificationFamily } from "@/lib/notifications";

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

// ——— URL de navigation profonde (clic sur la push) ———
// Miroir serveur de notificationDestination() (components/auth/user-dashboard)
// : le payload FCM porte data.url, l'app native y navigue au tap
// (src/lib/native.ts). Une seule source de vérité par canal, même graphe.
export function pushUrlFor(type: string, role: string): string {
    const family = notificationFamily(type);
    if (role === "PATIENT") {
        return family === "recharge" ? "/?tab=wallet" : "/?tab=rdv";
    }
    if (role === "NURSE") return "/?tab=missions";
    return family === "recharge" ? "/?tab=recharges" : "/?tab=missions";
}

// ——— Envoi FCM (firebase-admin chargé à la demande) ———

export type PushPayload = {
    title: string;
    body: string;
    /** Type de notification InApp jumelle — sert au routage du clic. */
    type?: string;
    /** Entité source (appointmentId, rechargeId…) — contexte métier. */
    entityId?: string | null;
};

// Plafond FCM par requête multicast (doc Firebase) — un utilisateur passionné
// d'appareils ne fait pas tomber l'envoi des autres.
const MAX_TOKENS_PER_REQUEST = 500;

// Rôles des destinataires résolus en une requête (URL par rôle).
type Recipient = { id: string; role: string };

let messagingDisabledLogged = false;

// Résout le Messaging Firebase, ou null si non configuré / indisponible.
// Configuration attendue (Vercel → Environment Variables) :
//   FIREBASE_SERVICE_ACCOUNT_JSON — le JSON du compte de service ENTIERS
// (ou les 3 variables décomposées FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
// FIREBASE_PRIVATE_KEY — \n littéraux acceptés).
async function getMessaging(): Promise<object | null> {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!serviceAccountJson && !(projectId && clientEmail && privateKey)) {
        if (!messagingDisabledLogged) {
            messagingDisabledLogged = true;
            console.info(
                "[push] Firebase non configuré (FIREBASE_SERVICE_ACCOUNT_JSON absente) — " +
                    "les notifications InApp continuent de fonctionner ; le canal push " +
                    "sera actif après le setup (.ai/APK_BUILD.md §4).",
            );
        }
        return null;
    }

    try {
        const adminApp = await import("firebase-admin/app");
        const adminMessaging = await import("firebase-admin/messaging");
        const existing = adminApp.getApps();
        if (existing.length === 0) {
            adminApp.initializeApp({
                credential: adminApp.cert(
                    serviceAccountJson
                        ? JSON.parse(serviceAccountJson)
                        : {
                              projectId,
                              clientEmail,
                              privateKey,
                          },
                ),
            });
        }
        return adminMessaging.getMessaging() as unknown as object;
    } catch (error) {
        console.error("[push] init firebase-admin impossible:", error);
        return null;
    }
}

// Envoie la push à TOUS les comptes ADMIN (Médecin Chef) — miroir de
// notifyAdmins() pour le canal natif (file de travail collective : chaque
// admin reçoit la push comme la notification InApp jumelle).
export async function sendPushToAdmins(
    payload: PushPayload,
): Promise<{ sent: number; failed: number } | null> {
    try {
        const admins = await db.user.findMany({
            where: { role: "ADMIN" },
            select: { id: true },
        });
        return await sendPushToUsers(
            admins.map((a) => a.id),
            payload,
        );
    } catch (error) {
        console.error("[push] sendPushToAdmins échoué (ignoré):", error);
        return null;
    }
}

// Envoie la push à TOUS les appareils des destinataires. Jamais de throw :
// un échec FCM (quota, réseau, credentials) ne doit jamais casser la route
// métier qui l'appelle. Les jetons invalidés par FCM (app désinstallée,
// token expiré) sont supprimés — l'écrémage est incrémental et gratuit.
export async function sendPushToUsers(
    userIds: string[],
    payload: PushPayload,
): Promise<{ sent: number; failed: number } | null> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return null;

    try {
        const [messaging, tokens, recipients] = await Promise.all([
            getMessaging(),
            db.deviceToken.findMany({
                where: { userId: { in: unique } },
                select: { token: true, userId: true },
                take: MAX_TOKENS_PER_REQUEST,
            }),
            db.user.findMany({
                where: { id: { in: unique } },
                select: { id: true, role: true },
            }),
        ]);
        if (!messaging || tokens.length === 0) return null;

        const roleById = new Map<string, string>(
            recipients.map((r: Recipient) => [r.id, r.role]),
        );

        // data.url par destinataire : le routage du clic dépend du rôle
        // (patient → Wallet/RDV, infirmier → Missions, admin → outil d'action).
        const messages = tokens.map((device) => ({
            token: device.token,
            notification: { title: payload.title, body: payload.body },
            data: {
                url: pushUrlFor(
                    payload.type ?? "",
                    roleById.get(device.userId) ?? "PATIENT",
                ),
                type: payload.type ?? "",
                entityId: payload.entityId ?? "",
            },
            android: { priority: "high" as const },
        }));

        // sendEach (un message par jeton) : les data.url diffèrent par rôle.
        const response = await (
            messaging as {
                sendEach: (messages: object[]) => Promise<{
                    successCount: number;
                    failureCount: number;
                    responses: Array<{ success: boolean; error?: { code?: string } }>;
                }>;
            }
        ).sendEach(messages);

        // Écrémage des jetons morts (codes canoniques FCM v1).
        const deadTokens: string[] = [];
        response.responses.forEach((r, i) => {
            if (!r.success) {
                const code = r.error?.code ?? "";
                if (
                    code.includes("registration-token-not-registered") ||
                    code.includes("invalid-registration-token")
                ) {
                    deadTokens.push(tokens[i].token);
                }
            }
        });
        if (deadTokens.length > 0) {
            await db.deviceToken.deleteMany({
                where: { token: { in: deadTokens } },
            });
        }

        if (response.failureCount > 0) {
            console.warn(
                `[push] envoi: ${response.successCount} OK / ${response.failureCount} échecs` +
                    (deadTokens.length ? ` (${deadTokens.length} jetons purgés)` : ""),
            );
        }
        return { sent: response.successCount, failed: response.failureCount };
    } catch (error) {
        // Jamais de propagation : le push est un canal best-effort.
        console.error("[push] envoi échoué (ignoré):", error);
        return null;
    }
}
