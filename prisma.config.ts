// Prisma config — pointe le CLI vers le schéma logé dans supabase/ (demande PO 2026-10-03).
//
// ⚠️ Prisma n'est PLUS le gestionnaire de schéma : les migrations sont
// exclusivement Supabase CLI (`supabase/migrations/`, voir le README du dossier).
// Ce fichier ne sert qu'à `prisma generate` — le client (types + requêtes).
// Ne jamais utiliser `prisma migrate` ni `prisma db push` ici.
//
// ⚠️ En mode config, le CLI Prisma ne charge plus `.env` automatiquement :
//   - scripts bun (scripts/*.ts)  : bun charge .env nativement
//   - runtime Next.js             : Next charge .env lui-même
import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: path.join("supabase", "schema.prisma"),
});
