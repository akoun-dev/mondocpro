import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  await db.$queryRaw`SELECT 1`
  const [users, posts] = [await db.user.count(), await db.post.count()]
  console.log(JSON.stringify({ ok: true, roundtrip: 'SELECT 1 OK', tables: { User: users, Post: posts } }))
  await db.$disconnect()
}
main().catch((e) => { console.error('ECHEC:', e.message); process.exit(1) })
