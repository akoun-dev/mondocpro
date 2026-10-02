// Fixture admin — réinitialisation du mot de passe du compte de démonstration
// Dr Kadjane (ADMIN) pour les tests E2E. Compte de démo documenté au worklog
// (Task 19) ; le PO le changera à la première connexion réelle.
// Usage : export DATABASE_URL=$(...) && bun scripts/reset-admin-fixture.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const ADMIN_PHONE = "+2250700000001";
const NEW_PASSWORD = "Admin#MonDocPro2026";

async function main() {
  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
  const admin = await db.user.update({
    where: { phone: ADMIN_PHONE },
    data: { passwordHash },
    select: { id: true, fullName: true, role: true },
  });
  // Hygiène : purge des sessions actives du compte (le changement de mot de
  // passe réel révoquera les sessions via la même mécanique phase 2).
  const sessions = await db.session.deleteMany({ where: { userId: admin.id } });
  console.log(
    `✓ ADMIN ${admin.fullName} (${admin.role}) — mot de passe réinitialisé, ${sessions.count} session(s) purgée(s)`,
  );
}

main()
  .catch(error => {
    console.error("Reset admin échoué:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
