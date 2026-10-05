// ——— Background Runner Mon doc Pro (ADR-010, Task 40) ———
// Fichier exécuté PAR L'OS (WorkManager, toutes les ~15 min) dans un moteur
// JS natif headless — PAS dans le WebView. Il tourne même quand l'app est
// fermée : c'est le seul canal de diffusion des NOUVELLES alertes critiques
// sans Firebase (le canal push distant FCM est dormant, décision PO).
//
// Cycle : l'OS déclenche `onAppTick` → lecture de la clé d'appareil dans le
// KV persistant (SharedPreferences) → GET /api/notifications/poll (Bearer)
// → chaque notification reçue devient une notification LOCALE Android sur
// le canal « critical » (importance HIGH) ou « updates » (DEFAULT) → le
// curseur avance (serverTime de la réponse).
//
// APIs disponibles dans ce runtime (doc @capacitor/background-runner) :
// addEventListener, fetch (pas d'objet Request ; method/headers/body),
// JSON, console, crypto, setTimeout/Interval, TextEncoder/Decoder et les
// API Capacitor custom : CapacitorKV, CapacitorNotifications, CapacitorDevice.
// PAS de DOM, PAS de plugins Capacitor classiques (LocalNotifications etc.).
// Contraintes de survie : resolve() ou reject() DOIVENT être appelés dans
// tous les chemins, sinon l'OS tue la tâche (README du plugin).

// ——— Typage des globales fournies par le runtime du runner ———
declare const CapacitorKV: {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
};

type RunnerNotification = {
    id: number;
    title: string;
    body: string;
    largeBody?: string;
    summaryText?: string;
    channelId?: string;
    autoCancel?: boolean;
    extra?: Record<string, unknown>;
};

declare const CapacitorNotifications: {
    schedule(options: RunnerNotification[]): void;
};

// Le runner passe (resolve, reject, args) au handler — signature différente
// du addEventListener DOM typé par TS ; on caste une fois, localement.
const addRunnerListener = addEventListener as unknown as (
    event: string,
    handler: (
        resolve: () => void,
        reject: (error?: unknown) => void,
        args?: unknown,
    ) => void,
) => void;

// ——— Clés du KV (partagées avec l'app via dispatchEvent "provision"/"wipe") ———
const KV_DEVICE_KEY = "mdcp.deviceKey";
const KV_SINCE = "mdcp.since";
const KV_SERVER_URL = "mdcp.serverUrl";

// Serveur par défaut si l'app n'a pas provisionné l'origine (mise à jour du
// web distant ne suffit pas à la changer : ce fichier vit dans l'APK).
const DEFAULT_SERVER_URL = "https://mondocpro.vercel.app";

// ——— Identification de notification : hash 32 bits stable ———
// Identique à hashId() de src/lib/native.ts : le même id de notification
// serveur produit toujours le même entier (re-poster la même alerte met à
// jour l'entrée existante au lieu d'empiler des doublons).
function hashId(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
        h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 2_000_000_000;
}

type PollResponse = {
    notifications?: Array<{
        id: string;
        title: string;
        body: string;
        critical?: boolean;
        url?: string;
    }>;
    serverTime?: string;
};

// ——— Provisioning (appelé par l'APP, WebView actif) ———
// L'app injecte la clé d'appareil fraîchement émise (POST /api/native/device-
// key, auth par session) et l'origine du serveur. Le runner n'a ni cookie ni
// WebView : ce KV est sa SEULE source d'authentification.
addRunnerListener("provision", (resolve, reject, args) => {
    try {
        const details = (args ?? {}) as { deviceKey?: string; serverUrl?: string };
        if (details.deviceKey) {
            CapacitorKV.set(KV_DEVICE_KEY, details.deviceKey);
        }
        if (details.serverUrl) {
            CapacitorKV.set(KV_SERVER_URL, details.serverUrl);
        }
        // Curseur initial = maintenant : le poll ne livre que l'AVENIR (les
        // notifications antérieures restent visibles dans le panneau InApp).
        if (!CapacitorKV.get(KV_SINCE)) {
            CapacitorKV.set(KV_SINCE, new Date().toISOString());
        }
        resolve();
    } catch (error) {
        reject(error);
    }
});

// ——— Purge (appelé par l'APP à la déconnexion) ———
// La clé est révoquée côté serveur (/api/push/unregister) : on efface aussi
// la copie locale pour qu'aucune sonde ne parte avec un credential mort.
addRunnerListener("wipe", (resolve, reject) => {
    try {
        CapacitorKV.remove(KV_DEVICE_KEY);
        CapacitorKV.remove(KV_SINCE);
        CapacitorKV.remove(KV_SERVER_URL);
        resolve();
    } catch (error) {
        reject(error);
    }
});

// ——— Tâche périodique de l'OS (event configuré dans capacitor.config.ts) ———
addRunnerListener("onAppTick", (resolve, reject) => {
    void (async () => {
        try {
            const deviceKey = CapacitorKV.get(KV_DEVICE_KEY);
            if (!deviceKey) {
                // Aucune session provisionnée (jamais connecté, logout, ou
                // clé révoquée par un reset de mot de passe) — rien à faire.
                resolve();
                return;
            }

            const serverUrl =
                CapacitorKV.get(KV_SERVER_URL) || DEFAULT_SERVER_URL;
            const since = CapacitorKV.get(KV_SINCE) ?? "";

            const response = await fetch(
                `${serverUrl}/api/notifications/poll?since=${encodeURIComponent(since)}`,
                {
                    method: "GET",
                    headers: { Authorization: `Bearer ${deviceKey}` },
                },
            );

            // Clé révoquée/expirée : on purge le KV — l'app se reprovisionnera
            // à la prochaine ouverture (nouvelle session → nouvelle clé).
            if (response.status === 401 || response.status === 403) {
                CapacitorKV.remove(KV_DEVICE_KEY);
                CapacitorKV.remove(KV_SINCE);
                resolve();
                return;
            }
            if (!response.ok) {
                // Erreur serveur transitoire : le prochain tick réessaiera
                // avec le MÊME curseur (aucune alerte perdue).
                resolve();
                return;
            }

            // text() + JSON.parse : plus portable que response.json() dans un
            // polyfill fetch minimal (constat README : API fetch restreinte).
            const data = JSON.parse(await response.text()) as PollResponse;
            const items = (data.notifications ?? []).slice(0, 10);

            for (const item of items) {
                if (!item.title && !item.body) continue;
                CapacitorNotifications.schedule([
                    {
                        id: hashId(item.id),
                        title: item.title || "Mon doc Pro",
                        body: item.body,
                        largeBody: item.body,
                        summaryText: "Mon doc Pro",
                        channelId: item.critical ? "critical" : "updates",
                        autoCancel: true,
                        extra: { url: item.url ?? "/" },
                    },
                ]);
            }

            // Le curseur avance SEULEMENT si le tick a abouti : les alertes
            // arrivées pendant une panne réseau sont livrées au tick suivant.
            if (data.serverTime) {
                CapacitorKV.set(KV_SINCE, data.serverTime);
            }
            resolve();
        } catch (error) {
            // Réseau indisponible, JSON invalide… : l'OS relancera le tick.
            reject(error);
        }
    })();
});
