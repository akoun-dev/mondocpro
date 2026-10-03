import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const t = await db.$queryRawUnsafe(`SELECT table_schema, table_name FROM information_schema.tables WHERE table_name IN ('token_transactions','notifications','appointments')`) as any[];
console.log(JSON.stringify(t));
await db.$disconnect();
