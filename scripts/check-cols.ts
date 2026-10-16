import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const t = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='appointments' AND column_name IN ('tokenState','tokensReserved')`) as any[];
const e = await db.$queryRawUnsafe(`SELECT typname FROM pg_type WHERE typname IN ('AppointmentTokenState','TokenTransactionType','TokenTransactionStatus')`) as any[];
console.log("colonnes:", JSON.stringify(t), "types:", JSON.stringify(e));
await db.$disconnect();
