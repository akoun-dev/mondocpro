// Prisma config — pointe le CLI vers le schéma logé dans supabase/ (demande PO 2026-10-03).
// Le dossier de migrations résolu est <dirname(schema)>/migrations → supabase/migrations,
// qui héberge désormais TOUTES les migrations (format Prisma + scripts SQL miroir du scaffold).
//
// ⚠️ En mode config, le CLI Prisma ne charge plus `.env` automatiquement :
//   - scripts db:* (package.json) : réexportent DATABASE_URL depuis .env (piège 2, cf. .zscripts/dev.sh)
//   - scripts bun (scripts/*.ts)  : bun charge .env nativement
//   - runtime Next.js             : Next charge .env lui-même
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("supabase", "schema.prisma"),
});
