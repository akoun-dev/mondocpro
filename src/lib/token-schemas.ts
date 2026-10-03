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

// ——— Tarifs PROVISONNELS (ADR-007 §tarifs — décision PO ouverte) ———
// Le document de présentation fixe la valeur du Token mais PAS la grille
// tarifaire (« À définir — à valider par le porteur du projet »). En attendant
// cet arbitrage, l'exemple du document (consultation à domicile = 1 Token)
// est retenu comme tarif de travail pour les DEUX types de consultation.
// → Toute évolution se fait ICI (source unique front/back).
export const PROVISIONAL_TARIFFS: Record<AppointmentTypeValue, number> = {
  CABINET: 1,
  DOMICILE: 1,
};

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
