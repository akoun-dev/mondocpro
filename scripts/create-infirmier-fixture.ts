// Fixtures E2E Task 14 — compte INFIRMIER (les comptes non-patients ne sont pas
// auto-inscriptibles : création ops via script, miroir de la réalité produit).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = await bcrypt.hash("TestInfirmier2026!", 10);
await prisma.user.upsert({
  where: { phone: "+2250755666777" },
  update: { passwordHash: hash, role: "INFIRMIER" },
  create: {
    fullName: "Infirmier Test E2E",
    phone: "+2250755666777",
    passwordHash: hash,
    role: "INFIRMIER",
    zone: "YOPOUGON",
  },
});
console.log("fixture INFIRMIER prête : +2250755666777 / TestInfirmier2026!");
