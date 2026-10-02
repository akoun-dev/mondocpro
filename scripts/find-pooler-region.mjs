// SYS-010 — Re-découverte de la région du pooler Supavisor (projet kxaralvrvlzaowwbsedo).
// Contexte : Supabase peut migrer un projet entre flottes (aws-1 → aws-0 constaté
// le 2026-10-03), ce qui invalide la DATABASE_URL ("tenant/user not found").
// Teste une connexion PostgreSQL réelle (auth SASL) région par région.
//
// Modes :
//   bun scripts/find-pooler-region.mjs              → imprime REGION_TROUVEE + l'URL
//   bun scripts/find-pooler-region.mjs --write-env  → écrit en plus .env et
//                                                     .zscripts/.env.supabase (chmod 600)
// Utilisé par .zscripts/dev.sh comme auto-réparation au boot quand le backup
// non-versionné a été perdu par un rebuild conteneur.
import { execFile } from "node:child_process";
import { writeFileSync, chmodSync } from "node:fs";

const REF = "kxaralvrvlzaowwbsedo";
const PASSWORD = "ovQcfBRin3jiCCJn";
// Flotte aws-0 en tête : dernière flotte connue bonne (2026-10-03).
const PREFIXES = ["aws-0", "aws-1"];
const REGIONS = [
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "sa-east-1", "ca-central-1",
];

function tryPrisma(url) {
  return new Promise((resolve) => {
    const child = execFile(
      "bunx",
      ["prisma", "db", "execute", "--url", url, "--stdin"],
      { timeout: 25000 },
      (err) => resolve(!err),
    );
    child.stdin.write("SELECT 1;");
    child.stdin.end();
  });
}

let found = null;
for (const prefix of PREFIXES) {
  for (const region of REGIONS) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const url = `postgresql://postgres.${REF}:${PASSWORD}@${host}:5432/postgres?sslmode=require&connect_timeout=5&connection_limit=1`;
    process.stdout.write(`test ${host} ... `);
    const ok = await tryPrisma(url);
    console.log(ok ? "OK" : "echec");
    if (ok) { found = { prefix, region, host }; break; }
  }
  if (found) break;
}

if (found) {
  const cleanUrl = `postgresql://postgres.${REF}:${PASSWORD}@${found.host}:5432/postgres?sslmode=require`;
  console.log(`\nREGION_TROUVEE: ${found.host}`);
  console.log(cleanUrl);

  if (process.argv.includes("--write-env")) {
    const envContent = `# Mon doc Pro — environnement runtime\n# Régénéré automatiquement par scripts/find-pooler-region.mjs (SYS-010)\nDATABASE_URL="${cleanUrl}"\n`;
    writeFileSync(".env", envContent);
    writeFileSync(".zscripts/.env.supabase", envContent);
    chmodSync(".zscripts/.env.supabase", 0o600);
    console.log("ENV_ECRIT: .env + .zscripts/.env.supabase");
  }
} else {
  console.log("\nAUCUNE_REGION_TROUVEE");
  process.exit(1);
}
