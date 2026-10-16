import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const m = await db.$queryRawUnsafe(`SELECT migration_name, finished_at, applied_steps_count, logs IS NOT NULL AS has_logs FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 8`) as any[];
  console.log(JSON.stringify(m, null, 1));
} catch (e) { console.log("ERR:", (e as Error).message.slice(0, 300)); }
await db.$disconnect();
