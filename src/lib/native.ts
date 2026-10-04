// FEATURE-PUSH (Task 36) — Pont natif Capacitor côté client.
// Un seul module pour TOUT le comportement natif de l'APK : splash, barre de
// statut, bouton retour Android, push FCM, rappels locaux de RDV, réseau et
// retours haptiques. Dans un navigateur classique (isNative() === false)
// chaque fonction est un no-op silencieux — un seul code source web/native.
//
// Architecture « WebView distante » (ADR-007) : le pont natif window.Capacitor
// est injecté par le WebView dans les pages chargées depuis server.url ;
// les plugins JS ci-dessous se connectent automatiquement à ce pont.
import { Capacitor } from "@capacitor/core";
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
}

// ——— Push FCM ———

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

// Flux complet d'enregistrement push : permission → listeners → register().
// Le jeton arrive via l'événement « registration » puis est envoyé au serveur
// (POST /api/push/register) qui le lie au compte courant. Idempotent :
// l'app re-registre à chaque ouverture/reprise (le token FCM peut tourner et
// l'appareil peut avoir changé de compte).
export async function registerPush(): Promise<void> {
    if (!isNative()) return;
    try {
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

            // 2. Échec d'enregistrement FCM (souvent google-services.json absent).
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
            await PushNotifications.addListener(
                "pushNotificationActionPerformed",
                (action) => {
                    const data = action.notification.data as
                        | { url?: string }
                        | undefined;
                    navigate(data?.url ?? "/");
                },
            );

            // 5. Tap sur un rappel LOCAL de RDV → vue Rendez-vous.
            await LocalNotifications.addListener(
                "localNotificationActionPerformed",
                (action) => {
                    const extra = action.notification.extra as
                        | { url?: string }
                        | undefined;
                    navigate(extra?.url ?? "/?tab=rdv");
                },
            );
        }

        await PushNotifications.register();
    } catch (error) {
        // Souvent : Firebase non initialisé (google-services.json absent du
        // build) — l'app reste 100 % fonctionnelle, le canal push est off.
        console.warn("[native] registerPush:", error);
    }
}

// Déconnexion : révoque le jeton FCM de CET appareil côté serveur (le push
// ne suit plus l'ancien compte) puis efface la copie locale.
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
