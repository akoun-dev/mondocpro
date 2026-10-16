import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const e = await db.$queryRawUnsafe(`
  SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
  WHERE t.typname IN ('Role','Zone','AppointmentType','AppointmentStatus','SensibilisationCategory','NotificationType')
  GROUP BY t.typname ORDER BY t.typname`) as any[];
for (const row of e) console.log(row.typname, "=>", row.labels.join(","));
await db.$disconnect();
