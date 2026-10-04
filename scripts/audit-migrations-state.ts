// Sonde d'audit — état des migrations Supabase vs tables réelles (2026-10-03).
// Usage : DATABASE_URL=... bun scripts/audit-migrations-state.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
    const applied = await db.$queryRawUnsafe<{ version: string; name: string }[]>(
        `SELECT version, name
         FROM supabase_migrations.schema_migrations
         ORDER BY version DESC LIMIT 6`,
    );
    console.log("--- MIGRATIONS ENREGISTRÉES (6 dernières) ---");
    for (const m of applied) {
        console.log(`${m.version} | ${m.name}`);
    }

    const tables = await db.$queryRawUnsafe<{ tablename: string }[]>(
        `SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND tablename IN ('nurse_missions','visit_reports','sensibilisations','token_transactions','tariff_configs','notifications')
         ORDER BY tablename`,
    );
    console.log("--- TABLES RÉELLEMENT PRÉSENTES ---");
    console.log(tables.map(t => t.tablename).join(", ") || "AUCUNE");

    const enums = await db.$queryRawUnsafe<{ enumname: string }[]>(
        `SELECT t.typname AS enumname FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typname IN ('MissionStatus','NotificationType','SensibilisationCategory')
         ORDER BY t.typname`,
    );
    console.log("--- ENUMS PRÉSENTS ---");
    console.log(enums.map(e => e.enumname).join(", ") || "AUCUN");
}

main()
    .catch((e) => {
        console.error("ECHEC:", e instanceof Error ? e.message : e);
        process.exit(1);
    })
    .finally(() => db.$disconnect());
