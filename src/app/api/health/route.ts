// GET /api/health — Sonde de vie + base de données (contrat API_CONTRACTS.md v4)
// Vérification de santé utilisée par les tests E2E et le monitoring.
// Toujours HTTP 200 : l'état DB est porté par le corps (`database`, `status`)
// afin que la sonde réponde même pendant un incident de base de données.
//
// v4 (2026-10-04) : le bloc `diagnostic` analyse désormais la STRUCTURE de
// DATABASE_URL (sans jamais exposer credentials ni project ref) et classe
// l'erreur par famille. Motivation : incident prod où la variable était
// présente mais l'erreur sans code (chaîne mal formée) — v3 ne permettait
// pas de distinguer « URL mal formée » de « host direct IPv6 » etc.
//   - `dbUrl` : présence, parsabilité, schéma, type de host, port, présence
//     username/password, nombre de `@`, paramètres de query ;
//   - `dbErrorKind` : famille d'erreur (syntaxe réseau auth timeout TLS…)
//     dérivée du nom d'erreur et de motifs sûrs du message (jamais brut).
// AUCUN secret n'est exposé : pas de message Prisma brut, pas de host
// complet (le project ref est masqué), pas de mot de passe.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type DbUrlDiagnostic = {
  present: boolean;
  parseable: boolean;
  scheme: string | null;
  hostKind: "supabase-pooler" | "supabase-direct" | "localhost" | "other" | null;
  port: string | null;
  hasUsername: boolean;
  hasPassword: boolean;
  atSymbolCount: number;
  queryKeys: string[];
};

type DbErrorKind =
  | "url-malformed"
  | "auth"
  | "dns-network"
  | "timeout"
  | "tls"
  | "too-many-connections"
  | "ipv6-host"
  | "missing-table"
  | "prepared-statements"
  | "unknown";

type HealthDiagnostic = {
  hasDatabaseUrl: boolean;
  dbUrl: DbUrlDiagnostic | null;
  dbErrorCode: string | null;
  dbErrorKind: DbErrorKind;
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

// Analyse structurelle SANS exposition : on ne renvoie ni le host complet
// (project ref), ni username, ni mot de passe — seulement des booléens et
// une classification du host.
function classifyHost(hostname: string): DbUrlDiagnostic["hostKind"] {
  if (hostname.endsWith("pooler.supabase.com")) return "supabase-pooler";
  if (hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com"))
    return "supabase-direct";
  if (hostname === "localhost" || hostname === "127.0.0.1") return "localhost";
  return "other";
}

function analyzeDatabaseUrl(url: string | undefined): DbUrlDiagnostic | null {
  if (!url) return null;
  const atSymbolCount = (url.match(/@/g) || []).length;
  let parseable = false;
  let scheme: string | null = null;
  let hostKind: DbUrlDiagnostic["hostKind"] = null;
  let port: string | null = null;
  let hasUsername = false;
  let hasPassword = false;
  let queryKeys: string[] = [];
  try {
    const parsed = new URL(url);
    parseable = true;
    scheme = parsed.protocol.replace(":", "") || null;
    hostKind = classifyHost(parsed.hostname);
    port = parsed.port || null;
    hasUsername = Boolean(parsed.username);
    hasPassword = Boolean(parsed.password);
    queryKeys = Array.from(parsed.searchParams.keys());
  } catch {
    parseable = false;
  }
  return {
    present: true,
    parseable,
    scheme,
    hostKind,
    port,
    hasUsername,
    hasPassword,
    atSymbolCount,
    queryKeys,
  };
}

// Famille d'erreur dérivée du nom d'erreur + motifs du message. Les motifs
// ne servent qu'à CLASSIFIER : aucun fragment du message n'est renvoyé.
function classifyDbError(e: unknown): DbErrorKind {
  const name =
    e && typeof e === "object" && "name" in e && typeof e.name === "string"
      ? e.name
      : "";
  const message =
    e instanceof Error ? `${e.name}: ${e.message}`.toLowerCase() : "";

  // URL de connexion refusée/mal formée par le moteur Prisma (engine error
  // sans code P1xxx) — motifs observés : "invalid connection string",
  // "malformed", "error parsing connection string", "invalid url".
  if (
    /malformed|invalid\s+(connection\s+string|url|dsn)|parsing\s+connection/.test(
      message,
    )
  ) {
    return "url-malformed";
  }
  if (
    /authentication|password|28p01|role .* does not exist|permission denied/.test(
      message,
    )
  ) {
    return "auth";
  }
  if (/too many connections|max_connections|connection_limit/.test(message)) {
    return "too-many-connections";
  }
  if (
    /ssl|tls|certificate|self[- ]signed/.test(message) &&
    !/sslmode/.test(message)
  ) {
    return "tls";
  }
  if (/timed?\s*out|timeout|etimedout/.test(message)) {
    return "timeout";
  }
  if (
    /getaddrinfo|enotfound|econnrefused|econnreset|can't reach|unable to open|p1001|failed to connect/.test(
      message,
    )
  ) {
    return "dns-network";
  }
  if (/prepared statement|pstmt|26000/.test(message)) {
    return "prepared-statements";
  }
  if (
    name.includes("PrismaClientInitializationError") ||
    name.includes("PrismaClientUnknownRequestError")
  ) {
    return "unknown";
  }
  return "unknown";
}

function buildHint(
  hasDatabaseUrl: boolean,
  urlInfo: DbUrlDiagnostic | null,
  code: string | null,
  kind: DbErrorKind,
): string {
  if (!hasDatabaseUrl) {
    return "DATABASE_URL absente — ajoutez-la dans Vercel → Settings → Environment Variables (Production + Preview) puis redéployez. Format : voir .ai/DEPLOY_VERCEL.md";
  }
  // Problèmes de structure détectés AVANT toute interprétation de l'erreur.
  if (urlInfo) {
    if (!urlInfo.parseable) {
      return "DATABASE_URL non parsable — vérifiez guillemets (ne JAMAIS coller les `\"` dans Vercel), espaces, retour à la ligne. Format : postgresql://postgres.<REF>:<MOT_DE_PASSE>@<HOST-POOLER>:5432/postgres?sslmode=require";
    }
    if (urlInfo.atSymbolCount > 1) {
      return `DATABASE_URL contient ${urlInfo.atSymbolCount} '@' — si le mot de passe contient @, il doit être encodé URL (%40). Sinon vérifiez que la chaîne n'a pas été tronquée/collée deux fois`;
    }
    if (!urlInfo.hasPassword) {
      return "DATABASE_URL sans mot de passe — format attendu : postgresql://postgres.<REF>:<MOT_DE_PASSE>@aws-<N>-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require";
    }
    if (urlInfo.hostKind === "supabase-direct") {
      return "Host DIRECT Supabase détecté (db.<ref>.supabase.co) — IPv6-only, injoignable depuis Vercel (IPv4). Utilisez le POOLER : aws-<N>-<REGION>.pooler.supabase.com (Supabase → Connect → Connection pooling)";
    }
    if (urlInfo.hostKind === "localhost") {
      return "Host localhost détecté en production — utilisez le pooler Supabase : aws-<N>-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require";
    }
    if (urlInfo.scheme && !urlInfo.scheme.startsWith("postgres")) {
      return `Schéma « ${urlInfo.scheme} » inattendu — Prisma attend postgresql:// (ou postgres://)`;
    }
  }
  if (kind === "url-malformed") {
    return "Chaîne de connexion refusée par le driver — cause la plus fréquente : mot de passe avec caractères spéciaux (@ # / : %) non encodés URL. Réinitialisez un mot de passe simple alphanumérique (Supabase → Settings → Database) ou encodez chaque caractère spécial";
  }
  if (code === "P1001" || kind === "dns-network" || kind === "timeout") {
    return "Base injoignable — vérifiez le host pooler Supabase (aws-…-*.pooler.supabase.com), le port (5432 session / 6543 transaction), sslmode=require, et que le projet Supabase n'est pas en pause";
  }
  if (code === "P1010" || code === "28P01" || kind === "auth") {
    return "Accès refusé — vérifiez le mot de passe PostgreSQL (connexions pooler : postgres.<PROJECT_REF>) ou l'allowlist IP du projet Supabase";
  }
  if (code === "P2021" || code === "42P01" || kind === "missing-table") {
    return "Table manquante — les migrations Supabase n'ont pas été appliquées sur cette base (bun run db:migrate-deploy)";
  }
  if (kind === "too-many-connections") {
    return "Trop de connexions — passez en transaction mode port 6543 avec pgbouncer=true&connection_limit=1 (option B de .ai/DEPLOY_VERCEL.md)";
  }
  if (kind === "tls") {
    return "Erreur TLS — ajoutez sslmode=require à la fin de DATABASE_URL";
  }
  if (kind === "prepared-statements") {
    return "Prepared statements incompatibles avec le pooler — ajoutez pgbouncer=true à DATABASE_URL (transaction mode 6543)";
  }
  if (code) {
    return `Erreur DB code ${code} — consultez les logs Vercel (onglet Logs, fonction /api/health)`;
  }
  return "Erreur DB sans code — consultez les logs Vercel (fonction /api/health) ; le champ dbErrorKind précise la famille";
}

export async function GET() {
  let database: "up" | "down" = "down";
  let diagnostic: HealthDiagnostic = {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    dbUrl: analyzeDatabaseUrl(process.env.DATABASE_URL),
    dbErrorCode: null,
    dbErrorKind: "unknown",
    dbHint: null,
  };

  try {
    await db.$queryRawUnsafe("SELECT 1");
    database = "up";
  } catch (e) {
    console.error("[health] probe DB échouée:", e);
    const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
    const urlInfo = analyzeDatabaseUrl(process.env.DATABASE_URL);
    const code = extractDbErrorCode(e);
    const kind = classifyDbError(e);
    diagnostic = {
      hasDatabaseUrl,
      dbUrl: urlInfo,
      dbErrorCode: code,
      dbErrorKind: kind,
      dbHint: buildHint(hasDatabaseUrl, urlInfo, code, kind),
    };
  }

  return NextResponse.json({
    status: database === "up" ? "ok" : "degraded",
    database,
    timestamp: new Date().toISOString(),
    // Bloc additif (v4) : les consommateurs historiques lisent status/database.
    diagnostic,
  });
}
