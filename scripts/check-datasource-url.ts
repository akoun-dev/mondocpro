// Vérification unitaire du normalisateur d'URL (Task 48).
import {
  serverlessSafeDatasourceUrl,
} from "../src/lib/db";

const SESSION =
  "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require";
const DIRECT =
  "postgresql://postgres.abc:secret@db.abc.supabase.co:5432/postgres?sslmode=require";
const TXN =
  "postgresql://postgres.abc:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — obtenu: ${actual}`}`);
}

// Prod (isProduction=true) : 5432 → 6543 + paramètres Prisma/Supabase
const prod = serverlessSafeDatasourceUrl(SESSION, true) ?? "";
const pu = new URL(prod);
check("prod: port 6543", pu.port, "6543");
check("prod: pgbouncer=true", pu.searchParams.get("pgbouncer"), "true");
check("prod: connection_limit=1", pu.searchParams.get("connection_limit"), "1");
check("prod: pool_timeout=20", pu.searchParams.get("pool_timeout"), "20");
check(
  "prod: sslmode préservé",
  pu.searchParams.get("sslmode"),
  "require",
);
check("prod: hôte inchangé", pu.hostname, "aws-0-eu-west-1.pooler.supabase.com");

// Dev (isProduction=false) : URL intacte
check("dev: session 5432 inchangée", serverlessSafeDatasourceUrl(SESSION, false), SESSION);

// URL déjà en 6543 : idempotent
check("déjà 6543: intacte", serverlessSafeDatasourceUrl(TXN, true), TXN);

// Base directe (non-pooler) : intacte même en prod
check("directe: intacte", serverlessSafeDatasourceUrl(DIRECT, true), DIRECT);

// undefined / URL invalide : pas de crash
check("undefined", serverlessSafeDatasourceUrl(undefined, true), undefined);
check(
  "URL invalide: renvoyée telle quelle",
  serverlessSafeDatasourceUrl("file:/home/z/my-project/db/custom.db", true),
  "file:/home/z/my-project/db/custom.db",
);

if (failures > 0) {
  console.error(`\n${failures} vérification(s) en échec`);
  process.exit(1);
}
console.log("\nToutes les vérifications passent.");
