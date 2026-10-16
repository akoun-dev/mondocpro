// FEATURE-NURSE — affectation d'un groupe d'infirmiers à une mission partagée.
// Applique la migration nurse_mission_members directement via le client Prisma
// (le CLI `prisma db execute` reste suspendu sur le pooler de ce sandbox) +
// enregistre le tracking supabase_migrations de manière identique au CLI
// (version, statements, name) — ainsi le `bun run db:migrate-deploy` du PO ne
// la re-appliquera pas. Même pattern que scripts/apply-user-theme-migration.ts.
// Usage : DATABASE_URL=<url> bun scripts/apply-nurse-mission-members-migration.ts
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const VERSION = "20261016120000";
const NAME = "add_nurse_mission_members";
const FILE = "supabase/migrations/20261016120000_add_nurse_mission_members.sql";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absente");
  process.exit(1);
}
const url = process.env.DATABASE_URL;
// Transaction mode (6543 + pgbouncer) : pas de limite de pool session.
const txUrl = url
  .replace(":5432/", ":6543/")
  .replace(/\?$/, "")
  + (url.includes("?") ? "&" : "?") + "pgbouncer=true&connection_limit=1";

const sql = readFileSync(FILE, "utf8");
// Découpe par instruction `;` en fin de ligne — le fichier ne contient aucun
// point-virgule interne (DDL + INSERT…SELECT).
const statements = sql
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

const db = new PrismaClient({ datasources: { db: { url: txUrl } } });
try {
  for (const statement of statements) {
    await db.$executeRawUnsafe(statement);
  }
  console.log(`DDL exécuté (${statements.length} instructions) : ok`);

  try {
    await db.$executeRawUnsafe(
      "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2::text[], $3)",
      VERSION,
      [sql],
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
  }
} finally {
  await db.$disconnect();
}
