// Fixture E2E « Rappels de rendez-vous » (Task 23) — crée un RDV dû pour le
// patient de test afin d'exercer le scheduler (POST /api/cron/reminders), ou
// nettoie les RDV de test. Le canal SMS est au stade stub (décision A10
// ouverte) : le passage dans le stub console EST la preuve d'envoi en E2E.
// Usage : bun scripts/reminder-fixture.ts create|create-pending|clean
//   create          — RDV CONFIRMED dû dans 23 h (fenêtre 24 h), opt-in forcé
//   create-pending  — idem mais PENDING (non confirmé → ne doit PAS être rappelé)
//   clean           — supprime les RDV de test (motif préfixé E2E-RAPPEL)
// NB : les téléphones sont stockés au format international (+225…) — la
// recherche se fait par suffixe pour rester robuste au format.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PHONE_SUFFIX = "0709229992"; // patient de test
const REASON_PREFIX = "E2E-RAPPEL";

async function main() {
  const mode = process.argv[2] ?? "create";
  const patient = await db.user.findFirst({
    where: { phone: { endsWith: PHONE_SUFFIX } },
  });
  if (!patient) throw new Error(`Patient fixture introuvable (${PHONE_SUFFIX})`);

  if (mode === "clean") {
    // Task 24 : les rappels créent aussi une notification InApp (entityId =
    // appointmentId, pas de FK) — purgée explicitement avec les RDV de test
    // pour ne pas laisser de notifications « fantômes » dans la base.
    const e2eAppointments = await db.appointment.findMany({
      where: { patientId: patient.id, reason: { startsWith: REASON_PREFIX } },
      select: { id: true },
    });
    const ids = e2eAppointments.map((a) => a.id);
    const notifDeleted = ids.length
      ? await db.notification.deleteMany({ where: { entityId: { in: ids } } })
      : { count: 0 };
    const deleted = await db.appointment.deleteMany({
      where: { patientId: patient.id, reason: { startsWith: REASON_PREFIX } },
    });
    console.log(
      `cleaned=${deleted.count} notifications=${notifDeleted.count}`,
    );
    return;
  }

  if (mode !== "create" && mode !== "create-pending") {
    throw new Error(`Mode inconnu: ${mode}`);
  }

  // NB : le fixture ne touche PAS à appointmentReminders — l'opt-in/out est
  // géré explicitement par la suite E2E (PATCH profil) pour que le scénario
  // « patient opt-out jamais rappelé » soit un vrai test et pas une tautologie.
  // RDV dû dans 23 h, à la minute ronde. CONFIRMED seulement pour le mode
  // create : un RDV PENDING n'est pas encore confirmé par l'équipe → jamais
  // rappelé.
  const scheduledAt = new Date(Date.now() + 23 * 60 * 60 * 1000);
  scheduledAt.setSeconds(0, 0);
  const appointment = await db.appointment.create({
    data: {
      patientId: patient.id,
      type: "CABINET",
      zone: patient.zone,
      scheduledAt,
      status: mode === "create" ? "CONFIRMED" : "PENDING",
      reason: `${REASON_PREFIX} consultation de test (${mode})`,
    },
  });
  console.log(
    `created=${appointment.id} status=${appointment.status} scheduledAt=${appointment.scheduledAt.toISOString()}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
