// Fixture FEATURE-TOKENS — création/suppression du patient E2E dédié.
// Chaque run E2E repart d'un compte NEUF (solde 0, aucun mouvement au
// ledger, aucun RDV actif) → assertions financières déterministes et
// répétabilité parfaite. La suppression est en CASCADE (sessions, RDV,
// notifications, transactions de Tokens) — zéro résidu en base.
// Usage :
//   bun scripts/tokens-fixture.ts create   → imprime PHONE=... PASSWORD=...
//   bun scripts/tokens-fixture.ts clean <phone>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const PASSWORD = "TestTokens2026!";
// 10 chiffres nationaux après +225 (préfixe mobile 07 + 8 chiffres) —
// le formulaire de login normalise le format LOCAL (cf. pièges API +225).
const PREFIX = "+22507";

async function main() {
  const mode = process.argv[2] ?? "create";

  if (mode === "clean") {
    const phone = process.argv[3];
    if (!phone) throw new Error("Usage: clean <phone>");
    const gone = await db.user.deleteMany({ where: { phone } });
    console.log(`clean: ${gone.count} utilisateur(s) supprimé(s) (${phone})`);
    return;
  }

  // create — numéro unique par run (8 chiffres aléatoires après +2250760)
  const phone = `${PREFIX}${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await db.user.create({
    data: {
      fullName: "Patient Tokens E2E",
      phone,
      passwordHash,
      role: "PATIENT",
      zone: "YOPOUGON",
    },
    select: { id: true, phone: true },
  });
  console.log(`PHONE=${user.phone}`);
  console.log(`PASSWORD=${PASSWORD}`);
  console.log(`USER_ID=${user.id}`);
}

main()
  .catch(error => {
    console.error("Fixture tokens échoué:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
