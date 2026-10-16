// Inspection brute de l'état réel du schéma PostgreSQL (Task 14).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name`,
);
console.log("TABLES PUBLIC:", tables.map((t) => t.table_name));

const migrations = await prisma.$queryRawUnsafe<{ version: string; name: string | null }[]>(
  `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version`,
);
console.log("SCHEMA_MIGRATIONS:", JSON.stringify(migrations, null, 1));

const enums = await prisma.$queryRawUnsafe<{ enum_name: string }[]>(
  `SELECT t.typname AS enum_name FROM pg_type t
   JOIN pg_enum e ON t.oid = e.enumtypid GROUP BY t.typname ORDER BY t.typname`,
);
console.log("ENUMS:", enums.map((e) => e.enum_name));
