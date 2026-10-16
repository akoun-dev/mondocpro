// Vérification Task 28 — table tariff_configs : structure + seeds + round-trip.
// Usage : bun scripts/check-tariffs.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1) Les 2 lignes seedées existent avec le tarif provisionnel (1 Token).
  const rows = await db.tariffConfig.findMany({
    orderBy: { key: "asc" },
    include: { updatedBy: { select: { fullName: true } } },
  });
  console.log("lignes:", rows.length);
  for (const row of rows) {
    console.log(`  ${row.key} = ${row.tokens} Token(s) · maj=${row.updatedAt.toISOString()}`);
  }
  if (rows.length !== 2) throw new Error("SEEDS ATTENDUS : 2 lignes");
  for (const row of rows) {
    if (row.tokens !== 1) throw new Error(`SEED ${row.key} ≠ 1 Token`);
  }

  // 2) Round-trip update + audit updatedById ( rollback ensuite ).
  const admin = await db.user.findUnique({
    where: { phone: "+2250700000001" },
    select: { id: true, fullName: true },
  });
  if (!admin) throw new Error("compte ADMIN seedé introuvable");
  const before = rows.find(r => r.key === "CONSULTATION_CABINET")!;
  const updated = await db.tariffConfig.update({
    where: { key: "CONSULTATION_CABINET" },
    data: { tokens: 3, updatedById: admin.id },
  });
  if (updated.tokens !== 3) throw new Error("update non appliqué");
  if (updated.updatedById !== admin.id) throw new Error("audit non tracé");
  console.log(`update OK: CABINET=3 par ${admin.fullName}`);

  // Restauration du tarif provisionnel.
  await db.tariffConfig.update({
    where: { key: "CONSULTATION_CABINET" },
    data: { tokens: before.tokens, updatedById: null },
  });
  const restored = await db.tariffConfig.findUnique({
    where: { key: "CONSULTATION_CABINET" },
  });
  console.log(`restauré: CABINET=${restored?.tokens} Token(s)`);
  console.log("CHECK-TARIFFS: OK");
}

main()
  .catch(error => {
    console.error("CHECK-TARIFFS: KO —", error.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
