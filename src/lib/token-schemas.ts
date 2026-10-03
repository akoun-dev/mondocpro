// Schémas + constantes FEATURE-TOKENS (ADR-007) — CLIENT-SAFE (aucun import
// serveur) : partagés par les routes API, le portefeuille patient et le
// wizard de réservation (affichage du coût avant confirmation).
import { z } from "zod";
import { APPOINTMENT_TYPES, type AppointmentTypeValue } from "@/lib/appointment-schemas";

// ——— Économie du portefeuille (document de présentation Mon doc Pro) ———
// 1 Token = 2 500 FCFA · 10 000 FCFA = 4 Tokens.
export const TOKEN_VALUE_FCFA = 2500;

// Presets de recharge proposés au patient (dialog « Recharger »).
export const RECHARGE_PRESETS_FCFA = [2500, 5000, 10000, 25000] as const;

// Plafond anti-fraude MVP d'une recharge déclarée (200 Tokens).
export const RECHARGE_MAX_FCFA = 500_000;

// ——— Grille tarifaire (FEATURE-TOKENS, ADR-007) — CONFIGURABLE PAR L'ADMIN ———
// Depuis la demande PO 2026-10-03, les tarifs ne sont plus codés en dur :
// ils vivent en base (table tariff_configs, une ligne par poste) et sont
// édités par le Médecin Chef depuis son dashboard (vue « Tarifs »).
// Cette constante ne sert PLUS que de :
//   1. source des seeds initiaux (migration + live-apply + ensureTariffConfigs),
//   2. FALLBACK de lecture si une ligne manque en base (auto-réparation).
// Coût d'un RDV = tarif lu en base au moment de la demande, FIGÉ ensuite dans
// appointments.tokensReserved : changer un tarif ne vaut que pour les
// demandes à venir, jamais pour les réservations engagées.
export const DEFAULT_TARIFFS: Record<AppointmentTypeValue, number> = {
  CABINET: 1,
  DOMICILE: 1,
};

// Clés métier de la grille v1 (une clé = une ligne tariff_configs). Une
// évolution (frais patient absent, majoration nuit/week-end…) = un INSERT
// de clé en base, SANS migration — le design est déjà prévu pour.
export const TARIFF_KEYS = [
  "CONSULTATION_CABINET",
  "CONSULTATION_DOMICILE",
] as const;
export type TariffKey = (typeof TARIFF_KEYS)[number];

// Clé métier d'un poste tarifaire de consultation.
export function tariffKeyForType(type: AppointmentTypeValue): TariffKey {
  return `CONSULTATION_${type}` as TariffKey;
}

// Libellés FR affichés au Médecin Chef (vue Tarifs) et dérivables des
// réponses API — source unique ici (client-safe).
export const TARIFF_LABELS: Record<TariffKey, string> = {
  CONSULTATION_CABINET: "Consultation au cabinet",
  CONSULTATION_DOMICILE: "Consultation à domicile",
};

// Descriptions d'aide à la décision (vue Tarifs).
export const TARIFF_DESCRIPTIONS: Record<TariffKey, string> = {
  CONSULTATION_CABINET:
    "Consultation au centre de santé de la zone — appliqué à toutes les spécialités",
  CONSULTATION_DOMICILE:
    "Un soignant se déplace au domicile du patient",
};

// Garde-fou anti-erreur de saisie : un tarif v1 reste dans 0..100 Tokens
// (0 = consultation gratuite, choix explicite de l'ADMIN ; 100 = 250 000 FCFA).
export const TARIFF_MAX_TOKENS = 100;

// DTO d'une ligne de la grille (GET /api/tariffs, GET /api/admin/tariffs,
// PATCH /api/admin/tariffs/:key).
export type TariffDto = {
  key: TariffKey;
  label: string;
  description: string;
  tokens: number;
  updatedAt: string;
  updatedByName: string | null;
};

// PATCH /api/admin/tariffs/:key — nouveau prix en Tokens d'un poste.
export const tariffUpdateSchema = z.object({
  tokens: z
    .number({ message: "Prix invalide" })
    .int("Le prix doit être un nombre entier de Tokens")
    .min(0, "Le prix ne peut pas être négatif")
    .max(
      TARIFF_MAX_TOKENS,
      `Le prix ne peut pas dépasser ${TARIFF_MAX_TOKENS} Tokens`,
    ),
});
export type TariffUpdateInput = z.infer<typeof tariffUpdateSchema>;

export function tokensToFcfa(tokens: number): number {
  return tokens * TOKEN_VALUE_FCFA;
}

// Convertit un montant FCFA en Tokens (entier — la route API refuse tout
// montant qui n'est pas un multiple exact de la valeur du Token).
export function fcfaToTokens(fcfa: number): number {
  return fcfa / TOKEN_VALUE_FCFA;
}

// ——— Contrats API ———

// POST /api/wallet/recharges — le patient déclare une recharge.
export const rechargeRequestSchema = z.object({
  amountFcfa: z
    .number({ message: "Montant invalide" })
    .int("Montant invalide")
    .positive("Montant invalide")
    .max(RECHARGE_MAX_FCFA, `Le montant ne peut pas dépasser ${RECHARGE_MAX_FCFA.toLocaleString("fr-FR")} FCFA`)
    .refine(
      value => value % TOKEN_VALUE_FCFA === 0,
      `Le montant doit être un multiple de ${TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA (1 Token)`,
    ),
});
export type RechargeRequestInput = z.infer<typeof rechargeRequestSchema>;

// PATCH /api/admin/recharges/:id — décision du Médecin Chef.
export const rechargeDecisionSchema = z.object({
  decision: z.enum(["CONFIRM", "REJECT"], {
    message: "Décision invalide",
  }),
  note: z
    .string()
    .trim()
    .max(300, "La note ne peut pas dépasser 300 caractères")
    .optional(),
});
export type RechargeDecisionInput = z.infer<typeof rechargeDecisionSchema>;

// ——— Libellés français (UI portefeuille + historique) ———
export const TOKEN_TYPE_LABELS: Record<string, string> = {
  RECHARGE: "Recharge",
  RESERVATION: "Réservation RDV",
  CONSUMPTION: "Consommation RDV",
  RELEASE: "Libération RDV",
  REFUND: "Remboursement",
  ADJUSTMENT: "Ajustement",
};

export const TOKEN_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  REJECTED: "Refusée",
};
