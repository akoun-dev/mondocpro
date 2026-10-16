// Test du TRANSACTION pooler Supabase (6543) + pgbouncer=true (Task 48).
// Reprend l'URL .env, bascule le port 5432 → 6543, ajoute les paramètres
// Prisma recommandés, puis rejoue les requêtes du wallet (groupBy + agrégat
// relation + findMany + transaction sérialisable courte).
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const raw = readFileSync(".env", "utf8");
const m = raw.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if (!m) throw new Error("DATABASE_URL introuvable dans .env");
const u = new URL(m[1]);
console.log("hôte session:", u.host, "base:", u.pathname);
u.port = "6543";
u.searchParams.set("pgbouncer", "true");
u.searchParams.set("connection_limit", "1");
u.searchParams.set("pool_timeout", "20");
console.log("hôte transaction:", u.host);
process.env.DATABASE_URL = u.toString();

const db = new PrismaClient();

async function main() {
  const t0 = Date.now();
  // Équivalent groupBy du refacto wallet (type×status en UNE requête)
  const grouped = await db.tokenTransaction.groupBy({
    by: ["type", "status"],
    _sum: { tokens: true, amountFcfa: true },
    where: { userId: "diag-non-existant" },
  });
  console.log(
    `groupBy type×status: ${grouped.length} groupes en ${Date.now() - t0}ms`,
  );

  // Agrégat avec filtre relation (blocage RDV actifs)
  const t1 = Date.now();
  const reserved = await db.tokenTransaction.aggregate({
    where: { userId: "diag-non-existant", appointment: { tokenState: "RESERVED" } },
    _sum: { tokens: true },
  });
  console.log(`aggregate relation: ${reserved._sum.tokens ?? 0} en ${Date.now() - t1}ms`);

  // findMany ledger
  const t2 = Date.now();
  const txs = await db.tokenTransaction.findMany({ take: 50 });
  console.log(`findMany: ${txs.length} lignes en ${Date.now() - t2}ms`);

  // Transaction sérialisable courte (patron création RDV)
  const t3 = Date.now();
  const probe = await db.$transaction(
    async tx => {
      const n = await tx.sensibilisation.count();
      return n;
    },
    { isolationLevel: "Serializable", timeout: 15000 },
  );
  console.log(`transaction serializable: ${probe} sensibilisations en ${Date.now() - t3}ms`);

  // Sessions visibles depuis cette connexion
  const act = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM pg_stat_activity WHERE datname = current_database()`;
  console.log("sessions pg (vue limitée au pooler):", act[0]?.n);
  console.log("✅ 6543 + pgbouncer=true : toutes les requêtes passent");
}

main()
  .catch(e => {
    console.error("ÉCHEC 6543:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
