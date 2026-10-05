// FEATURE-PUSH / FEATURE-LOCALES — Pont natif Capacitor côté client.
// Un seul module pour TOUT le comportement natif de l'APK : splash, barre de
// statut, bouton retour Android, notifications (locales + push), réseau et
// retours haptiques. Dans un navigateur classique (isNative() === false)
// chaque fonction est un no-op silencieux — un seul code source web/native.
//
// Architecture « WebView distante » (ADR-007) : le pont natif window.Capacitor
// est injecté par le WebView dans les pages chargées depuis server.url ;
// les plugins JS ci-dessous se connectent automatiquement à ce pont.
//
// Décision ADR-009 (2026-10-05) — AUCUN projet Firebase :
//  - Canaux PRIMAIRES = notifications InApp (panneau, badge) + notifications
//    LOCALES (rappels RDV H-24/H-1, mise en avant des InApp) — zéro config.
//  - Le plugin @capacitor/push-notifications reste embarqué (il porte ses
//    bibliothèques Firebase, sans compte ni google-services.json requis) mais
//    le canal push DISTANT reste DORMANT : sans projet Firebase configuré, la
//    garde ci-dessous ne l'active jamais — zéro crash, zéro appel inutile.
//    Ré-activation possible un jour = config Firebase + revert de la partie
//    serveur (voir ADR-009) — aucun changement de ce fichier.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { Haptics, NotificationType, ImpactStyle } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

// ——— Détection ———

/** Vrai uniquement dans l'APK natif (WebView Capacitor). */
export function isNative(): boolean {
    return Capacitor.isNativePlatform();
}

// ——— Splash & barre de statut ———

// launchAutoHide: false dans capacitor.config.ts → le splash est masqué ici,
// une fois l'app web montée (pas de flash blanc ni de splash figé).
export async function hideSplash(): Promise<void> {
    if (!isNative()) return;
    try {
        await SplashScreen.hide({ fadeOutDuration: 350 });
    } catch {
        // no-op — jamais critique
    }
}

export async function styleStatusBar(): Promise<void> {
    if (!isNative()) return;
    try {
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#ffffff" });
    } catch {
        // certaines versions Android ne supportent pas setBackgroundColor
    }
}

// ——— Réseau (bandeau hors-ligne) ———

// Écoute l'état réseau natif et diffuse « mondocpro:network » sur window
// (CustomEvent<boolean> — true = connecté). Le bandeau UI est rendu par
// NativeBootstrap qui s'abonne à cet événement.
export async function listenNetwork(): Promise<void> {
    if (!isNative()) return;
    try {
        await Network.addListener("networkStatusChange", (status) => {
            window.dispatchEvent(
                new CustomEvent("mondocpro:network", { detail: status.connected }),
            );
        });
    } catch {
        // no-op
    }
}

// ——— Bouton retour Android ———

// Historique dispo → retour ; sinon on quitte proprement (pas d'écran figé).
// Limitation MVP documentée (ADR-007) : les dialogs Radix n'empilent pas
// l'historique — le retour système remonte la navigation, pas la modale.
export async function listenBackButton(): Promise<void> {
    if (!isNative()) return;
    try {
        await App.addListener("backButton", () => {
            if (window.history.length > 1) {
                window.history.back();
            } else {
                void App.exitApp();
            }
        });
    } catch {
        // no-op
    }
}

// ——— Initialisation du shell ———

export function initNativeShell(): void {
    if (!isNative()) return;
    // Le splash reste ≥ 1,2 s (temps de premier rendu web) puis s'efface.
    window.setTimeout(() => void hideSplash(), 1200);
    void styleStatusBar();
    void listenNetwork();
    void listenBackButton();
    initLocalNotificationTap();
}

// Tap sur une notification LOCALE (rappel RDV, mise en avant InApp) → lien
// profond. Enregistré UNE fois au boot du shell — indépendant du canal push
// distant (avant ce fix, le listener n'existait que si Firebase était
// configuré : le tap sur un rappel ne naviguait pas sans Firebase).
let localTapListenerRegistered = false;

function initLocalNotificationTap(): void {
    if (!isNative() || localTapListenerRegistered) return;
    localTapListenerRegistered = true;
    void LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (action) => {
            const extra = action.notification.extra as
                | { url?: string }
                | undefined;
            navigate(extra?.url ?? "/?tab=rdv");
        },
    );
}

// ——— Garde du canal push distant (dormant sans Firebase — ADR-009) ———

// Garde anti-crash (Task 38) : le plugin push natif 8.x appelle
// FirebaseMessaging.getInstance() SANS vérifier que Firebase est initialisé.
// Sur un build sans google-services.json (FirebaseInitProvider inactif),
// register() lève une IllegalStateException que le bridge Capacitor
// re-propage en RuntimeException non interceptée → l'app se ferme au moment
// où l'utilisateur accepte la permission notifications. Le plugin natif
// local « Diagnostics » (DiagnosticsPlugin.java, APK ≥ v2) teste la
// disponibilité Firebase par réflexion ; sur un APK plus ancien il n'existe
// pas → l'appel échoue → on considère le push distant indisponible (jamais
// de register() = jamais de crash). Les notifications InApp et les rappels
// LOCAUX restent 100 % fonctionnels sans Firebase.
const Diagnostics = registerPlugin<{
    firebaseAvailable: () => Promise<{ available: boolean; reason: string }>;
}>("Diagnostics");

let pushCapability: Promise<boolean> | null = null;

async function isPushCapable(): Promise<boolean> {
    if (pushCapability === null) {
        pushCapability = (async () => {
            try {
                const { available } = await Diagnostics.firebaseAvailable();
                return available;
            } catch {
                // APK v1 sans plugin Diagnostics : register() y est garanti
                // crash → canal push bloqué préventivement.
                return false;
            }
        })();
    }
    return pushCapability;
}

const PUSH_TOKEN_KEY = "push.fcm.token";

async function deviceName(): Promise<string | null> {
    try {
        const info = await Device.getInfo();
        return `${info.manufacturer ?? ""} ${info.model ?? ""}`.trim() || null;
    } catch {
        return null;
    }
}

async function appVersion(): Promise<string | null> {
    try {
        const info = await App.getInfo();
        return info.version ?? null;
    } catch {
        return null;
    }
}

function platformName(): "android" | "ios" | "web" {
    const p = Capacitor.getPlatform();
    return p === "android" || p === "ios" ? p : "web";
}

// Hash déterministe d'une string → id de notification locale (< 2^31).
// Stable : le même appointmentId produit le même id (annulation possible).
function hashId(value: string): number {
    let h = 0;
    for (let i = 0; i < value.length; i++) {
        h = (Math.imul(31, h) + value.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % 2_000_000_000;
}

function navigate(url: string): void {
    // location.assign (rechargement complet) plutôt que router.push : la
    // session est revérifiée côté serveur et le dashboard monte avec le
    // ?tab= voulu — robuste même depuis un état React inconnu (app fermée).
    window.location.assign(url.startsWith("/") ? url : "/");
}

let pushListenersRegistered = false;

// Flux d'initialisation des notifications au démarrage de session :
//  1. PERMISSION NOTIFICATIONS (Android 13+) — demandée via LocalNotifications
//     (même permission OS POST_NOTIFICATIONS que le plugin push) : elle couvre
//     rappels RDV ET, le cas échéant, les push. Demander ici (et non via le
//     plugin push) garantit que la demande reste utile SANS Firebase.
//  2. Canal push DISTANT — activé UNIQUEMENT si Firebase est initialisé dans
//     le process (garde isPushCapable). Sans projet Firebase (décision
//     ADR-009) : dormant, aucun register(), aucun jeton envoyé au serveur.
// Idempotent : rejoué à chaque ouverture/reprise (permission déjà accordée =
// retour immédiat sans dialogue).
export async function registerPush(): Promise<void> {
    if (!isNative()) return;
    try {
        // 1. Permission notifications — nécessaire aux rappels locaux même
        // sans Firebase ; sur Android 13+ déclenche le dialogue système une
        // seule fois (déjà accordée → retour immédiat).
        const localPermission = (await LocalNotifications.checkPermissions())
            .display;
        if (localPermission === "prompt") {
            await LocalNotifications.requestPermissions();
        }

        // 2. Canal push distant — DORMANT sans projet Firebase (ADR-009) :
        // jamais de dialogue ni de register() tant que Firebase n'est pas
        // initialisé dans le process.
        if (!(await isPushCapable())) {
            console.info(
                "[native] canal push distant dormant (aucun projet Firebase — décision ADR-009) : notifications InApp + rappels locaux actifs",
            );
            return;
        }

        let permission = (await PushNotifications.checkPermissions()).receive;
        if (permission === "prompt") {
            permission = (await PushNotifications.requestPermissions()).receive;
        }
        if (permission !== "granted") {
            console.info("[native] permission notifications refusée");
            return;
        }

        if (!pushListenersRegistered) {
            pushListenersRegistered = true;

            // 1. Jeton reçu → enregistrement serveur + persistance locale.
            await PushNotifications.addListener("registration", async (token) => {
                try {
                    const res = await fetch("/api/push/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            token: token.value,
                            platform: platformName(),
                            deviceName: await deviceName(),
                            appVersion: await appVersion(),
                        }),
                    });
                    if (res.ok) {
                        await Preferences.set({
                            key: PUSH_TOKEN_KEY,
                            value: token.value,
                        });
                    }
                } catch (error) {
                    console.warn("[native] /api/push/register:", error);
                }
            });

            // 2. Échec d'enregistrement FCM (canal distant non configuré).
            await PushNotifications.addListener("registrationError", (error) => {
                console.warn("[native] registration FCM:", error);
            });

            // 3. Push reçue app OUVERTE : Android n'affiche pas les push FCM au
            // premier plan → notification locale immédiate + refresh du badge.
            await PushNotifications.addListener(
                "pushNotificationReceived",
                async (notification) => {
                    window.dispatchEvent(
                        new Event("mondocpro:notifications-changed"),
                    );
                    const data = notification.data as { url?: string } | undefined;
                    try {
                        await LocalNotifications.schedule({
                            notifications: [
                                {
                                    id: hashId(notification.id),
                                    title: notification.title ?? "Mon doc Pro",
                                    body: notification.body ?? "",
                                    schedule: { at: new Date(Date.now() + 250) },
                                    extra: { url: data?.url ?? "/" },
                                },
                            ],
                        });
                    } catch {
                        // pas bloquant — le fil InApp reste à jour
                    }
                },
            );

            // 4. Tap sur une push (app en arrière-plan) → lien profond data.url.
            //    (Le tap sur une notification LOCALE est géré par
            //    initLocalNotificationTap — enregistré au boot du shell.)
            await PushNotifications.addListener(
                "pushNotificationActionPerformed",
                (action) => {
                    const data = action.notification.data as
                        | { url?: string }
                        | undefined;
                    navigate(data?.url ?? "/");
                },
            );
        }

        await PushNotifications.register();
    } catch (error) {
        //Firebase absent du process (décision ADR-009) → déjà filtré par la
        // garde ; toute autre erreur laisse l'app 100 % fonctionnelle.
        console.warn("[native] registerPush:", error);
    }
}

// Déconnexion : révoque le jeton FCM de CET appareil côté serveur (le push
// ne suit plus l'ancien compte) puis efface la copie locale. No-op complet
// tant que le canal distant est dormant (aucun jeton stocké — ADR-009).
export async function unregisterPush(): Promise<void> {
    if (!isNative()) return;
    try {
        const { value } = await Preferences.get({ key: PUSH_TOKEN_KEY });
        if (!value) return;
        await fetch("/api/push/unregister", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: value }),
        });
        await Preferences.remove({ key: PUSH_TOKEN_KEY });
    } catch {
        // best-effort — la déconnexion ne doit jamais échouer pour autant
    }
}

// ——— Rappels LOCAUX de rendez-vous (complément serveur, Task 36) ———
// Planifiés côté appareil à la réservation : H-24 et H-1. Marchent même sans
// Firebase et sans réseau au moment de la notification. Miroir client de
// buildReminderNotification (lib/reminders, server-only) — même formulation.

export type AppointmentReminderInput = {
    id: string;
    type: "CABINET" | "DOMICILE";
    /** ISO string (scheduledAt du DTO). */
    scheduledAt: string;
    /** Préférence utilisateur (User.appointmentReminders). */
    enabled: boolean;
};

function appointmentReminderIds(appointmentId: string): number[] {
    return [hashId(`${appointmentId}:j24`), hashId(`${appointmentId}:h1`)];
}

function formatSlot(date: Date): string {
    return new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Africa/Abidjan",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export async function scheduleAppointmentReminders(
    input: AppointmentReminderInput,
): Promise<void> {
    if (!isNative() || !input.enabled) return;
    try {
        const scheduledAt = new Date(input.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) return;
        const typeLabel = input.type === "DOMICILE" ? "à domicile" : "au cabinet";
        const slot = formatSlot(scheduledAt);
        const body = `Votre RDV ${typeLabel} est prévu le ${slot}. Merci d'arriver à l'heure.`;

        const leadTimesMs = [24 * 3_600_000, 1 * 3_600_000];
        const [idJ24, idH1] = appointmentReminderIds(input.id);
        const notifications = leadTimesMs
            .map((lead, index) => ({
                at: new Date(scheduledAt.getTime() - lead),
                id: index === 0 ? idJ24 : idH1,
            }))
            .filter(({ at }) => at.getTime() > Date.now() + 60_000)
            .map(({ at, id }) => ({
                id,
                title: "Rappel de rendez-vous",
                body,
                schedule: { at, allowWhileIdle: true },
                extra: { url: "/?tab=rdv" },
            }));

        if (notifications.length === 0) return;
        await LocalNotifications.schedule({ notifications });
    } catch (error) {
        console.warn("[native] scheduleAppointmentReminders:", error);
    }
}

// Annulation (RDV annulé par le patient ou l'équipe) : on retire les deux
// rappels planifiés. Idempotent — annuler une notification non planifiée
// est un no-op Android.
export async function cancelAppointmentReminders(
    appointmentId: string,
): Promise<void> {
    if (!isNative()) return;
    try {
        const [idJ24, idH1] = appointmentReminderIds(appointmentId);
        await LocalNotifications.cancel({
            notifications: [{ id: idJ24 }, { id: idH1 }],
        });
    } catch {
        // no-op
    }
}

// ——— Haptique ———

/** Retour haptique « succès » (RDV réservé, recharge déclarée…). */
export async function hapticSuccess(): Promise<void> {
    if (!isNative()) return;
    try {
        await Haptics.notification({ type: NotificationType.Success });
    } catch {
        // no-op
    }
}

/** Petit impact tactile (sélections marquantes). */
export async function hapticLight(): Promise<void> {
    if (!isNative()) return;
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
        // no-op
    }
}
