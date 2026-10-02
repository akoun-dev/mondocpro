// Nettoyage des comptes de test créés lors de la vérification E2E
// (Awa Traoré via UI, Test Injection via API). Sessions supprimées d'abord (FK).
import { PrismaClient } from "@prisma/client";

const TEST_PHONES = ["+2250701020344", "+225079998877"];

const prisma = new PrismaClient();

const sessions = await prisma.session.deleteMany({
  where: { user: { phone: { in: TEST_PHONES } } },
});
const users = await prisma.user.deleteMany({
  where: { phone: { in: TEST_PHONES } },
});

console.log(`sessions supprimées: ${sessions.count}, utilisateurs supprimés: ${users.count}`);
await prisma.$disconnect();
