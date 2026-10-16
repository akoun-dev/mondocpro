// Agrégats du tableau de bord « Espace Médecin Chef » — source UNIQUE des
// indicateurs de l'accueil ADMIN (GET /api/admin/stats).
// Server only (importe db) : les séries par jour sont recomposées ici pour ne
// jamais renvoyer des lignes brutes à un client qui les additionnerait (même
// formule que lib/nurse.ts : une source, un rendu).
//
// Journée = UTC, Abidjan est UTC+0 sans heure d'été : la clé « jour » du
// serveur et celle affichée au patient sont donc les memes.
import { db } from "@/lib/db";
import { getAdminTeamBoard } from "@/lib/admin-users";
import {
  MISSION_STATUS_LABELS,
  type MissionStatus,
} from "@/lib/nurse-schemas";
import type {
  AdminStats,
  AdminStatsDay,
  AdminStatsStatusRow,
} from "@/lib/admin-stats-schemas";

const DAY_MS = 86_400_000;
/** Fenêtre glissante des graphiques : 14 jours, aujourd'hui compris. */
const SERIES_DAYS = 14;
/** Fenêtre des KPIs « crédités ». */
const CREDIT_WINDOW_MS = 30 * DAY_MS;

const ACTIVE_MISSION_STATUSES: MissionStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
];

function startOfUtcDay(now: Date): Date {
  const day = new Date(now.getTime());
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** « 16/10 » — étiquette d'axe X, lisible à 14 barres empilées. */
function dayAxisLabel(key: string): string {
  const [, month, day] = key.split("-");
  return `${day}/${month}`;
}

export async function getAdminStats(): Promise<AdminStats> {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const windowStart = new Date(todayStart.getTime() - (SERIES_DAYS - 1) * DAY_MS);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  const creditStart = new Date(now.getTime() - CREDIT_WINDOW_MS);

  const [
    team,
    missionWindow,
    missionStatusRows,
    activeMissions,
    rechargeWindow,
    recharge30d,
    rechargesPending,
    patients,
    rdvToday,
  ] = await Promise.all([
    // File + charge par zone + effectifs — même source que la vue Équipes.
    getAdminTeamBoard(),
    // Fenêtre 14 jours : une ligne suffit pour alimenter les deux séries
    // (affectée le jour J, terminée le jour J+n ⇒ la ligne matche les deux).
    db.nurseMission.findMany({
      where: {
        OR: [
          { assignedAt: { gte: windowStart } },
          { completedAt: { gte: windowStart } },
        ],
      },
      select: { assignedAt: true, completedAt: true },
    }),
    db.nurseMission.groupBy({ by: ["status"], _count: { _all: true } }),
    db.nurseMission.count({
      where: { status: { in: ACTIVE_MISSION_STATUSES } },
    }),
    db.tokenTransaction.findMany({
      where: {
        type: "RECHARGE",
        status: "CONFIRMED",
        createdAt: { gte: windowStart },
      },
      select: { createdAt: true, tokens: true, amountFcfa: true },
    }),
    db.tokenTransaction.aggregate({
      where: {
        type: "RECHARGE",
        status: "CONFIRMED",
        createdAt: { gte: creditStart },
      },
      _sum: { tokens: true, amountFcfa: true },
    }),
    db.tokenTransaction.count({
      where: { type: "RECHARGE", status: "PENDING" },
    }),
    db.user.count({ where: { role: "PATIENT", isActive: true } }),
    db.appointment.count({
      where: { scheduledAt: { gte: todayStart, lt: tomorrowStart } },
    }),
  ]);

  // Série : on pré-fabrique les journées vides pour que les jours sans
  // activité s'affichent (un trou se lit comme une panne du service).
  const byDay = new Map<string, AdminStatsDay>();
  for (let index = 0; index < SERIES_DAYS; index += 1) {
    const date = new Date(windowStart.getTime() + index * DAY_MS);
    const key = dayKey(date);
    byDay.set(key, {
      date: key,
      label: dayAxisLabel(key),
      missionsAssigned: 0,
      missionsCompleted: 0,
      rechargeTokens: 0,
      rechargeFcfa: 0,
    });
  }

  for (const mission of missionWindow) {
    const assigned = byDay.get(dayKey(mission.assignedAt));
    if (assigned) assigned.missionsAssigned += 1;
    if (mission.completedAt) {
      const completed = byDay.get(dayKey(mission.completedAt));
      if (completed) completed.missionsCompleted += 1;
    }
  }

  for (const recharge of rechargeWindow) {
    const bucket = byDay.get(dayKey(recharge.createdAt));
    if (!bucket) continue;
    bucket.rechargeTokens += recharge.tokens;
    bucket.rechargeFcfa += recharge.amountFcfa ?? 0;
  }

  const days = [...byDay.values()];

  // Répartition par statut : ordre stable du vocabulaire métier, lignes vides
  // retirées (« 0 Annulée » n'aide personne à décider).
  const statusCount = new Map<MissionStatus, number>(
    missionStatusRows.map(row => [row.status, row._count._all]),
  );
  const statuses: AdminStatsStatusRow[] = Object.keys(MISSION_STATUS_LABELS)
    .map(status => status as MissionStatus)
    .filter(status => (statusCount.get(status) ?? 0) > 0)
    .map(status => ({
      status,
      label: MISSION_STATUS_LABELS[status],
      count: statusCount.get(status) ?? 0,
    }));

  return {
    generatedAt: now.toISOString(),
    kpis: {
      toDispatch: team.queue.length,
      rechargesPending,
      activeMissions,
      rdvToday,
      activeNurses: team.totals.activeNurses,
      inactiveNurses: team.totals.inactiveNurses,
      patients,
      tokensCredited30d: recharge30d._sum.tokens ?? 0,
      fcfaCredited30d: recharge30d._sum.amountFcfa ?? 0,
      completedThisMonth: team.totals.completedThisMonth,
    },
    days,
    zones: team.zoneLoad,
    statuses,
  };
}
