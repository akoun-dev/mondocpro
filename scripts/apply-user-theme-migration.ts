// Task 37 — Applique la migration user_theme directement (le CLI Supabase
// reste suspendu dans ce sandbox) + enregistre le tracking supabase_migrations
// de manière identique au CLI (version, statements, name) — ainsi le
// `bun run db:migrate-deploy` du PO ne la re-appliquera pas.
// Même pattern que scripts/apply-device-tokens-migration.ts (Task 36) :
// DDL multi-instructions via `prisma db execute` (spawn), tracking via
// PrismaClient + $executeRawUnsafe.
// Usage : DATABASE_URL=<url> bun scripts/apply-user-theme-migration.ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const VERSION = "20261005200000";
const NAME = "add_user_theme";
const FILE = "supabase/migrations/20261005200000_add_user_theme.sql";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absente");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
// Transaction mode (6543 + pgbouncer) : le pool session (5432) peut être
// saturé par le dev server / Vercel (EMAXCONNSESSION, pool_size 15) — le
// mode transaction n'a pas cette limite persistante et accepte le DDL.
const txUrl = url
  .replace(":5432/", ":6543/")
  .replace(/\?$/, "")
  + (url.includes("?") ? "&" : "?") + "pgbouncer=true&connection_limit=1";

// 1) DDL idempotent (CREATE TYPE guardé, ADD COLUMN IF NOT EXISTS)
// NB : `prisma db execute` exige --url OU --schema (mutuellement exclusifs) ;
// on passe l'URL du process env (prisma.config.ts ne propage pas sa
// datasource à ce sous-commande — constaté Prisma 6.19).
const ddl = execSync(`bunx prisma db execute --file ${FILE} --url "${txUrl}"`, {
  stdio: "pipe",
  encoding: "utf8",
  timeout: 60_000,
});
console.log("DDL exécuté:", ddl.trim().slice(0, 120) || "ok");

// 2) Tracking — requêtes brutes (le client généré référence theme, créé à l'instant)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: txUrl } } });
try {
  await db.$executeRawUnsafe(
    "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2::text[], $3)",
    VERSION,
    [readFileSync(FILE, "utf8")],
    NAME,
  );
  console.log("Migration appliquée + tracking inséré :", VERSION, NAME);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("duplicate key") || msg.includes("unique")) {
    console.log("Tracking déjà présent (migration déjà appliquée) — ok");
  } else {
    throw e;
  }
} finally {
  await db.$disconnect();
}
