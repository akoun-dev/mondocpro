// DTO client-safe — Tableau de bord « Espace Médecin Chef » (accueil ADMIN).
// Tout est plat et sérialisable (modèle nurse-schemas.ts / admin-users-schemas
// .ts) : aucun Date, consommable tel quel par la vue et par les scripts d'audit.
import type { MissionStatus } from "@/lib/nurse-schemas";
import type { ZoneLoad } from "@/lib/admin-users-schemas";

/** Une journée de la série glissante — 14 jours glissants. */
export type AdminStatsDay = {
  /** Journée en UTC (Abidjan est UTC+0 sans heure d'été), format AAAA-MM-JJ. */
  date: string;
  /** Étiquette courte d'axe X (« 16/10 »). */
  label: string;
  /** Missions créées (affectées) ce jour-là. */
  missionsAssigned: number;
  /** Missions terminées (COMPLETED) ce jour-là. */
  missionsCompleted: number;
  /** Recharges confirmées ce jour-là — Tokens crédités. */
  rechargeTokens: number;
  /** Même recharge en FCFA (équivalent déclaré). */
  rechargeFcfa: number;
};

/** Répartition de TOUTES les missions par statut (cumul de tous les temps). */
export type AdminStatsStatusRow = {
  status: MissionStatus;
  label: string;
  count: number;
};

/** GET /api/admin/stats — un seul payload pour tout l'accueil du Médecin Chef. */
export type AdminStats = {
  /** Date d'agrégation (ISO) — affichée en pied de tableau de bord. */
  generatedAt: string;
  kpis: {
    /** RDV à domicile actifs encore sans mission (file d'attente). */
    toDispatch: number;
    /** Recharges PENDING en attente de rapprochement. */
    rechargesPending: number;
    /** Missions ASSIGNED / ACCEPTED / IN_PROGRESS (missions, pas d'effectif). */
    activeMissions: number;
    /** RDV planifiés aujourd'hui (UTC). */
    rdvToday: number;
    /** Infirmiers actifs / suspendus. */
    activeNurses: number;
    inactiveNurses: number;
    /** Patients actifs. */
    patients: number;
    /** Recharges confirmées sur 30 jours : Tokens puis équivalent FCFA. */
    tokensCredited30d: number;
    fcfaCredited30d: number;
    /** Missions terminées depuis le début du mois. */
    completedThisMonth: number;
  };
  /** Série glissante de 14 jours, croissante (du plus ancien à aujourd'hui). */
  days: AdminStatsDay[];
  /** Charge par zone — même source que la vue Équipes. */
  zones: ZoneLoad[];
  /** Répartition par statut (lignes à zéro retirées). */
  statuses: AdminStatsStatusRow[];
};
