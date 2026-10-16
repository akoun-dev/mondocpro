// Types du tableau de bord Médecin Chef — GET /api/admin/overview
// (FEATURE-ADMIN-DASHBOARD). Fichier CLIENT-SAFE (aucun import db) : les
// mêmes types servent au sérialiseur serveur (lib/admin-overview.ts) et à
// la vue (components/admin/admin-home-view.tsx) — source unique du contrat.
import type { MissionDto } from "@/lib/nurse-schemas";

// ——— KPI de tête — une valeur par pilier opérationnel du Médecin Chef ———
export type AdminOverviewKpis = {
  patientsTotal: number;
  patientsActive: number;
  nursesTotal: number;
  nursesActive: number;
  // Missions non terminées (ASSIGNED + ACCEPTED + IN_PROGRESS).
  missionsActive: number;
  // RDV à domicile actifs sans mission (file de dispatch).
  toDispatch: number;
  // Recharges de Tokens PENDING (décision de rapprochement attendue).
  rechargesPending: number;
  // Somme FCFA des recharges en attente (montants déclarés).
  rechargesPendingFcfa: number;
  // RDV PENDING/CONFIRMED du jour (cabinet + domicile).
  appointmentsToday: number;
};

// Bucket journalier des visites terminées — 7 jours glissants, jour courant
// inclus. `date` = AAAA-MM-JJ (UTC, Afrique/Abidjan = UTC+0) ; `label` =
// jour court fr-FR (« lun. ») prêt à afficher.
export type AdminDayBucket = {
  date: string;
  label: string;
  count: number;
};

// Répartition par zone des missions actives — les 4 zones sont TOUJOURS
// présentes (count 0 visible) pour comparer les territoires d'un coup d'œil.
// `queue` = demandes à domicile de la zone en attente d'affectation.
export type AdminZoneStat = {
  zone: "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE";
  active: number;
  queue: number;
};

// Recharge PENDING (aperçu) — le décisionnaire complet vit dans la vue
// Recharges ; ici seulement l'essentiel pour agir ou trier.
export type AdminPendingRecharge = {
  id: string;
  patientName: string;
  patientPhone: string;
  tokens: number;
  amountFcfa: number;
  createdAt: string;
};

// Visite à domicile à affecter (aperçu de la file, tri croissant créneau).
export type AdminUpcomingVisit = {
  id: string;
  patientName: string;
  zone: "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE";
  scheduledAt: string;
  specialtyName: string | null;
};

export type AdminOverview = {
  kpis: AdminOverviewKpis;
  completedByDay: AdminDayBucket[];
  activeByZone: AdminZoneStat[];
  // 5 dernières missions créées (tous statuts) — reuse du MissionDto du
  // board dispatch (champs aplatis scheduledAt/zone/type, fix BUG-003).
  recentMissions: MissionDto[];
  pendingRecharges: AdminPendingRecharge[];
  upcomingVisits: AdminUpcomingVisit[];
  // Horodatage de la photosynthèse (ISO) — affiché « Actualisé à … ».
  generatedAt: string;
};
