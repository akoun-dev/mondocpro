// Seed du compte Médecin Chef (ADMIN) — ADR-004 §5
// Usage : bun .zscripts/seed_admin.ts
// Idempotent : (re)crée le compte admin par son numéro, hash bcrypt.
// ⚠️ ADMIN_INITIAL_PASSWORD doit être changé par le PO à la première connexion.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Lit .env manuellement (immunisé à l'export shell hérité — cf. Task 5)
function loadEnv(): Record<string, string> {
  try {
    const raw = readFileSync(join(import.meta.dir, "..", ".env"), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => {
          const i = l.indexOf("=");
          return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

const env = loadEnv();
const url =
  env.DATABASE_URL ?? process.env.DATABASE_URL ?? "";
const prisma = new PrismaClient({ datasources: { db: { url } } });

const ADMIN_PHONE = "+2250700000001"; // Dr Kadjane — numéro de démonstration
const ADMIN_NAME = "Dr Kadjane";

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD || env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error("ADMIN_INITIAL_PASSWORD manquant ou < 8 caractères (voir .env)");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: { passwordHash, fullName: ADMIN_NAME },
    create: {
      fullName: ADMIN_NAME,
      phone: ADMIN_PHONE,
      passwordHash,
      role: "ADMIN",
      zone: "YOPOUGON",
    },
  });

  console.log(`✓ Admin seedé : ${admin.fullName} (${admin.phone}) role=${admin.role}`);
}

main()
  .catch((e) => {
    console.error("✗ Seed échoué :", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
