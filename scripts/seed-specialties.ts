// Seed Spécialités FEATURE-RDV (Task 19) — catalogue de consultation choisi
// par le patient (wizard étape 2), configurable par l'ADMIN.
// Idempotent : upsert par nom unique + backfill des RDV sans spécialité
// (créés avant la feature) vers « Médecine générale ».
// Usage : bun scripts/seed-specialties.ts  (DATABASE_URL chargé depuis .env par bun)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// [nom, sortOrder] — Médecine générale en tête (cas par défaut).
const SPECIALTIES: [string, number][] = [
  ["Médecine générale", 0],
  ["Pédiatrie", 10],
  ["Gynécologie", 20],
  ["Cardiologie", 30],
  ["Diabétologie", 40],
  ["Chirurgie dentaire", 50],
  ["Ophtalmologie", 60],
];

async function main() {
  for (const [name, sortOrder] of SPECIALTIES) {
    await db.specialty.upsert({
      where: { name },
      update: { sortOrder },
      create: { name, sortOrder },
    });
    console.log(`✓ spécialité « ${name} » (sortOrder ${sortOrder})`);
  }

  const general = await db.specialty.findUnique({
    where: { name: "Médecine générale" },
    select: { id: true },
  });
  if (!general) throw new Error("Médecine générale introuvable après upsert");

  const backfilled = await db.appointment.updateMany({
    where: { specialtyId: null },
    data: { specialtyId: general.id },
  });
  console.log(`✓ backfill : ${backfilled.count} RDV rattachés à « Médecine générale »`);
}

main()
  .catch(error => {
    console.error("Seed spécialités échoué:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
