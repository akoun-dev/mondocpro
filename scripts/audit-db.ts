// Audit DB — état réel de la base Supabase (lecture seule)
// ⚠️ Piège 2 : le shell exporte DATABASE_URL=file:... → re-export depuis .env
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(join(import.meta.dir, "..", ".env"), "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
}

const env = loadEnv();
process.env.DATABASE_URL = env.DATABASE_URL;

const db = new PrismaClient();

const [users, sessions, resetTokens, byRole] = await Promise.all([
  db.user.count(),
  db.session.count(),
  db.passwordResetToken.count(),
  db.user.groupBy({ by: ["role"], _count: { _all: true } }),
]);

const expiredSessions = await db.session.count({
  where: { expiresAt: { lt: new Date() } },
});

const usedResetTokens = await db.passwordResetToken.count({
  where: { usedAt: { not: null } },
});

console.log(JSON.stringify({ users, byRole, sessions, expiredSessions, resetTokens, usedResetTokens }, null, 2));

await db.$disconnect();
