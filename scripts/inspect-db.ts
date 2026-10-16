// Inspection DB Task 14 — comptes, sessions, données métier.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const [users, sessions, senso, appointments] = await Promise.all([
  prisma.user.findMany({
    select: { fullName: true, phone: true, role: true, zone: true },
    orderBy: { createdAt: "asc" },
  }),
  prisma.session.count(),
  prisma.sensibilisation.count(),
  prisma.appointment.count(),
]);

console.log("USERS:", JSON.stringify(users, null, 1));
console.log("SESSIONS:", sessions);
console.log("SENSIBILISATIONS:", senso);
console.log("APPOINTMENTS:", appointments);
