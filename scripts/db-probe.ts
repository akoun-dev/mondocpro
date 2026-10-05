// Sonde ponctuelle : pool SESSION 5432 (celui du runtime) vs TRANSACTION 6543.
import { PrismaClient } from "@prisma/client";
const url = process.env.DATABASE_URL as string;
async function probe(label: string, target: string) {
  const db = new PrismaClient({ datasources: { db: { url: target } } });
  try {
    await db.user.count();
    console.log(label, "OK");
  } catch (e) {
    console.log(label, "KO:", e instanceof Error ? e.message.slice(0, 160) : String(e).slice(0, 160));
  } finally { await db.$disconnect(); }
}
await probe("5432 session  ", url + (url.includes("?") ? "&" : "?") + "connect_timeout=10&connection_limit=1");
const txUrl = url.replace(":5432/", ":6543/") + (url.includes("?") ? "&" : "?") + "pgbouncer=true&connection_limit=1";
await probe("6543 transaction", txUrl);
