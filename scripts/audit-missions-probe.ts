// Sonde d'audit runtime — FEATURE-NURSE (2026-10-03).
// Vérifie que le client Prisma généré gère réellement les relations
// NurseMission/VisitReport (schéma contenant une coquille ligne 318 :
// `fields: issionId]` — parser tolérant ? réponse empirique ci-dessous).
// Usage : bun scripts/audit-missions-probe.ts
import { db } from "../src/lib/db";

async function main() {
    console.log("[1] listNurseMissions-like : findMany + include complet");
    const rows = await db.nurseMission.findMany({
        orderBy: { assignedAt: "desc" },
        include: {
            nurse: { select: { id: true, fullName: true, phone: true, zone: true } },
            patient: { select: { id: true, fullName: true, phone: true, zone: true } },
            appointment: { select: { scheduledAt: true, type: true, zone: true, reason: true } },
            visitReport: { select: { id: true, observations: true } },
        },
        take: 5,
    });
    console.log(`    OK — ${rows.length} mission(s) en base`);

    console.log("[2] VisitReport.findMany (relation inverse via mission)");
    const reports = await db.visitReport.findMany({ include: { mission: true }, take: 5 });
    console.log(`    OK — ${reports.length} compte(s)-rendu(s) en base`);

    console.log("[3] Notification.createMany (types enums ajoutés) — tx annulée");
    const anyUser = await db.user.findFirst({ select: { id: true } });
    if (!anyUser) throw new Error("Aucun utilisateur en base pour la sonde");
    // Pas d'insertion définitive : on vérifie que l'enum NotificationType
    // étendu est accepté côté DB, puis on annule la transaction.
    await db.$transaction(async (tx) => {
        await tx.notification.createMany({
            data: [
                {
                    userId: anyUser.id,
                    type: "MISSION_ASSIGNED",
                    title: "audit",
                    body: "audit",
                    entityId: "audit",
                },
            ],
        });
        throw new Error("ROLLBACK_INTENTIONNEL");
    }).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("ROLLBACK_INTENTIONNEL")) {
            console.log("    OK — enum MISSION_ASSIGNED accepté (tx annulée, rien écrit)");
        } else {
            throw e;
        }
    });

    console.log("AUDIT_PROBE_TOUT_OK");
}

main()
    .catch((e) => {
        console.error("AUDIT_PROBE_ECHEC:", e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
