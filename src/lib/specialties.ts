// Service Spécialités — FEATURE-RDV wizard (server only, importe db).
// Catalogue de consultation : lecture publique (patients, actives uniquement)
// et gestion ADMIN (création, renommage, activation/désactivation, deletion).
// Désactivation douce : une spécialité masquée reste rattachée à l'historique
// des RDV (FK onDelete: SetNull ne joue que si l'ADMIN la supprime vraiment).
import { db } from "@/lib/db";
import type { Specialty } from "@prisma/client";

export class SpecialtyError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type SpecialtyDto = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export function toSpecialtyDto(specialty: Specialty): SpecialtyDto {
  return {
    id: specialty.id,
    name: specialty.name,
    isActive: specialty.isActive,
    sortOrder: specialty.sortOrder,
  };
}

const ORDER_BY = [{ sortOrder: "asc" }, { name: "asc" }] as const;

// Fil patient (wizard étape 2) — actives uniquement.
export async function listActiveSpecialties(): Promise<SpecialtyDto[]> {
  const rows = await db.specialty.findMany({
    where: { isActive: true },
    orderBy: [...ORDER_BY],
  });
  return rows.map(toSpecialtyDto);
}

// Fil ADMIN — tout le catalogue, actives comme désactivées.
export async function listAllSpecialties(): Promise<SpecialtyDto[]> {
  const rows = await db.specialty.findMany({
    orderBy: [...ORDER_BY],
  });
  return rows.map(toSpecialtyDto);
}

// Nom nettoyé : espaces compressés, 2–80 caractères affichables.
function cleanName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function createSpecialty(
  rawName: string,
  sortOrder?: number,
): Promise<SpecialtyDto> {
  const name = cleanName(rawName);
  if (name.length < 2 || name.length > 80) {
    throw new SpecialtyError(
      "Le nom d'une spécialité doit contenir entre 2 et 80 caractères",
      400,
    );
  }
  const existing = await db.specialty.findUnique({ where: { name } });
  if (existing) {
    throw new SpecialtyError(
      `La spécialité « ${name} » existe déjà`,
      409,
    );
  }
  const created = await db.specialty.create({
    data: {
      name,
      sortOrder: sortOrder ?? (await db.specialty.count()) * 10,
    },
  });
  return toSpecialtyDto(created);
}

export async function updateSpecialty(
  id: string,
  data: { name?: string; isActive?: boolean },
): Promise<SpecialtyDto> {
  const existing = await db.specialty.findUnique({ where: { id } });
  if (!existing) {
    throw new SpecialtyError("Spécialité introuvable", 404);
  }

  const patch: { name?: string; isActive?: boolean } = {};
  if (data.name !== undefined) {
    const name = cleanName(data.name);
    if (name.length < 2 || name.length > 80) {
      throw new SpecialtyError(
        "Le nom d'une spécialité doit contenir entre 2 et 80 caractères",
        400,
      );
    }
    if (name !== existing.name) {
      const clash = await db.specialty.findUnique({ where: { name } });
      if (clash) {
        throw new SpecialtyError(`La spécialité « ${name} » existe déjà`, 409);
      }
      patch.name = name;
    }
  }
  if (data.isActive !== undefined) {
    patch.isActive = data.isActive;
  }

  const updated = await db.specialty.update({ where: { id }, data: patch });
  return toSpecialtyDto(updated);
}

export async function deleteSpecialty(id: string): Promise<void> {
  const existing = await db.specialty.findUnique({
    where: { id },
    include: { _count: { select: { appointments: true } } },
  });
  if (!existing) {
    throw new SpecialtyError("Spécialité introuvable", 404);
  }
  if (existing._count.appointments > 0) {
    throw new SpecialtyError(
      `Impossible de supprimer « ${existing.name} » : ${existing._count.appointments} rendez-vous y sont rattachés — désactivez-la plutôt`,
      409,
    );
  }
  await db.specialty.delete({ where: { id } });
}
