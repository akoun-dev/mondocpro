// Task 40 / ADR-010 — Applique la migration device_tokens.expiresAt
// directement (le CLI Supabase reste suspendu dans ce sandbox) + enregistre
// le tracking supabase_migrations de manière identique au CLI (version,
// statements, name) — ainsi le `bun run db:migrate-deploy` du PO ne la
// re-appliquera pas. Même pattern que scripts/apply-user-theme-migration.ts
// (Task 37) : DDL via PrismaClient ($executeRawUnsafe), tracking via PrismaClient
// + $executeRawUnsafe.
// Usage : bun scripts/apply-device-key-expires-at-migration.ts
import { readFileSync } from "node:fs";

const VERSION = "20261005220000";
const NAME = "add_device_tokens_expires_at";
const FILE = "supabase/migrations/20261005220000_add_device_tokens_expires_at.sql";

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

// 1) DDL idempotent (ADD COLUMN IF NOT EXISTS) — via PrismaClient direct
// (le spawn `bunx prisma db execute` a montré des ETIMEDOUT dans le sandbox ;
// $executeRawUnsafe passe par le même pilote que le runtime, sans relance CLI).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient({ datasources: { db: { url: txUrl } } });
try {
  await db.$executeRawUnsafe(
    'ALTER TABLE "device_tokens" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)',
  );
  console.log("DDL exécuté : device_tokens.expiresAt disponible");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("already exists") || msg.includes("duplicate column")) {
    console.log("Colonne déjà présente — ok");
  } else {
    throw e;
  }
}

// 2) Tracking — requêtes brutes
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
