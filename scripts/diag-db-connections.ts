// Diagnostic DB (Task 48) — sessions pg_stat_activity + config pooler.
// Usage : env -u DATABASE_URL bun scripts/diag-db-connections.ts
// (le .env du projet est la source — l'export shell scaffold pointe vers SQLite)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const raw = readFileSync(".env", "utf8");
const match = raw.match(/^DATABASE_URL="?([^"\n]+)"?/m);
if (!match) throw new Error("DATABASE_URL introuvable dans .env");
process.env.DATABASE_URL = match[1];

const db = new PrismaClient();

async function main() {
  const activity = await db.$queryRaw<
    { state: string | null; app: string; n: bigint; max_age_s: bigint | null }[]
  >`
    SELECT state,
           COALESCE(application_name, '?') AS app,
           count(*)::bigint AS n,
           MAX(EXTRACT(EPOCH FROM (now() - state_change)))::bigint AS max_age_s
    FROM pg_stat_activity
    WHERE datname = current_database()
    GROUP BY state, app
    ORDER BY n DESC
  `;
  console.log("=== pg_stat_activity (groupé) ===");
  for (const row of activity) {
    console.log(
      `state=${row.state} app=${row.app} n=${row.n} max_idle_s=${row.max_age_s}`,
    );
  }

  const total = await db.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM pg_stat_activity WHERE datname = current_database()
  `;
  console.log(`TOTAL sessions sur ${"cette base"}: ${total[0]?.n}`);

  const limits = await db.$queryRaw<{ name: string; setting: string }[]>`
    SHOW max_connections
  `;
  console.log("max_connections:", limits[0]?.setting);
}

main()
  .catch(e => {
    console.error("DIAG ERROR:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
