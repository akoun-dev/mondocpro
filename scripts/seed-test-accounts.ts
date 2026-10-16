// Seed des comptes de TEST E2E — idempotent (upsert par téléphone).
// La plateforme peut reprovisionner la base (cf. Task 26 : reprovision
// Supabase ayant perdu comptes de test + spécialités) ; ce seed + le seed
// spécialités rétablissent l'état attendu par toutes les suites E2E.
// Comptes : patient 0709229992 · infirmier 0755666777 · admin Dr Kadjane.
// Usage : bun scripts/seed-test-accounts.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const ACCOUNTS: {
  phone: string;
  fullName: string;
  password: string;
  role: "PATIENT" | "NURSE" | "ADMIN";
  zone: "YOPOUGON" | "SONGON" | "PK22" | "NDOTRE";
}[] = [
  {
    phone: "+2250709229992",
    fullName: "Patient Maquette UI",
    password: "TestPatient2026!",
    role: "PATIENT",
    zone: "YOPOUGON",
  },
  {
    phone: "+2250755666777",
    fullName: "Infirmier Maquette UI",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "YOPOUGON",
  },
  // ——— Annuaire Infirmiers — 10 comptes supplémentaires (démo / supervision) ———
  {
    phone: "+2250755000110",
    fullName: "Awa Traoré",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "SONGON",
  },
  {
    phone: "+2250755000111",
    fullName: "Kouassi Yao",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "PK22",
  },
  {
    phone: "+2250755000112",
    fullName: "Fatou Diallo",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "NDOTRE",
  },
  {
    phone: "+2250755000113",
    fullName: "Ibrahim Coulibaly",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "YOPOUGON",
  },
  {
    phone: "+2250755000114",
    fullName: "Mariam Koné",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "SONGON",
  },
  {
    phone: "+2250755000115",
    fullName: "Jean-Marc Abou",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "PK22",
  },
  {
    phone: "+2250755000116",
    fullName: "Aïcha Bamba",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "NDOTRE",
  },
  {
    phone: "+2250755000117",
    fullName: "Serge Gbagbo",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "YOPOUGON",
  },
  {
    phone: "+2250755000118",
    fullName: "Nadia Kouamé",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "SONGON",
  },
  {
    phone: "+2250755000119",
    fullName: "Paul Zadi",
    password: "TestInfirmier2026!",
    role: "NURSE",
    zone: "PK22",
  },
  {
    phone: "+2250700000001",
    fullName: "Dr Kadjane",
    password: "Admin#MonDocPro2026",
    role: "ADMIN",
    zone: "YOPOUGON",
  },
];

async function main() {
  for (const account of ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 10);
    await db.user.upsert({
      where: { phone: account.phone },
      update: { passwordHash, fullName: account.fullName, role: account.role, zone: account.zone },
      create: {
        phone: account.phone,
        fullName: account.fullName,
        passwordHash,
        role: account.role,
        zone: account.zone,
      },
    });
    console.log(`✓ ${account.role} ${account.fullName} (${account.phone})`);
  }
}

main()
  .catch(error => {
    console.error("Seed comptes de test échoué:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
