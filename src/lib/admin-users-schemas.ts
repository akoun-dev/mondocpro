// DTO + schémas de validation — FEATURE-ANNUAIRE-ADMIN
// Annuaire Patients / Infirmiers et supervision des équipes, côté Médecin Chef.
//
// Tout est client-safe (aucun Date, aucun passwordHash) : ces types sont
// consommés par les vues admin comme par les scripts d'audit, sur le modèle de
// nurse-schemas.ts. Les services qui les produisent vivent dans
// `src/lib/admin-users.ts`.
import { z } from "zod";

import { ZONES } from "@/lib/auth-schemas";
import { ZONE_LABELS } from "@/lib/auth-schemas";
import { MISSION_STATUS_LABELS } from "@/lib/nurse-schemas";

export { ZONE_LABELS, MISSION_STATUS_LABELS };

// ——— Filtres de liste ———

/** Tri de l'annuaire patients. `inactive` isole les comptes suspendus. */
export const ACCOUNT_FILTER = ["all", "active", "inactive"] as const;
export const ACCOUNT_PERIOD = ["all", "30d", "90d", "1y"] as const;

/** Valeur du filtre d'état de compte (`all` par défaut). */
export type AccountFilterValue = (typeof ACCOUNT_FILTER)[number];
/** Valeur du filtre de période (`all` par défaut). */
export type AccountPeriodValue = (typeof ACCOUNT_PERIOD)[number];
/** Valeur du filtre de statut d'une consultation. */
export type HistoryStatusValue = "all" | "done" | "upcoming" | "cancelled";

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(80).optional(),
  zone: z.enum(ZONES).optional(),
  status: z.enum(ACCOUNT_FILTER).default("all"),
});

/**
 * Filtres de l'historique de consultation (demande : période + statut).
 * `all` sur les deux = dossier complet, le cas par défaut d'un dossier vide.
 */
export const patientHistoryQuerySchema = z.object({
  period: z.enum(ACCOUNT_PERIOD).default("all"),
  status: z
    .enum(["all", "done", "upcoming", "cancelled"])
    .default("all"),
  zone: z.enum(ZONES).optional(),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type PatientHistoryQuery = z.infer<typeof patientHistoryQuerySchema>;

// ——— Création d'un infirmier (demande PO 2026-10) ———
// Règles de champ définies une seule fois dans auth-schemas.ts (registerBase) ;
// re-exporté ici pour que les routes admin gardent une seule source d'import.
export { createNurseSchema, type CreateNurseInput } from "@/lib/auth-schemas";

/**
 * Réponse POST /api/admin/nurses.
 * `generatedPassword` n'est présent que si le Médecin Chef a laissé le mot de
 * passe vide : il est affiché UNE fois à la création, jamais réversible ensuite
 * (seul le bcrypt est stocké).
 */
export type CreatedNurse = {
  id: string;
  fullName: string;
  phone: string;
  zone: string;
  isActive: boolean;
  createdAt: string;
};

export type CreateNurseResult = {
  nurse: CreatedNurse;
  generatedPassword: string | null;
};

/** PATCH /api/admin/users/[id] — activation / désactivation d'un compte. */
export const updateAccountActiveSchema = z.object({
  isActive: z.boolean(),
});

export type UpdateAccountActiveInput = z.infer<typeof updateAccountActiveSchema>;

// ——— Annuaire patients ———

/**
 * Ligne de l'annuaire patients. Les compteurs servent au tri et à la lecture
 * rapide ; ils sont recalculés à chaque requête (pas de cache — un annuaire
 * périméoussé est pire qu'un annuaire lent).
 */
export type PatientListItem = {
  id: string;
  fullName: string;
  phone: string;
  zone: string;
  birthDate: string | null;
  isActive: boolean;
  createdAt: string;
  /** Consultations réalisées (RDV DONE) — toutes zones confondues. */
  doneCount: number;
  /** Annulées — utile pour repérer un dossier qui ne produit rien. */
  cancelledCount: number;
  /** Prochain RDV PENDING/CONFIRMED, sinon null. */
  nextVisitAt: string | null;
  lastVisitAt: string | null;
};

/** Compteurs d'en-tête du dossier, affichés au-dessus de l'historique. */
export type PatientSummary = {
  total: number;
  done: number;
  upcoming: number;
  cancelled: number;
  /** RDV à domicile ayant donné lieu à une mission. */
  homeVisits: number;
};

/** Une consultation dans l'historique, compte rendu de visite inclus. */
export type PatientConsultation = {
  id: string;
  scheduledAt: string;
  status: string;
  type: string;
  zone: string;
  specialtyName: string | null;
  reason: string | null;
  notes: string | null;
  tokenState: string;
  tokensReserved: number;
  cancelledAt: string | null;
  /** Infirmier affecté si visite à domicile, sinon null (RDV au cabinet). */
  nurse: { id: string; fullName: string; phone: string } | null;
  report: {
    id: string;
    nurseName: string;
    observations: string;
    actionsTaken: string | null;
    recommendations: string | null;
    vitalSigns: unknown;
    createdAt: string;
  } | null;
};

/** GET /api/admin/patients/[id] */
export type PatientDetail = {
  patient: PatientListItem;
  summary: PatientSummary;
  /** Ordonné du plus récent au plus ancien. */
  consultations: PatientConsultation[];
};

// ——— Annuaire infirmiers ———

/**
 * Charge d'un infirmier — le cœur de la vue « Équipes ».
 * `pendingAcceptance` est l'indicateur de supervision : une mission affectée
 * que l'infirmier n'a pas acceptée signale un effectif qui ne suit pas.
 */
export type NurseLoadItem = {
  id: string;
  fullName: string;
  phone: string;
  zone: string;
  isActive: boolean;
  createdAt: string;
  /** Missions ASSIGNED / ACCEPTED / IN_PROGRESS. */
  activeMissions: number;
  /** Missions ASSIGNED en attente d'acceptation. */
  pendingAcceptance: number;
  /** Missions terminées le mois en cours. */
  completedThisMonth: number;
  completedTotal: number;
  lastMissionAt: string | null;
};

/** GET /api/admin/nurses/[id] */
export type NurseDetail = {
  nurse: NurseLoadItem;
  /** Missions de l'infirmier, plus récentes d'abord (MissionDto). */
  missions: import("@/lib/nurse-schemas").MissionDto[];
};

/** Répartition par zone — où la charge ne suit pas la demande. */
export type ZoneLoad = {
  zone: string;
  label: string;
  activeMissions: number;
  unassigned: number;
  activeNurses: number;
};

/** GET /api/admin/teams — supervision + dispatch. */
export type TeamBoard = {
  nurses: NurseLoadItem[];
  /** File « à affecter » : RDV à domicile actifs sans infirmier. */
  queue: import("@/lib/nurse-schemas").DispatchQueueItem[];
  zoneLoad: ZoneLoad[];
  totals: {
    activeNurses: number;
    inactiveNurses: number;
    activeMissions: number;
    unassigned: number;
    completedThisMonth: number;
  };
};

// ——— Libellés des filtres (partagés vues + scripts) ———

export const ACCOUNT_FILTER_LABELS: Record<
  (typeof ACCOUNT_FILTER)[number],
  string
> = {
  all: "Tous",
  active: "Actifs",
  inactive: "Suspendus",
};

export const ACCOUNT_PERIOD_LABELS: Record<
  (typeof ACCOUNT_PERIOD)[number],
  string
> = {
  all: "Tout l'historique",
  "30d": "30 derniers jours",
  "90d": "90 derniers jours",
  "1y": "12 derniers mois",
};

export const HISTORY_STATUS_LABELS: Record<
  "all" | "done" | "upcoming" | "cancelled",
  string
> = {
  all: "Tous les statuts",
  done: "Terminées",
  upcoming: "À venir",
  cancelled: "Annulées",
};

/** Classe de badge du statut de consultation (miroir du vocabulaire UI). */
export const HISTORY_STATUS_CLASSES: Record<string, string> = {
  DONE: "bg-success/15 text-success-foreground",
  CONFIRMED: "bg-primary/10 text-primary",
  PENDING: "bg-warning/20 text-warning-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
};

export const HISTORY_STATUS_SHORT: Record<string, string> = {
  DONE: "Terminée",
  CONFIRMED: "Confirmée",
  PENDING: "En attente",
  CANCELLED: "Annulée",
};

export const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  CABINET: "Cabinet",
  DOMICILE: "Domicile",
};

/**
 * Traduit `period` en borne basse. `all` = pas de borne.
 * Fenêtre glissante depuis maintenant — un RDV passé de « à venir » à
 * « terminé » bascule donc de catégorie sans intervention.
 */
export function periodStart(period: (typeof ACCOUNT_PERIOD)[number]): Date | null {
  const days =
    period === "30d" ? 30 : period === "90d" ? 90 : period === "1y" ? 365 : null;
  if (days === null) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}