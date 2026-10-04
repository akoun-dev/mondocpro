// Pipeline « Rappels de rendez-vous » — FEATURE-RDV · périmètre PO 2026-10-03 :
// UNIQUEMENT des rappels AVANT les RDV (fenêtre 24 h), canal SMS.
// La passerelle SMS n'est pas encore choisie (décision A10 OUVERTE) : le
// transport est donc une interface provider-agnostic avec un stub console —
// même philosophie que le placeholder SMS du flux mot de passe oublié.
// Brancher le vrai fournisseur quand A10 sera tranchée = implémenter
// `SmsGateway` et retourner l'instance dans `getSmsGateway()` (1 seul fichier).
// Anti-doublon : chaque envoi réussi marque `Appointment.reminderSentAt` ; un
// RDV déjà marqué n'est jamais repris par un tick suivant.
import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";

// Préavis du rappel : envoyé quand le RDV commence dans moins de 24 h.
export const REMINDER_LEAD_HOURS = 24;

// Plafond par tick : le scheduler relancera au tick suivant (idempotent grâce
// au marquage reminderSentAt).
const BATCH_LIMIT = 100;

export type SmsGateway = {
  // Identifiant lisible, renvoyé dans les résumés d'exécution (observabilité).
  name: string;
  send(input: { to: string; body: string }): Promise<{ providerId: string | null }>;
};

// Stub en attendant la décision A10 : journalise le SMS côté serveur (preuve
// E2E observables dans les logs) sans dépendance externe. Aucun SMS réel n'est
// émis, aucun coût opérateur.
const consoleStubGateway: SmsGateway = {
  name: "console-stub (A10 ouverte)",
  async send({ to, body }) {
    console.info(`[SMS:stub] → ${to} : ${body}`);
    return { providerId: null };
  },
};

export function getSmsGateway(): SmsGateway {
  return consoleStubGateway;
}

// Rendez-vous DUS : confirmés, commençant dans la fenêtre [maintenant, +24 h],
// patient opt-in (User.appointmentReminders), rappel pas encore envoyé.
// Exclus d'office : RDV passés, PENDING (non confirmés par l'équipe),
// CANCELLED, DONE — « rappels (uniquement) avant les RDV ».
export async function selectDueAppointments(now: Date = new Date()) {
  const horizon = new Date(now.getTime() + REMINDER_LEAD_HOURS * 60 * 60 * 1000);
  return db.appointment.findMany({
    where: {
      status: "CONFIRMED",
      scheduledAt: { gte: now, lte: horizon },
      reminderSentAt: null,
      patient: { appointmentReminders: true },
    },
    include: {
      patient: { select: { phone: true, fullName: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_LIMIT,
  });
}

// Message SMS (≤ 160 caractères), français — Afrique/Abidjan = UTC+0 : l'heure
// affichée est l'heure locale du patient, identique à l'heure UTC stockée.
export function buildReminderMessage(appointment: {
  type: "CABINET" | "DOMICILE";
  scheduledAt: Date;
}): string {
  const typeLabel = appointment.type === "DOMICILE" ? "à domicile" : "au cabinet";
  const slot = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(appointment.scheduledAt);
  return `Mon doc Pro : rappel de votre RDV ${typeLabel} le ${slot}. Merci d'arriver à l'heure.`;
}

export type ReminderDispatch = {
  appointmentId: string;
  ok: boolean;
  error?: string;
};

export type RemindersSummary = {
  gateway: string;
  due: number;
  sent: number;
  failed: number;
  results: ReminderDispatch[];
};

// Copie InApp du rappel (Task 24) — pas de contrainte 160 c. (canal in-app),
// même contenu que le SMS sans le préfixe « Mon doc Pro : » redondant dans
// l'app. Le titre porte l'intention, le corps porte le créneau.
export function buildReminderNotification(appointment: {
  type: "CABINET" | "DOMICILE";
  scheduledAt: Date;
}): { title: string; body: string } {
  const typeLabel = appointment.type === "DOMICILE" ? "à domicile" : "au cabinet";
  const slot = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Abidjan",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(appointment.scheduledAt);
  return {
    title: "Rappel de rendez-vous",
    body: `Votre RDV ${typeLabel} est prévu le ${slot}. Merci d'arriver à l'heure.`,
  };
}

// Un tick du scheduler : sélection → notification InApp → envoi (gateway) →
// marquage reminderSentAt.
// Ordre volontaire : la notification InApp est créée AVANT l'envoi SMS —
// le canal in-app (interne, jamais en panne) ne doit pas dépendre du succès
// de la passerelle (A10 ouverte). L'upsert est idempotent via l'index unique
// (userId, type, entityId) : si le SMS échoue et que le RDV est repris au
// tick suivant, aucune notification dupliquée n'est créée. Un envoi en échec
// N'EST PAS marqué → retenté naturellement au tick suivant ; la boucle est
// séquentielle pour ne pas saturer la passerelle (MVP).
export async function processDueReminders(
  now: Date = new Date(),
): Promise<RemindersSummary> {
  const gateway = getSmsGateway();
  const due = await selectDueAppointments(now);
  const results: ReminderDispatch[] = [];
  for (const appointment of due) {
    try {
      // 1. Canal InApp — actif dès aujourd'hui (Task 24), anti-doublon via
      // @@unique(userId, type, entityId) ; update {} = no-op si déjà créée.
      const notification = buildReminderNotification(appointment);
      await db.notification.upsert({
        where: {
          userId_type_entityId: {
            userId: appointment.patientId,
            type: "APPOINTMENT_REMINDER",
            entityId: appointment.id,
          },
        },
        create: {
          userId: appointment.patientId,
          type: "APPOINTMENT_REMINDER",
          title: notification.title,
          body: notification.body,
          entityId: appointment.id,
        },
        update: {},
      });
      // 2. Canal SMS — stub console tant que la décision A10 est ouverte.
      await gateway.send({
        to: appointment.patient.phone,
        body: buildReminderMessage(appointment),
      });
      await db.appointment.update({
        where: { id: appointment.id },
        data: { reminderSentAt: now },
      });
      // 3. Canal push natif (Task 36) — jumelle de la notification InApp :
      // l'appareil Capacitor reçoit la rappel même app fermée. Fire-and-forget,
      // jamais compté dans le succès du tick (canal best-effort).
      void sendPushToUsers([appointment.patientId], {
        title: notification.title,
        body: notification.body,
        type: "APPOINTMENT_REMINDER",
        entityId: appointment.id,
      });
      results.push({ appointmentId: appointment.id, ok: true });
    } catch (error) {
      console.error("[reminders] échec d'envoi:", error);
      results.push({
        appointmentId: appointment.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    gateway: gateway.name,
    due: due.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
