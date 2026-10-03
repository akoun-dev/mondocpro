import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const c = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='appointments' AND column_name IN ('reminderSentAt','tokenState')`) as any[];
console.log("appointments (reminderSentAt/tokenState):", JSON.stringify(c.map((x:any)=>x.column_name)));
const users = await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "users"`) as any[];
console.log("users:", JSON.stringify(users));
const phones = await db.$queryRawUnsafe(`SELECT phone FROM "users" WHERE phone LIKE '%0709229992%' OR phone LIKE '%0700000001%'`) as any[];
console.log("comptes test présents:", JSON.stringify(phones));
await db.$disconnect();
