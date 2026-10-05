// Service Sensibilisations — FEATURE-SENSO (server only, importe db).
// Ciblage par zone : une sensibilisation sans zone (`zones` vide) est visible
// de toutes les zones ; sinon elle n'apparaît que pour ses zones cibles.
// Phase 2 : rédaction Médecin Chef — CRUD complet côté admin (les routes
// /api/admin/sensibilisations portent la garde ADMIN, ce fichier les règles
// métier : bornes éditoriales, déduplication des zones, 404 idiologique).
import { db } from "@/lib/db";
import type { Sensibilisation, Zone } from "@prisma/client";
import type {
    CreateSensibilisationInput,
    UpdateSensibilisationInput,
} from "@/lib/sensibilisations-schemas";

// Erreur métier portant le statut HTTP de la réponse (404, 409…) — même
// convention que SpecialtyError pour la factorisation des routes.
export class SensibilisationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SensibilisationError";
  }
}

export type SensibilisationDto = {
  id: string;
  title: string;
  body: string;
  category: Sensibilisation["category"];
  zones: Zone[];
  publishedAt: string;
};

function toSensibilisationDto(row: Sensibilisation): SensibilisationDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    zones: row.zones,
    publishedAt: row.publishedAt.toISOString(),
  };
}

// Visibilité commune : contenu non ciblé OU ciblant la zone du lecteur.
const visibleForZone = (zone: Zone) => ({
  OR: [{ zones: { isEmpty: true } }, { zones: { has: zone } }],
});

export async function listSensibilisationsForZone(
  zone: Zone,
): Promise<SensibilisationDto[]> {
  const rows = await db.sensibilisation.findMany({
    where: visibleForZone(zone),
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map(toSensibilisationDto);
}

export async function getSensibilisationForZone(
  id: string,
  zone: Zone,
): Promise<SensibilisationDto | null> {
  const row = await db.sensibilisation.findFirst({
    where: { id, ...visibleForZone(zone) },
  });
  return row ? toSensibilisationDto(row) : null;
}

// ——— FEATURE-SENSO phase 2 — rédaction Médecin Chef (ADMIN) ———

// DTO admin : le fil patient + updatedAt (repère « modifiée le » en vue de
// gestion). Le corps complet est renvoyé — la liste admin est paginée par la
// prise (100 derniers) et le rédacteur a besoin de l'aperçu réel.
export type AdminSensibilisationDto = SensibilisationDto & {
  updatedAt: string;
};

function toAdminSensibilisationDto(
  row: Sensibilisation,
): AdminSensibilisationDto {
  return {
    ...toSensibilisationDto(row),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Annuaire éditorial complet : TOUTES les publications, toutes zones confondues
// (le Médecin Chef gère le contenu national, pas seulement son secteur).
export async function listAllSensibilisations(): Promise<
  AdminSensibilisationDto[]
> {
  const rows = await db.sensibilisation.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return rows.map(toAdminSensibilisationDto);
}

// Publication — zones dédupliquées (un double-clic sur une case ne doit pas
// créer de doublon dans le ciblage).
export async function createSensibilisation(
  input: CreateSensibilisationInput,
): Promise<AdminSensibilisationDto> {
  const row = await db.sensibilisation.create({
    data: {
      title: input.title,
      body: input.body,
      category: input.category,
      zones: [...new Set(input.zones)],
    },
  });
  return toAdminSensibilisationDto(row);
}

// Édition partielle — 404 idiologique (indistinguable absence / id invalide).
export async function updateSensibilisation(
  id: string,
  patch: UpdateSensibilisationInput,
): Promise<AdminSensibilisationDto> {
  const existing = await db.sensibilisation.findUnique({ where: { id } });
  if (!existing) {
    throw new SensibilisationError(404, "Sensibilisation introuvable");
  }

  const row = await db.sensibilisation.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.zones !== undefined
        ? { zones: [...new Set(patch.zones)] }
        : {}),
    },
  });
  return toAdminSensibilisationDto(row);
}

// Suppression définitive — deleteMany avec garde de comptage : une course
// entre deux onglets admin renvoie 404 au second, jamais une 500 Prisma.
export async function deleteSensibilisation(id: string): Promise<void> {
  const result = await db.sensibilisation.deleteMany({ where: { id } });
  if (result.count === 0) {
    throw new SensibilisationError(404, "Sensibilisation introuvable");
  }
}
