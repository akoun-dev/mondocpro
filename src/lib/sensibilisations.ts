// Service Sensibilisations — FEATURE-SENSO (server only, importe db).
// Ciblage par zone : une sensibilisation sans zone (`zones` vide) est visible
// de toutes les zones ; sinon elle n'apparaît que pour ses zones cibles.
import { db } from "@/lib/db";
import type { Sensibilisation, Zone } from "@prisma/client";

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
