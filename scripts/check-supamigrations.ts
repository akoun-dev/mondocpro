import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const m = await db.$queryRawUnsafe(`SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 3`) as any[];
console.log("3 dernières migrations enregistrées:", JSON.stringify(m));
await db.$disconnect();
