// Service métier Portefeuille de Tokens — FEATURE-TOKENS (ADR-007).
// Server only (importe db). Ledger APPEND-ONLY : chaque mouvement est une
// ligne immuable de token_transactions ; le solde est TOUJOURS recalculé
// (aucun champ solde stocké → pas de dérive possible). Seule mutation
// autorisée sur une ligne : le statut d'une recharge PENDING (garde
// updateMany — une double confirmation reste sans effet).
import { db } from "@/lib/db";
import { notifyAdmins, notifyUsers } from "@/lib/notifications";
import { sendPushToAdmins, sendPushToUsers } from "@/lib/push";
import { Prisma, type TokenTransaction } from "@prisma/client";
import type { AppointmentTypeValue } from "@/lib/appointment-schemas";
import {
  DEFAULT_TARIFFS,
  TARIFF_DESCRIPTIONS,
  TARIFF_LABELS,
  TOKEN_VALUE_FCFA,
  fcfaToTokens,
  tariffKeyForType,
  tokensToFcfa,
  type TariffDto,
  type TariffKey,
} from "@/lib/token-schemas";
import type { PaymentMethod } from "@/lib/token-schemas";

export class TokenError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
    this.name = "TokenError";
  }
}

// Types de mouvements qui CRÉDITENT directement le disponible (+N).
// NB : RESERVATION/RELEASE/CONSUMPTION suivent le modèle du cycle (ADR-007) —
// une réservation déduit TANT QU'ELLE EXISTE (active ⇒ bloquée, consommée ⇒
// dépense définitive, libérée ⇒ neutralisée par la RELEASE). Voir
// computeBalance pour la formule exacte, source unique.
const BALANCE_CREDITING_TYPES = ["RECHARGE", "REFUND"] as const;

// ——— Grille tarifaire configurable par l'ADMIN (demande PO 2026-10-03) ———

// Tarif en vigueur pour un type de consultation : ligne lue en base
// (table tariff_configs, éditée par le Médecin Chef), FALLBACK sur le
// défaut provisionnel si la ligne manque (auto-réparation — ex: base
// reprovisionnée avant re-run du pré-flight).
// À appeler avec le client de transaction pour figer le tarif dans le même
// snapshot sérialisable que la réservation du RDV.
export async function getAppointmentCostTokens(
  type: AppointmentTypeValue,
  client: BalanceClient = db,
): Promise<number> {
  const row = await client.tariffConfig.findUnique({
    where: { key: tariffKeyForType(type) },
    select: { tokens: true },
  });
  return row?.tokens ?? DEFAULT_TARIFFS[type];
}

function toTariffDto(
  row: { key: string; tokens: number; updatedAt: Date; updatedBy: { fullName: string } | null },
): TariffDto {
  return {
    key: row.key as TariffKey,
    label: TARIFF_LABELS[row.key as TariffKey] ?? row.key,
    description: TARIFF_DESCRIPTIONS[row.key as TariffKey] ?? "",
    tokens: row.tokens,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedBy?.fullName ?? null,
  };
}

// GET /api/admin/tariffs — grille complète pour le Médecin Chef. Les clés
// attendues par l'application mais absentes en base sont RE-CRÉÉES au tarif
// par défaut (auto-réparation idempotente après reprovision).
export async function listTariffsForAdmin(): Promise<TariffDto[]> {
  const rows = await db.tariffConfig.findMany({
    where: { key: { in: [...Object.keys(TARIFF_LABELS)] } },
    include: { updatedBy: { select: { fullName: true } } },
  });

  const missing = (Object.keys(TARIFF_LABELS) as TariffKey[]).filter(
    key => !rows.some(row => row.key === key),
  );
  if (missing.length > 0) {
    const typeByKey: Record<string, AppointmentTypeValue> = {
      CONSULTATION_CABINET: "CABINET",
      CONSULTATION_DOMICILE: "DOMICILE",
    };
    for (const key of missing) {
      const created = await db.tariffConfig.upsert({
        where: { key },
        update: {},
        create: { key, tokens: DEFAULT_TARIFFS[typeByKey[key]] },
        include: { updatedBy: { select: { fullName: true } } },
      });
      rows.push(created);
    }
  }

  return rows
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(toTariffDto);
}

// PATCH /api/admin/tariffs/:key — le Médecin Chef fixe le prix en Tokens
// d'un poste tarifaire. La modification est auditable (updatedById) et ne
// vaut que pour les DEMANDES À VENIR (le coût d'un RDV est figé à sa
// réservation dans appointments.tokensReserved — invariant ledger).
export async function updateTariff(
  adminId: string,
  key: TariffKey,
  tokens: number,
): Promise<TariffDto> {
  const updated = await db.tariffConfig.upsert({
    where: { key },
    update: { tokens, updatedById: adminId },
    create: { key, tokens, updatedById: adminId },
    include: { updatedBy: { select: { fullName: true } } },
  });
  return toTariffDto(updated);
}

// ——— DTO ———

export type WalletTransactionDto = {
  id: string;
  type: TokenTransaction["type"];
  status: TokenTransaction["status"];
  tokens: number;
  amountFcfa: number | null;
  providerRef: string | null;
  note: string | null;
  createdAt: string;
};

export type WalletDto = {
  // Tokens disponibles (non réservés) — le patient peut les engager.
  balanceTokens: number;
  // Équivalent FCFA du disponible (valeur théorique).
  balanceFcfa: number;
  // Tokens bloqués par des RDV actifs (réservations en cours).
  reservedTokens: number;
  // Tokens définitivement consommés (visites réalisées) + équivalent FCFA.
  spentTokens: number;
  spentFcfa: number;
  transactions: WalletTransactionDto[];
};

export type RechargeDto = WalletTransactionDto & { patientName?: string };

function toTransactionDto(row: TokenTransaction): WalletTransactionDto {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    tokens: row.tokens,
    amountFcfa: row.amountFcfa,
    providerRef: row.providerRef,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

// ——— Formule de solde — SOURCE UNIQUE (affichage + vérification de réservation) ———
// solde = recharges confirmées + remboursements + ajustements signés
//         − TOUTES les réservations + toutes les libérations
// Une réservation déduit tant qu'elle existe : active = bloquée (reserved),
// consommée = dépense définitive, libérée = neutralisée par sa RELEASE.
// Compter les réservations TOUTES (et non « actives seules ») interdit tout
// double-crédit : annuler ne redonne pas plus que ce qui avait été bloqué.
type BalanceClient = Prisma.TransactionClient;

export async function computeBalance(
  client: BalanceClient,
  userId: string,
): Promise<{
  balanceTokens: number;
  reservedTokens: number;
  spentTokens: number;
  spentFcfa: number;
}> {
  // 6 agrégats : [recharges+remboursements, ajustements, toutes réservations,
  // libérations, réservations actives (blocage), consommations]
  const [recharges, adjustments, reservations, releases, reservedActive, spent] =
    await Promise.all([
      client.tokenTransaction.aggregate({
        where: { userId, status: "CONFIRMED", type: { in: [...BALANCE_CREDITING_TYPES] } },
        _sum: { tokens: true },
      }),
      client.tokenTransaction.aggregate({
        where: { userId, status: "CONFIRMED", type: "ADJUSTMENT" },
        _sum: { tokens: true },
      }),
      client.tokenTransaction.aggregate({
        where: { userId, type: "RESERVATION" },
        _sum: { tokens: true },
      }),
      client.tokenTransaction.aggregate({
        where: { userId, type: "RELEASE" },
        _sum: { tokens: true },
      }),
      // Blocage réel = réservations dont le RDV lié est toujours RESERVED.
      client.tokenTransaction.aggregate({
        where: { userId, type: "RESERVATION", appointment: { tokenState: "RESERVED" } },
        _sum: { tokens: true },
      }),
      client.tokenTransaction.aggregate({
        where: { userId, type: "CONSUMPTION" },
        _sum: { tokens: true, amountFcfa: true },
      }),
    ]);

  const balanceTokens =
    (recharges._sum.tokens ?? 0) +
    (adjustments._sum.tokens ?? 0) -
    (reservations._sum.tokens ?? 0) +
    (releases._sum.tokens ?? 0);

  return {
    balanceTokens,
    reservedTokens: reservedActive._sum.tokens ?? 0,
    spentTokens: spent._sum.tokens ?? 0,
    spentFcfa: spent._sum.amountFcfa ?? 0,
  };
}

// ——— Solde & historique (GET /api/wallet) ———

export async function getWalletForPatient(userId: string): Promise<WalletDto> {
  const [summary, transactions] = await Promise.all([
    computeBalance(db, userId),
    db.tokenTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const { balanceTokens, reservedTokens, spentTokens, spentFcfa } = summary;

  return {
    balanceTokens,
    balanceFcfa: tokensToFcfa(balanceTokens),
    reservedTokens,
    spentTokens,
    spentFcfa,
    transactions: transactions.map(toTransactionDto),
  };
}

// ——— Réservation de Tokens (au POST /api/appointments) ———
// À appeler DANS la transaction sérialisable de création du RDV (le RDV est
// déjà créé avec tokenState=RESERVED) : si le solde est insuffisant, la
// TokenError provoque le rollback complet (RDV + éventuelle écriture).

type ReservationTx = Prisma.TransactionClient;

export async function reserveTokensForAppointment(
  tx: ReservationTx,
  patientId: string,
  appointmentId: string,
  costTokens: number,
): Promise<void> {
  if (costTokens <= 0) return;

  // MÊME formule que l'affichage (computeBalance — source unique) : le RDV
  // étant déjà créé en RESERVED, sa future réservation n'est pas encore au
  // ledger ⇒ le solde calculé ici est exactement celui que verra le patient.
  const { balanceTokens } = await computeBalance(tx, patientId);

  if (balanceTokens < costTokens) {
    throw new TokenError(
      balanceTokens <= 0
        ? `Solde insuffisant — cette consultation coûte ${costTokens} Token${costTokens > 1 ? "s" : ""} (${tokensToFcfa(costTokens).toLocaleString("fr-FR")} FCFA). Rechargez votre portefeuille depuis votre profil.`
        : `Solde insuffisant — il vous manque ${costTokens - balanceTokens} Token${costTokens - balanceTokens > 1 ? "s" : ""}. Rechargez votre portefeuille depuis votre profil.`,
      402,
    );
  }

  await tx.tokenTransaction.create({
    data: {
      userId: patientId,
      type: "RESERVATION",
      status: "CONFIRMED",
      tokens: costTokens,
      amountFcfa: tokensToFcfa(costTokens),
      appointmentId,
    },
  });
}

// ——— Consommation définitive (clôture RDV par le Médecin Chef) ———
// La réservation devient dépense définitive : le disponible ne bouge PAS
// (les Tokens avaient déjà été déduits à la réservation) — on enregistre la
// dépense pour l'historique et la comptabilité.
export async function consumeAppointmentTokens(
  tx: ReservationTx,
  appointment: { id: string; patientId: string; tokensReserved: number },
  adminId: string,
): Promise<void> {
  if (appointment.tokensReserved <= 0) return;

  const reservation = await tx.tokenTransaction.findFirst({
    where: {
      userId: appointment.patientId,
      type: "RESERVATION",
      appointmentId: appointment.id,
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  await tx.tokenTransaction.create({
    data: {
      userId: appointment.patientId,
      type: "CONSUMPTION",
      status: "CONFIRMED",
      tokens: appointment.tokensReserved,
      amountFcfa: tokensToFcfa(appointment.tokensReserved),
      appointmentId: appointment.id,
      relatedTransactionId: reservation?.id ?? null,
      processedById: adminId,
    },
  });
}

// ——— Libération (annulation patient/admin, équipe non trouvée) ———
// Rend les Tokens réservés au disponible (+N).
export async function releaseAppointmentTokens(
  tx: ReservationTx,
  appointment: { id: string; patientId: string; tokensReserved: number },
  note: string,
  processedById?: string,
): Promise<void> {
  if (appointment.tokensReserved <= 0) return;

  const reservation = await tx.tokenTransaction.findFirst({
    where: {
      userId: appointment.patientId,
      type: "RESERVATION",
      appointmentId: appointment.id,
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  await tx.tokenTransaction.create({
    data: {
      userId: appointment.patientId,
      type: "RELEASE",
      status: "CONFIRMED",
      tokens: appointment.tokensReserved,
      amountFcfa: tokensToFcfa(appointment.tokensReserved),
      appointmentId: appointment.id,
      relatedTransactionId: reservation?.id ?? null,
      note,
      processedById: processedById ?? null,
    },
  });
}

// ——— Recharges ———

// POST /api/wallet/recharges — le patient déclare une recharge : statut
// PENDING jusqu'à validation du paiement par le Médecin Chef (modèle
// transitoire — la confirmation automatique par le prestataire arrivera avec
// la décision Mobile Money, ADR-005 ; cf. ADR-007 §recharges).
export async function requestRecharge(
  userId: string,
  amountFcfa: number,
  paymentMethod: PaymentMethod = "WAVE",
): Promise<RechargeDto> {
  const tokens = fcfaToTokens(amountFcfa);
  if (!Number.isInteger(tokens) || tokens <= 0) {
    throw new TokenError(
      `Le montant doit être un multiple de ${TOKEN_VALUE_FCFA.toLocaleString("fr-FR")} FCFA (1 Token)`,
      400,
    );
  }
  // Transaction unique : la déclaration ET l'alerte du Médecin Chef naissent
  // ensemble (Task 35) — sans elle, la file PENDING resterait invisible pour
  // l'ADMIN qui ne surveille pas l'interface en continu.
  const created = await db.$transaction(async (tx) => {
    const row = await tx.tokenTransaction.create({
      data: {
        userId,
        type: "RECHARGE",
        status: "PENDING",
        tokens,
        amountFcfa,
        providerRef: paymentMethod,
        note: "Recharge déclarée — paiement à rapprocher par le Médecin Chef",
      },
    });
    await notifyAdmins(tx, {
      type: "RECHARGE_REQUESTED",
      title: "Recharge de Tokens à valider",
      body: `Un patient a déclaré un paiement de ${amountFcfa.toLocaleString("fr-FR")} FCFA (${tokens} Token${tokens > 1 ? "s" : ""}) — à rapprocher dans les recharges.`,
      entityId: row.id,
    });
    return row;
  });
  // Task 36 — push jumelle : la file des recharges à valider arrive en
  // notification native (le Médecin Chef n'a pas l'interface ouverte 24h/24).
  void sendPushToAdmins({
    title: "Recharge de Tokens à valider",
    body: `Un patient a déclaré un paiement de ${amountFcfa.toLocaleString("fr-FR")} FCFA (${tokens} Token${tokens > 1 ? "s" : ""}) — à rapprocher dans les recharges.`,
    type: "RECHARGE_REQUESTED",
    entityId: created.id,
  });
  return toTransactionDto(created);
}

export type AdminRechargeDto = RechargeDto & {
  patientName: string;
  patientPhone: string;
};

// GET /api/admin/recharges — files du Médecin Chef : PENDING d'abord, puis
// les décisions récentes (traçabilité).
export async function listRechargesForAdmin(): Promise<{
  pending: AdminRechargeDto[];
  processed: AdminRechargeDto[];
}> {
  const include = {
    user: { select: { fullName: true, phone: true } },
  } as const;

  const [pending, processed] = await Promise.all([
    db.tokenTransaction.findMany({
      where: { type: "RECHARGE", status: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 50,
      include,
    }),
    db.tokenTransaction.findMany({
      where: { type: "RECHARGE", status: { not: "PENDING" } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include,
    }),
  ]);

  const map = (row: (typeof pending)[number]): AdminRechargeDto => ({
    ...toTransactionDto(row),
    patientName: row.user.fullName,
    patientPhone: row.user.phone,
  });
  return { pending: pending.map(map), processed: processed.map(map) };
}

// PATCH /api/admin/recharges/:id — décision du Médecin Chef.
// Garde anti double-crédit : la transition n'aboutit que si la recharge est
// encore PENDING (updateMany conditionnel — une 2e confirmation concurrente
// ou tardive ne crédite JAMAIS deux fois).
export async function decideRecharge(
  adminId: string,
  rechargeId: string,
  decision: "CONFIRM" | "REJECT",
  note?: string,
): Promise<RechargeDto> {
  const existing = await db.tokenTransaction.findUnique({
    where: { id: rechargeId },
  });
  if (!existing || existing.type !== "RECHARGE") {
    throw new TokenError("Recharge introuvable", 404);
  }
  if (existing.status !== "PENDING") {
    throw new TokenError(
      `Cette recharge a déjà été traitée (${existing.status === "CONFIRMED" ? "confirmée" : "refusée"})`,
      409,
    );
  }

  // Transaction unique : la décision ET la notification patient (Task 35)
  // sont indissociables — le patient apprend le crédit/refus via son fil
  // InApp, la garde updateMany conditionnelle reste la barrière anti
  // double-crédit ET anti double-notification.
  const fresh = await db.$transaction(async (tx) => {
    const updated = await tx.tokenTransaction.updateMany({
      where: { id: rechargeId, type: "RECHARGE", status: "PENDING" },
      data: {
        status: decision === "CONFIRM" ? "CONFIRMED" : "REJECTED",
        processedById: adminId,
        note:
          note?.slice(0, 300) ??
          (decision === "CONFIRM"
            ? "Paiement rapproché par le Médecin Chef"
            : "Paiement non rapproché"),
      },
    });
    if (updated.count === 0) {
      throw new TokenError("Cette recharge a déjà été traitée", 409);
    }

    if (decision === "CONFIRM") {
      await notifyUsers(tx, [existing.userId], {
        type: "RECHARGE_CONFIRMED",
        title: "Recharge validée",
        body: `Votre recharge de ${existing.amountFcfa?.toLocaleString("fr-FR") ?? "—"} FCFA est confirmée : ${existing.tokens} Token${existing.tokens > 1 ? "s" : ""} disponibles dans votre portefeuille.`,
        entityId: rechargeId,
      });
    } else {
      await notifyUsers(tx, [existing.userId], {
        type: "RECHARGE_REJECTED",
        title: "Recharge non validée",
        body: `Votre déclaration de ${existing.amountFcfa?.toLocaleString("fr-FR") ?? "—"} FCFA n'a pas pu être rapprochée d'un paiement. Contactez le support si vous pensez qu'il s'agit d'une erreur.`,
        entityId: rechargeId,
      });
    }

    return tx.tokenTransaction.findUniqueOrThrow({
      where: { id: rechargeId },
    });
  });
  // Task 36 — push jumelle au patient (crédit ou refus) — après le commit,
  // contenu identique à la notification InApp jumelle.
  void sendPushToUsers([existing.userId], {
    title:
      decision === "CONFIRM" ? "Recharge validée" : "Recharge non validée",
    body:
      decision === "CONFIRM"
        ? `Votre recharge de ${existing.amountFcfa?.toLocaleString("fr-FR") ?? "—"} FCFA est confirmée : ${existing.tokens} Token${existing.tokens > 1 ? "s" : ""} disponibles dans votre portefeuille.`
        : `Votre déclaration de ${existing.amountFcfa?.toLocaleString("fr-FR") ?? "—"} FCFA n'a pas pu être rapprochée d'un paiement. Contactez le support si vous pensez qu'il s'agit d'une erreur.`,
    type: decision === "CONFIRM" ? "RECHARGE_CONFIRMED" : "RECHARGE_REJECTED",
    entityId: rechargeId,
  });
  return toTransactionDto(fresh);
}
