// GET /api/notifications/poll — ADR-010 (Task 40).
// Diffusion « app fermée » sans Firebase : le Background Runner de l'APK
// (tâche WorkManager périodique, ~15 min) sonde cet endpoint et transforme
// chaque notification en notification LOCALE Android (canaux « critical » /
// « updates », libellés enrichis côté client).
//
// Auth : `Authorization: Bearer <clé d'appareil>` — PAS de cookie : le
// runner est un processus JS natif sans WebView ni cookie jar. La clé est
// émise par POST /api/native/device-key (session) et stockée hashée en base
// (device_tokens, lib/push.ts). 401 si absente/expirée/inconnue.
//
// Curseur : `?since=<ISO>` — uniquement les notifications postérieures. Le
// runner renvoie `serverTime` de la réponse précédente comme curseur suivant
// (horloge serveur = horloge de comparaison, zéro skew d'appareil). Bornes :
// un `since` trop vieux est ramené à 3 jours (l'utilisateur retrouve l'historique
// complet dans le panneau InApp à la réouverture — le poll ne fait pas rattrapage).
// Les APPOINTMENT_REMINDER sont exclus : rappels déjà planifiés localement à la
// réservation (H-24/H-1, lib/native.ts) — poller aussi produirait des doublons.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { findUserByDeviceKey } from "@/lib/push";
import {
    isCriticalNotification,
    notificationUrlFor,
    type NotificationType,
} from "@/lib/notifications";

// Fenêtre maximale de rattrapage d'un poll (protection anti-rejeu d'un vieux
// curseur et garde-fou si l'appareil reste des semaines sans réseau).
const MAX_LOOKBACK_MS = 3 * 24 * 3_600_000;
// Plafond par tick : le runner affiche au plus 10 notifications locales par
// passage (au-delà, le curseur avance quand même — pas de tempête de notifs).
const POLL_LIMIT = 20;

export async function GET(request: Request) {
    // ——— Auth Bearer (clé d'appareil) ———
    const authorization = request.headers.get("authorization") ?? "";
    const key = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";
    if (key.length < 16) {
        return NextResponse.json(
            { error: "Clé d'appareil requise" },
            { status: 401 },
        );
    }

    const deviceUser = await findUserByDeviceKey(key).catch((error) => {
        console.error("[poll] vérification de clé:", error);
        return null;
    });
    if (!deviceUser) {
        return NextResponse.json(
            { error: "Clé d'appareil invalide ou expirée" },
            { status: 401 },
        );
    }

    // ——— Curseur `since` ———
    const now = new Date();
    const sinceParam = new URL(request.url).searchParams.get("since") ?? "";
    let since = now; // sans curseur : uniquement l'avenir (pas de rattrapage)
    if (sinceParam) {
        const parsed = new Date(sinceParam);
        if (!Number.isNaN(parsed.getTime())) {
            since = parsed;
        }
    }
    const floor = new Date(now.getTime() - MAX_LOOKBACK_MS);
    if (since < floor) since = floor;
    if (since > now) since = now;

    try {
        const rows = await db.notification.findMany({
            where: {
                userId: deviceUser.id,
                createdAt: { gt: since },
                type: { not: "APPOINTMENT_REMINDER" },
            },
            orderBy: { createdAt: "asc" },
            take: POLL_LIMIT,
            select: {
                id: true,
                type: true,
                title: true,
                body: true,
                createdAt: true,
            },
        });

        return NextResponse.json({
            notifications: rows.map((row) => ({
                id: row.id,
                type: row.type as NotificationType,
                title: row.title,
                body: row.body,
                critical: isCriticalNotification(row.type),
                url: notificationUrlFor(row.type, deviceUser.role),
                createdAt: row.createdAt.toISOString(),
            })),
            serverTime: now.toISOString(),
        });
    } catch (error) {
        console.error("[poll] lecture des notifications:", error);
        return NextResponse.json(
            { error: "Erreur interne — réessayez" },
            { status: 500 },
        );
    }
}
