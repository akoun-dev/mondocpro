import { PrismaClient } from '@prisma/client'

// ——— Connexion base « serverless-safe » (Task 48, ADR-011) ———
// La chaîne fournie vise le POOLER DE SESSION Supabase (port 5432) : chaque
// instance de fonction Vercel y garde des connexions DÉDIÉES ouvertes tant
// qu'elle reste chaude — à quelques instances le plafond du pooler saute
// (FATAL EMAXCONNSESSION, pool_size 15) et TOUTES les routes DB renvoient
// alors des 500 intermittents puis persistants (wallet, RDV…), tandis que
// le serveur dev, dont les sessions sont déjà établies, continue de
// fonctionner — d'où un bug invisible en local et bloquant en production.
//
// Décision : en production (NODE_ENV=production — Vercel), basculer
// AUTOMATIQUEMENT vers le pooler de TRANSACTION (port 6543), qui multiplexe
// de nombreux clients sur peu de connexions serveur, avec :
//  - `pgbouncer=true` : Prisma désactive son cache de statements préparés —
//    prérequis du mode transaction (sinon « prepared statement s0 already
//    exists » aléatoire) ;
//  - `connection_limit=1` : une seule connexion par instance — c'est le
//    montage recommandé Supabase × Vercel ;
//  - `pool_timeout=20` : tolérance d'attente généreuse avant échec.
// Idempotent : si la variable d'environnement vise déjà 6543, elle est
// laissée telle quelle (le PO peut aussi corriger la var Vercel directement,
// le code restera compatible). Dev (serveur longue durée) reste sur 5432.
export function serverlessSafeDatasourceUrl(
  raw: string | undefined,
  isProduction = process.env.NODE_ENV === 'production',
): string | undefined {
  if (!raw) return raw
  try {
    const url = new URL(raw)
    const isSupabaseSessionPooler =
      url.hostname.endsWith('.pooler.supabase.com') && url.port === '5432'
    if (!isSupabaseSessionPooler || !isProduction) return raw
    url.port = '6543'
    url.searchParams.set('pgbouncer', 'true')
    url.searchParams.set('connection_limit', '1')
    url.searchParams.set('pool_timeout', '20')
    return url.toString()
  } catch {
    return raw
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
    datasources: {
      db: { url: serverlessSafeDatasourceUrl(process.env.DATABASE_URL) },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
