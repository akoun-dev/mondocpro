// Service Tableau de bord Médecin Chef — FEATURE-ADMIN-DASHBOARD (server
// only, importe db). Une seule requête HTTP agrège ~10 comptes/groupBys
// BON MARCHÉ (aucun rapatriement d'historique complet) pour alimenter les
// cartes KPI, le graphique 7 jours et les trois files d'action.
//
// Convention horaire : Afrique/Abidjan = UTC+0 sans heure d'été — les bornes
// de journée locale SONT les bornes UTC (même convention que reminders.ts et
// schedule.ts). Les buckets du graphique sont donc découpés sur l'UTC.
import { db } from "@/lib/db";
import { serializeMission } from "@/lib/nurse";
import { listDispatchQueue } from "@/lib/nurse";
import type {
    AdminOverview,
    AdminPendingRecharge,
    AdminZoneStat,
    AdminUpcomingVisit,
} from "@/lib/admin-overview-schemas";
import { ZONES } from "@/lib/auth-schemas";

const ACTIVE_MISSION_STATUSES = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] as const;

// 00:00 UTC du jour (=> minuit local Abidjan).
function startOfUtcDay(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
}

export async function getAdminOverview(): Promise<AdminOverview> {
    const now = new Date();
    const todayStart = startOfUtcDay(now);
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
    // 6 jours avant aujourd'hui — le bucket « aujourd'hui » complète les 7.
    const weekStart = new Date(todayStart.getTime() - 6 * 86_400_000);

    const [
        usersByRoleAndStatus,
        missionsByStatus,
        dispatchQueueCount,
        dispatchQueueByZone,
        appointmentsTodayCount,
        completedInRange,
        activeMissionsZones,
        rechargesPendingRows,
        rechargesPendingAgg,
        recentMissionRows,
        dispatchQueueRows,
    ] = await Promise.all([
        // Compteurs patients / infirmiers, actifs vs suspendus (isActive).
        db.user.groupBy({
            by: ["role", "isActive"],
            where: { role: { in: ["PATIENT", "NURSE"] } },
            _count: { _all: true },
        }),
        // Répartition des missions par statut (missions actives = somme).
        db.nurseMission.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
        // File de dispatch GLOBALE (source unique listDispatchQueue —
        // même définition que les vues Équipes / Missions).
        db.appointment.count({
            where: {
                type: "DOMICILE",
                status: { in: ["PENDING", "CONFIRMED"] },
                nurseMission: { is: null },
            },
        }),
        // File de dispatch PAR ZONE — même garde, agrégée.
        db.appointment.groupBy({
            by: ["zone"],
            where: {
                type: "DOMICILE",
                status: { in: ["PENDING", "CONFIRMED"] },
                nurseMission: { is: null },
            },
            _count: { _all: true },
        }),
        // RDV du jour (cabinet + domicile), demandes vivantes uniquement.
        db.appointment.count({
            where: {
                scheduledAt: { gte: todayStart, lt: tomorrowStart },
                status: { in: ["PENDING", "CONFIRMED"] },
            },
        }),
        // Visites terminées sur la fenêtre — bucketed en JS (groupBy Prisma
        // ne découpe pas sur une expression de date).
        db.nurseMission.findMany({
            where: {
                status: "COMPLETED",
                completedAt: { gte: weekStart, lt: tomorrowStart },
            },
            select: { completedAt: true },
        }),
        // Zones des missions actives (petite table — lecture légère).
        db.nurseMission.findMany({
            where: { status: { in: [...ACTIVE_MISSION_STATUSES] } },
            select: { appointment: { select: { zone: true } } },
        }),
        // Aperçu des recharges PENDING (les 5 plus anciennes — même ordre
        // que la vue Recharges : la file se traite du plus ancien au plus
        // récent).
        db.tokenTransaction.findMany({
            where: { type: "RECHARGE", status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 5,
            include: { user: { select: { fullName: true, phone: true } } },
        }),
        // Total file + somme FCFA déclarée (cards KPI).
        db.tokenTransaction.aggregate({
            where: { type: "RECHARGE", status: "PENDING" },
            _count: { _all: true },
            _sum: { amountFcfa: true },
        }),
        // 5 dernières missions (tous statuts) — DTO du board, champs aplatis.
        db.nurseMission.findMany({
            orderBy: { assignedAt: "desc" },
            take: 5,
            include: {
                nurse: {
                    select: { id: true, fullName: true, phone: true, zone: true },
                },
                patient: {
                    select: { id: true, fullName: true, phone: true, zone: true },
                },
                appointment: {
                    select: {
                        scheduledAt: true,
                        type: true,
                        zone: true,
                        reason: true,
                        specialty: { select: { name: true } },
                    },
                },
                visitReport: {
                    select: {
                        id: true,
                        observations: true,
                        actionsTaken: true,
                        recommendations: true,
                        vitalSigns: true,
                        createdAt: true,
                    },
                },
            },
        }),
        // Aperçu de la file à affecter (4 prochains créneaux).
        listDispatchQueue(),
    ]);

    // ——— Assemblage ———

    const roleCount = (role: "PATIENT" | "NURSE", active: boolean): number =>
        usersByRoleAndStatus
            .filter(r => r.role === role && r.isActive === active)
            .reduce((sum, r) => sum + r._count._all, 0);

    const missionCount = (...statuses: string[]): number =>
        missionsByStatus
            .filter(r => statuses.includes(r.status))
            .reduce((sum, r) => sum + r._count._all, 0);

    // Buckets 7 jours : l'index 0 = il y a 6 jours, l'index 6 = aujourd'hui.
    const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
    const completedByDay = Array.from({ length: 7 }, (_, index) => {
        const dayStart = new Date(weekStart.getTime() + index * 86_400_000);
        const dayEnd = new Date(dayStart.getTime() + 86_400_000);
        const count = completedInRange.filter(
            row =>
                row.completedAt !== null &&
                row.completedAt >= dayStart &&
                row.completedAt < dayEnd,
        ).length;
        return {
            date: dayStart.toISOString().slice(0, 10),
            label: dayFormat.format(dayStart).replace(".", ""),
            count,
        };
    });

    const queueByZone = new Map(
        dispatchQueueByZone.map(row => [row.zone, row._count._all]),
    );
    const activeByZone = Object.values(ZONES).map(zone => ({
        zone,
        active: activeMissionsZones.filter(
            row => row.appointment.zone === zone,
        ).length,
        queue: queueByZone.get(zone) ?? 0,
    })) satisfies AdminZoneStat[];

    const pendingRecharges: AdminPendingRecharge[] = rechargesPendingRows.map(
        row => ({
            id: row.id,
            patientName: row.user.fullName,
            patientPhone: row.user.phone,
            tokens: row.tokens,
            // Nullable au niveau Prisma (transactions non-recharge) mais
            // toujours renseigné pour une RECHARGE — 0 par prudence.
            amountFcfa: row.amountFcfa ?? 0,
            createdAt: row.createdAt.toISOString(),
        }),
    );

    const upcomingVisits: AdminUpcomingVisit[] = dispatchQueueRows
        .slice(0, 4)
        .map(row => ({
            id: row.id,
            patientName: row.patientName,
            zone: row.zone,
            scheduledAt: row.scheduledAt,
            specialtyName: row.specialtyName,
        }));

    return {
        kpis: {
            patientsTotal: roleCount("PATIENT", true) + roleCount("PATIENT", false),
            patientsActive: roleCount("PATIENT", true),
            nursesTotal: roleCount("NURSE", true) + roleCount("NURSE", false),
            nursesActive: roleCount("NURSE", true),
            missionsActive: missionCount(...ACTIVE_MISSION_STATUSES),
            toDispatch: dispatchQueueCount,
            rechargesPending: rechargesPendingAgg._count._all,
            rechargesPendingFcfa: rechargesPendingAgg._sum.amountFcfa ?? 0,
            appointmentsToday: appointmentsTodayCount,
        },
        completedByDay,
        activeByZone,
        recentMissions: recentMissionRows.map(row => serializeMission(row)),
        pendingRecharges,
        upcomingVisits,
        generatedAt: now.toISOString(),
    };
}
