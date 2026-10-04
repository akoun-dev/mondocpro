// GET /api/health — Sonde de vie + base de données (contrat API_CONTRACTS.md v2)
// Vérification de santé utilisée par les tests E2E et le monitoring.
// Toujours HTTP 200 : l'état DB est porté par le corps (`database`, `status`)
// afin que la sonde réponde même pendant un incident de base de données.
//
// v3 (déploiement Vercel 2026-10-04) : le corps expose un bloc `diagnostic`
// permettant de distinguer SANS accéder aux logs plateforme les causes les
// plus fréquentes d'un `database: "down"` en production :
//   - DATABASE_URL absente (variables d'environnement non configurées sur
//     Vercel — `.env` est gitignore et n'arrive jamais en déploiement) ;
//   - base injoignable (host pooler/port/sslmode) — code Prisma P1001 ;
//   - accès refusé (identifiants/allowlist) — code Prisma P1010 ou pg 28P01.
// AUCUN secret n'est exposé : booléen de présence + codes d'erreur + hints
// génériques (jamais le message brut Prisma, qui peut contenir la chaîne de
// connexion).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type HealthDiagnostic = {
  hasDatabaseUrl: boolean;
  dbErrorCode: string | null;
  dbHint: string | null;
};

// Codes Prisma (P1xxx/P2xxx) et codes PostgreSQL courants (5 chiffres) —
// uniquement des identifiants courts, jamais le message (fuite de secrets).
function extractDbErrorCode(e: unknown): string | null {
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code?: unknown }).code;
    if (
      typeof code === "string" &&
      (code.startsWith("P") || /^\d{5}$/.test(code))
    ) {
      return code;
    }
  }
  return null;
}

function buildDiagnostic(e: unknown): HealthDiagnostic {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const code = extractDbErrorCode(e);

  let dbHint: string | null = null;
  if (!hasDatabaseUrl) {
    dbHint =
      "DATABASE_URL absente — ajoutez-la dans Vercel → Settings → Environment Variables (Production + Preview) puis redéployez. Format : voir .ai/DEPLOY_VERCEL.md";
  } else if (code === "P1001") {
    dbHint =
      "Base injoignable — vérifiez le host pooler Supabase (aws-…-*.pooler.supabase.com), le port (5432 session / 6543 transaction) et sslmode=require";
  } else if (code === "P1010" || code === "28P01") {
    dbHint =
      "Accès refusé — vérifiez le mot de passe PostgreSQL (connexions pooler : postgres.<PROJECT_REF>) ou l'allowlist IP du projet Supabase";
  } else if (code === "P2021" || code === "42P01") {
    dbHint =
      "Table manquante — les migrations Supabase n'ont pas été appliquées sur cette base (bun run db:migrate-deploy)";
  } else if (code) {
    dbHint = `Erreur DB code ${code} — consultez les logs Vercel (onglet Logs, fonction /api/health)`;
  } else {
    dbHint = "Erreur DB sans code — consultez les logs Vercel (fonction /api/health)";
  }

  return { hasDatabaseUrl, dbErrorCode: code, dbHint };
}

export async function GET() {
  let database: "up" | "down" = "down";
  let diagnostic: HealthDiagnostic = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    dbErrorCode: null,
    dbHint: null,
  };

  try {
    await db.$queryRawUnsafe("SELECT 1");
    database = "up";
  } catch (e) {
    console.error("[health] probe DB échouée:", e);
    diagnostic = buildDiagnostic(e);
  }

  return NextResponse.json({
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString(),
    // Bloc additif (v3) : les consommateurs historiques lisent status/database.
    diagnostic,
  });
}
