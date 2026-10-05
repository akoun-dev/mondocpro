// E2E service — getWalletForPatient refacto (Task 48) rejouée sur le pooler
// de TRANSACTION 6543 : batched $transaction + groupBy + agrégat relation.
// Compare les soldes avec la lecture de référence computeBalance (ancienne
// formule, 6 agrégats) exécutée sur la MÊME connexion → équivalence stricte.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const raw = readFileSync(".env", "utf8");
const u = new URL(raw.match(/^DATABASE_URL="?([^"\n]+)"?/m)![1]);
u.port = "6543";
u.searchParams.set("pgbouncer", "true");
u.searchParams.set("connection_limit", "1");
u.searchParams.set("pool_timeout", "20");
process.env.DATABASE_URL = u.toString();

const { getWalletForPatient, computeBalance } = await import("../src/lib/tokens");
const db = new PrismaClient();

async function main() {
  const patient = await db.user.findFirst({
    where: { phone: "+2250709229992", role: "PATIENT" },
    select: { id: true, fullName: true },
  });
  if (!patient) throw new Error("patient de test introuvable");
  console.log(`patient: ${patient.fullName}`);

  const t0 = Date.now();
  const wallet = await getWalletForPatient(patient.id);
  const ms = Date.now() - t0;
  console.log(
    `wallet 6543 (refacto): balance=${wallet.balanceTokens} reserved=${wallet.reservedTokens} spent=${wallet.spentTokens} (${wallet.spentFcfa} FCFA) tx=${wallet.transactions.length} en ${ms}ms`,
  );

  // Référence : ancienne formule (6 agrégats parallèles) sur la même connexion
  const ref = await computeBalance(db, patient.id);
  console.log(
    `référence computeBalance: balance=${ref.balanceTokens} reserved=${ref.reservedTokens} spent=${ref.spentTokens}`,
  );

  const ok =
    wallet.balanceTokens === ref.balanceTokens &&
    wallet.reservedTokens === ref.reservedTokens &&
    wallet.spentTokens === ref.spentTokens;
  if (!ok) throw new Error("DIVERGENCE solde refacto vs référence");
  console.log("✅ équivalence stricte refacto ↔ référence sur 6543");

  // 3 appels consécutifs (stabilité — pas d'erreur de statement préparé)
  for (let i = 0; i < 3; i++) {
    const w = await getWalletForPatient(patient.id);
    process.stdout.write(`run#${i + 1}: ${w.balanceTokens} ✓  `);
  }
  console.log("\n✅ 3 appels consécutifs stables (pgbouncer/6543)");
}

main()
  .catch(e => {
    console.error("ÉCHEC:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
