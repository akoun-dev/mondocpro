// Services annuaire admin — FEATURE-ANNUAIRE-ADMIN
// Listes patients / infirmiers, dossier patient avec historique filtré, charge
// par infirmier et tableau de bord des équipes. Les routes API sont minces :
// tout le travail de lecture est ici, comme dans les autres services (nurse.ts,
// appointments.ts).
//
// Règle de sécurité transverse : aucune de ces fonctions n'autorise. Elles
// lisent et renvoient des DTO ; la suspension de compte passe par
// setAccountActive(), qui refuse de laisser un soignant sans mission active.
import { randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { hashPassword, invalidateUserSessions } from "@/lib/auth";
import { Prisma } from "@prisma/client";

import { ZONE_LABELS } from "@/lib/auth-schemas";
import { listDispatchQueue, listNurseMissions } from "@/lib/nurse";
import {
  periodStart,
  type AdminUserListQuery,
  type CreateNurseInput,
  type CreateNurseResult,
  type NurseDetail,
  type NurseLoadItem,
  type PatientConsultation,
  type PatientDetail,
  type PatientHistoryQuery,
  type PatientListItem,
  type PatientSummary,
  type TeamBoard,
  type ZoneLoad,
} from "@/lib/admin-users-schemas";

export class AdminUserError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// ——— Briques de filtre partagées ———

function accountWhere(
  role: "PATIENT" | "NURSE",
  query: AdminUserListQuery,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role };
  if (query.zone) where.zone = query.zone;
  if (query.status === "active") where.isActive = true;
  if (query.status === "inactive") where.isActive = false;
  if (query.search) {
    where.OR = [
      { fullName: { contains: query.search, mode: "insensitive" } },
      // Numéro saisi sans l'indicatif (+225) : on compare sur le suffixe.
      { phone: { contains: query.search.replace(/^\+/, "") } },
    ];
  }
  return where;
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// ——— Annuaire patients ———

/**
 * Liste des patients avec leurs compteurs d'en-tête.
 *
 * Les compteurs sortent de `groupBy` plutôt que d'un `include` par utilisateur :
 * Prisma refuse deux inclusions de la même relation avec des arguments
 * différents, or il faut « dernière visite réalisée » (DONE, desc) ET
 * « prochaine visite » (PENDING/CONFIRMED, asc) — deux tris opposés. Trois
 * agrégats coûtent moins qu'une jointure qui rapatrie tout l'historique.
 */
export async function listAdminPatients(
  query: AdminUserListQuery,
): Promise<PatientListItem[]> {
  const users = await db.user.findMany({
    where: accountWhere("PATIENT", query),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      zone: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
    },
  });

  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const now = new Date();
  const [byStatus, lastDone, nextUp] = await Promise.all([
    db.appointment.groupBy({
      by: ["patientId", "status"],
      where: { patientId: { in: ids } },
      _count: { _all: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: { patientId: { in: ids }, status: "DONE" },
      _max: { scheduledAt: true },
    }),
    db.appointment.groupBy({
      by: ["patientId"],
      where: {
        patientId: { in: ids },
        status: { in: ["PENDING", "CONFIRMED"] },
        scheduledAt: { gte: now },
      },
      _min: { scheduledAt: true },
    }),
  ]);

  const statusIndex = new Map<string, Record<string, number>>();
  for (const row of byStatus) {
    const entry = statusIndex.get(row.patientId) ?? {};
    entry[row.status] = row._count._all;
    statusIndex.set(row.patientId, entry);
  }
  const lastDoneIndex = new Map(lastDone.map((r) => [r.patientId, r._max.scheduledAt]));
  const nextUpIndex = new Map(nextUp.map((r) => [r.patientId, r._min.scheduledAt]));

  return users.map((user) => {
    const counts = statusIndex.get(user.id) ?? {};
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      zone: user.zone,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      doneCount: counts.DONE ?? 0,
      cancelledCount: counts.CANCELLED ?? 0,
      nextVisitAt: nextUpIndex.get(user.id)?.toISOString() ?? null,
      lastVisitAt: lastDoneIndex.get(user.id)?.toISOString() ?? null,
    };
  });
}

/**
 * Dossier patient : identité, compteurs globaux et historique filtré.
 *
 * Les compteurs de `summary` ignorent les filtres : ils décrivent le dossier,
 * pas la sélection courante. Filtrer « annulées » ne doit pas faire tomber le
 * total de consultations à zéro — le nombre afficherait alors « 0 » sous un
 * dossier qui en compte dix.
 */
export async function getAdminPatient(
  id: string,
  query: PatientHistoryQuery,
): Promise<PatientDetail> {
  const user = await db.user.findFirst({
    where: { id, role: "PATIENT" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      zone: true,
      birthDate: true,
      isActive: true,
      createdAt: true,
    },
  });
  if (!user) throw new AdminUserError(404, "Patient introuvable");

  const [statusCounts, typeCounts, lastDone, nextUp, appointments] =
    await Promise.all([
      db.appointment.groupBy({
        by: ["status"],
        where: { patientId: id },
        _count: { _all: true },
      }),
      db.appointment.groupBy({
        by: ["type"],
        where: { patientId: id },
        _count: { _all: true },
      }),
      db.appointment.groupBy({
        by: ["patientId"],
        where: { patientId: id, status: "DONE" },
        _max: { scheduledAt: true },
      }),
      db.appointment.groupBy({
        by: ["patientId"],
        where: {
          patientId: id,
          status: { in: ["PENDING", "CONFIRMED"] },
          scheduledAt: { gte: new Date() },
        },
        _min: { scheduledAt: true },
      }),
      db.appointment.findMany({
        where: historyWhere(id, query),
        orderBy: { scheduledAt: "desc" },
        take: 200,
        include: {
          specialty: { select: { name: true } },
          nurseMission: {
            select: {
              nurse: { select: { id: true, fullName: true, phone: true } },
              visitReport: {
                select: {
                  id: true,
                  observations: true,
                  actionsTaken: true,
                  recommendations: true,
                  vitalSigns: true,
                  createdAt: true,
                  nurse: { select: { fullName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

  const byStatus = Object.fromEntries(
    statusCounts.map((r) => [r.status, r._count._all]),
  ) as Record<string, number>;
  const now = new Date();
  const summary: PatientSummary = {
    total: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
    done: byStatus.DONE ?? 0,
    // Un RDV créé pour dans le futur peut être CANCELLED après coup ; « à
    // venir » se lit sur le statut ET sur la date, sinon le compteur ment.
    upcoming:
      (byStatus.PENDING ?? 0) +
      (byStatus.CONFIRMED ?? 0) -
      // Les RDV actifs déjà passés ne sont pas « à venir ».
      (await db.appointment.count({
        where: {
          patientId: id,
          status: { in: ["PENDING", "CONFIRMED"] },
          scheduledAt: { lt: now },
        },
      })),
    cancelled: byStatus.CANCELLED ?? 0,
    homeVisits:
      typeCounts.find((r) => r.type === "DOMICILE")?._count._all ?? 0,
  };

  const consultations: PatientConsultation[] = appointments.map((a) => {
    const report = a.nurseMission?.visitReport ?? null;
    return {
      id: a.id,
      scheduledAt: a.scheduledAt.toISOString(),
      status: a.status,
      type: a.type,
      zone: a.zone,
      specialtyName: a.specialty?.name ?? null,
      reason: a.reason,
      notes: a.notes,
      tokenState: a.tokenState,
      tokensReserved: a.tokensReserved,
      cancelledAt: a.cancelledAt ? a.cancelledAt.toISOString() : null,
      nurse: a.nurseMission
        ? {
            id: a.nurseMission.nurse.id,
            fullName: a.nurseMission.nurse.fullName,
            phone: a.nurseMission.nurse.phone,
          }
        : null,
      report: report
        ? {
            id: report.id,
            nurseName: report.nurse.fullName,
            observations: report.observations,
            actionsTaken: report.actionsTaken,
            recommendations: report.recommendations,
            vitalSigns: report.vitalSigns,
            createdAt: report.createdAt.toISOString(),
          }
        : null,
    };
  });

  return {
    patient: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      zone: user.zone,
      birthDate: user.birthDate ? user.birthDate.toISOString() : null,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      doneCount: summary.done,
      cancelledCount: summary.cancelled,
      nextVisitAt: nextUp[0]?._min.scheduledAt?.toISOString() ?? null,
      lastVisitAt: lastDone[0]?._max.scheduledAt?.toISOString() ?? null,
    },
    summary,
    consultations,
  };
}

/** Restreint l'historique : période + statut + zone. */
function historyWhere(
  patientId: string,
  query: PatientHistoryQuery,
): Prisma.AppointmentWhereInput {
  const where: Prisma.AppointmentWhereInput = { patientId };

  const from = periodStart(query.period);
  if (from) where.scheduledAt = { gte: from };
  if (query.zone) where.zone = query.zone;

  const now = new Date();
  switch (query.status) {
    case "done":
      where.status = "DONE";
      break;
    case "cancelled":
      where.status = "CANCELLED";
      break;
    case "upcoming":
      where.status = { in: ["PENDING", "CONFIRMED"] };
      where.scheduledAt = { ...(where.scheduledAt as object), gte: now };
      break;
    default:
      break;
  }
  return where;
}

// ——— Annuaire infirmiers + charge ———

/** Missions « actives » : affectée, acceptée ou en cours. */
const ACTIVE_MISSION_STATUSES = ["ASSIGNED", "ACCEPTED", "IN_PROGRESS"] as const;

/**
 * Charge par infirmier — une requête d'utilisateurs, trois agrégats de
 * missions. Les compteurs servent la vue Équipes (répartition) ET la vue
 * Infirmiers (fiche individuelle).
 */
export async function listAdminNurseLoads(
  query: AdminUserListQuery,
): Promise<NurseLoadItem[]> {
  const users = await db.user.findMany({
    where: accountWhere("NURSE", query),
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      phone: true,
      zone: true,
      isActive: true,
      createdAt: true,
    },
  });

  const ids = users.map((u) => u.id);
  if (ids.length === 0) return [];

  const monthStart = startOfCurrentMonth();
  const [byStatus, lastMission, completedThisMonth] = await Promise.all([
    db.nurseMission.groupBy({
      by: ["nurseId", "status"],
      where: { nurseId: { in: ids } },
      _count: { _all: true },
    }),
    db.nurseMission.groupBy({
      by: ["nurseId"],
      where: { nurseId: { in: ids } },
      _max: { assignedAt: true },
    }),
    db.nurseMission.groupBy({
      by: ["nurseId"],
      where: {
        nurseId: { in: ids },
        status: "COMPLETED",
        completedAt: { gte: monthStart },
      },
      _count: { _all: true },
    }),
  ]);

  const statusIndex = new Map<string, Record<string, number>>();
  for (const row of byStatus) {
    const entry = statusIndex.get(row.nurseId) ?? {};
    entry[row.status] = row._count._all;
    statusIndex.set(row.nurseId, entry);
  }
  const lastIndex = new Map(
    lastMission.map((r) => [r.nurseId, r._max.assignedAt]),
  );
  const monthIndex = new Map(
    completedThisMonth.map((r) => [r.nurseId, r._count._all]),
  );

  return users.map((user) => {
    const counts = statusIndex.get(user.id) ?? {};
    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      zone: user.zone,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      activeMissions: ACTIVE_MISSION_STATUSES.reduce(
        (sum, status) => sum + (counts[status] ?? 0),
        0,
      ),
      pendingAcceptance: counts.ASSIGNED ?? 0,
      completedThisMonth: monthIndex.get(user.id) ?? 0,
      completedTotal: counts.COMPLETED ?? 0,
      lastMissionAt: lastIndex.get(user.id)?.toISOString() ?? null,
    };
  });
}

/** Fiche infirmier : charge + missions récentes (même DTO que la vue infirmier). */
export async function getAdminNurse(id: string): Promise<NurseDetail> {
  const nurse = (await listAdminNurseLoads({ status: "all" })).find(
    (n) => n.id === id,
  );
  if (!nurse) throw new AdminUserError(404, "Infirmier introuvable");

  return { nurse, missions: await listNurseMissions(id) };
}

// ——— Création d'un compte infirmier (demande PO 2026-10) ———

/**
 * Alphabet sans caractères ambigus (pas de 0/O, 1/l/I) : le mot de passe
 * temporaire est dicté par téléphone — un « O » lu comme « 0 » suffirait à
 * bloquer la première connexion de l'infirmier.
 */
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 10): string {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return password;
}

/**
 * Crée un compte NURSE actif — le workflow complet d'onboarding tient en trois
 * temps gérés ici : identité + zone saisies par le Médecin Chef, mot de passe
 * choisi OU généré (renvoyé une seule fois, seul le bcrypt est stocké), compte
 * immédiatement connectable (isActive par défaut) et visible dans l'annuaire
 * comme affectable par le dispatch — aucun parcours intermédiaire.
 *
 * Le rôle est forcé côté serveur : même convention que POST /api/auth/register
 * (aucune confiance aux données client). Le numéro est l'identité métier, sa
 * singularité est vérifiée avant création puis garantie par l'unicité SQL
 * (course P2002 interceptée de la même façon).
 */
export async function createAdminNurse(
  input: CreateNurseInput,
): Promise<CreateNurseResult> {
  // Mot de passe vide/absent = génération côté serveur — le Médecin Chef ne
  // choisit PAS toujours la valeur, il peut déléguer la robustesse à l'app.
  const manualPassword =
    input.password && input.password.length > 0 ? input.password : null;
  const generatedPassword = manualPassword ? null : generateTemporaryPassword();

  const existing = await db.user.findUnique({
    where: { phone: input.phone },
    select: { id: true },
  });
  if (existing) {
    throw new AdminUserError(
      409,
      "Ce numéro est déjà inscrit — un compte existe déjà avec ce téléphone",
    );
  }

  try {
    const user = await db.user.create({
      data: {
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: await hashPassword(manualPassword ?? generatedPassword!),
        role: "NURSE" as const,
        zone: input.zone,
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        zone: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      nurse: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        zone: user.zone,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      generatedPassword,
    };
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002" // course entre findUnique et create (unicité phone)
    ) {
      throw new AdminUserError(
        409,
        "Ce numéro est déjà inscrit — un compte existe déjà avec ce téléphone",
      );
    }
    throw e;
  }
}

// ——— Vue Équipes : supervision + dispatch ———

/**
 * Tableau de bord des équipes.
 *
 * La file d'affectation vient de `listDispatchQueue()` — la même source que
 * GET /api/admin/missions, pour que la vue Équipes et le dispatch de la vue
 * Missions ne puissent pas diverger sur « ce qui reste à affecter ».
 */
export async function getAdminTeamBoard(): Promise<TeamBoard> {
  const [nurses, queue] = await Promise.all([
    listAdminNurseLoads({ status: "all" }),
    listDispatchQueue(),
  ]);

  const zoneLoad: ZoneLoad[] = Object.keys(ZONE_LABELS).map((zone) => {
    const zoneNurses = nurses.filter((n) => n.zone === zone && n.isActive);
    return {
      zone,
      label: ZONE_LABELS[zone as keyof typeof ZONE_LABELS],
      activeMissions: nurses
        .filter((n) => n.zone === zone)
        .reduce((sum, n) => sum + n.activeMissions, 0),
      unassigned: queue.filter((q) => q.zone === zone).length,
      activeNurses: zoneNurses.length,
    };
  });

  return {
    nurses,
    queue,
    zoneLoad,
    totals: {
      activeNurses: nurses.filter((n) => n.isActive).length,
      inactiveNurses: nurses.filter((n) => !n.isActive).length,
      activeMissions: nurses.reduce((sum, n) => sum + n.activeMissions, 0),
      unassigned: queue.length,
      completedThisMonth: nurses.reduce(
        (sum, n) => sum + n.completedThisMonth,
        0,
      ),
    },
  };
}

// ——— Suspension / réactivation d'un compte ———

/**
 * Bascule l'état d'un compte.
 *
 * Trois refus, chacun pour une raison de sûreté opérationnelle :
 * - on ne se suspend pas soi-même (verrouillage du service) ;
 * - un compte ADMIN est intouchable (pas de second véhicule de verrouillage,
 *   l'admin est seedé — voir ROLES dans auth-schemas.ts) ;
 * - un infirmier ne peut pas quitter l'effectif avec des missions en cours :
 *   il faut d'abord réaffecter (PATCH /api/admin/missions/[id]), sinon le
 *   patient n'a plus d'intervenant et la mission reste bloquée « À traiter ».
 */
export async function setAccountActive(
  actorId: string,
  targetId: string,
  isActive: boolean,
): Promise<{ fullName: string; isActive: boolean }> {
  if (actorId === targetId) {
    throw new AdminUserError(
      400,
      "Vous ne pouvez pas suspendre votre propre compte",
    );
  }

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { id: true, fullName: true, role: true, isActive: true },
  });
  if (!target) throw new AdminUserError(404, "Compte introuvable");

  if (target.role === "ADMIN") {
    throw new AdminUserError(
      403,
      "Le compte administrateur ne peut pas être suspendu",
    );
  }

  if (!isActive && target.role === "NURSE") {
    const open = await db.nurseMission.count({
      where: {
        nurseId: target.id,
        status: { in: [...ACTIVE_MISSION_STATUSES] },
      },
    });
    if (open > 0) {
      throw new AdminUserError(
        409,
        `${target.fullName} a encore ${open} mission(s) en cours — réaffectez-les avant de le suspendre`,
      );
    }
  }

  await db.user.update({
    where: { id: target.id },
    data: { isActive },
    select: { fullName: true, isActive: true },
  });

  // Suspension : on coupe les sessions et les jetons de notification dans la
  // foulée. getCurrentUser() purge déjà à la prochaine requête, mais un
  // appareil sous Android peut rester suspendu des heures avant de revenir
  // interroger l'API — il doit perdre ses notifications sans attendre.
  // Réactivation : on ne touche à rien, le compte reprend ses accès au
  // prochain login normal.
  if (!isActive) {
    await invalidateUserSessions(target.id);
  }

  return { fullName: target.fullName, isActive };
}