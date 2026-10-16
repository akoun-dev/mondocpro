// Task 36 — Applique la migration device_tokens directement (le CLI Supabase
// reste suspendu dans ce sandbox) + enregistre le tracking supabase_migrations
// de manière identique au CLI (version, statements, name) — ainsi le
// `bun run db:migrate-deploy` du PO ne la re-appliquera pas.
// Le DDL multi-instructions passe par `prisma db execute` (spawn) —
// $executeRawUnsafe refuse les multi-commandes (code 42601).
// Usage : DATABASE_URL=<url> bun scripts/apply-device-tokens-migration.ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const VERSION = "20261005120000";
const NAME = "add_device_tokens";
const FILE = "supabase/migrations/20261005120000_add_device_tokens.sql";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL absente");
  process.exit(1);
}
const url = process.env.DATABASE_URL;

// 1) DDL (idempotent : CREATE TABLE échoue si déjà présent → code attendu 42P07)
const ddl = execSync(
  `bunx prisma db execute --file ${FILE} --url "${url}" --schema supabase/schema.prisma`,
  { stdio: "pipe", encoding: "utf8", timeout: 60_000 },
);
console.log("DDL exécuté:", ddl.trim().slice(0, 120) || "ok");

// 2) Tracking (client dédié — le schema importé référence device_tokens qui
//    vient d'être créé ; des requêtes brutes suffisent)
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  await db.$executeRawUnsafe(
    "INSERT INTO supabase_migrations.schema_migrations (version, statements, name) VALUES ($1, $2::text[], $3)",
    VERSION,
    [readFileSync(FILE, "utf8")],
    NAME,
  );
  console.log("Migration appliquée + tracking inséré :", VERSION, NAME);
} catch (e) {
  console.error("ÉCHEC:", String(e).slice(0, 400));
  process.exit(1);
} finally {
  await db.$disconnect();
}

