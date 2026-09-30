/**
 * Test de bout en bout de la connexion base de données (Supabase PostgreSQL via Prisma).
 * Imposant la DATABASE_URL du .env (le shell sandbox exporte une valeur héritée qui prime).
 * Usage : bun .zscripts/test_db.ts
 */
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

// Charge DATABASE_URL depuis .env (surcharge l'export shell hérité du scaffold)
const envLine = readFileSync('.env', 'utf8')
  .split('\n')
  .find((l) => l.startsWith('DATABASE_URL='))
if (envLine) {
  const val = envLine.slice('DATABASE_URL='.length).replace(/^"|"$/g, '')
  process.env.DATABASE_URL = val
}

const db = new PrismaClient()

async function main() {
  await db.$queryRaw`SELECT 1`
  const [users, posts] = [await db.user.count(), await db.post.count()]
  const host = (process.env.DATABASE_URL ?? '').match(/@([^:]+):/)
  console.log(
    JSON.stringify({ ok: true, roundtrip: 'SELECT 1 OK', host: host?.[1] ?? '?', tables: { User: users, Post: posts } })
  )
  await db.$disconnect()
}

main().catch((e) => {
  console.error('ECHEC:', e.message.slice(0, 200))
  process.exit(1)
})
