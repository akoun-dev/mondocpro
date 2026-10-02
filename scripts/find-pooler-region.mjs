// Recherche la région du pooler Supavisor pour le projet kxaralvrvlzaowwbsedo
// Teste une connexion PostgreSQL réelle (auth SASL) région par région.
import { execFile } from "node:child_process";

const REF = "kxaralvrvlzaowwbsedo";
const PASSWORD = "ovQcfBRin3jiCCJn";
const REGIONS = [
  "eu-west-1", "eu-west-2", "eu-west-3", "eu-central-1", "eu-central-2",
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2",
  "sa-east-1", "ca-central-1",
];
const PREFIXES = ["aws-1", "aws-0"];

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
  console.log(`\nREGION_TROUVEE: ${found.host}`);
  console.log(`postgresql://postgres.${REF}:${PASSWORD}@${found.host}:5432/postgres?sslmode=require`);
} else {
  console.log("\nAUCUNE_REGION_TROUVEE");
}
