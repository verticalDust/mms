import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

// Resolve the DB URL lazily (see the Proxy below): a remote libsql/Turso DB when
// DATABASE_URL is set (any serverless deploy — e.g. Vercel), the local SQLite
// file in dev. In production a missing URL is a hard error, not a silent fall
// back to a local file that can't exist on a read-only serverless filesystem.
function resolveUrl(): string {
  const url = process.env.DATABASE_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production')
    throw new Error(
      'DATABASE_URL is required in production — set your Turso database URL.',
    )
  return 'file:./data/mms.db'
}

function makeDb() {
  const client = createClient({
    url: resolveUrl(),
    // Set for a remote Turso DB; undefined (ignored) for a local file.
    authToken: process.env.DATABASE_AUTH_TOKEN,
    // SQLite busy-timeout (ms) for the local file: each write transaction runs
    // BEGIN IMMEDIATE and takes its own connection, so overlapping writers
    // contend for the single write lock; 5s lets a loser wait its turn instead
    // of getting SQLITE_BUSY. A no-op on remote Turso (the server serialises).
    timeout: 5000,
  })
  return drizzle(client, { schema })
}

type DB = ReturnType<typeof makeDb>
const globalForDb = globalThis as unknown as { __mmsDb?: DB }

// Lazy singleton via Proxy: the libsql client (and any connection) is created on
// the FIRST query, never at import — so `next build` collecting page data never
// opens a database connection (which broke the serverless build when it fell
// back to the local file). Cached on globalThis: HMR-safe in dev, and reused
// across requests in a warm serverless instance.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const inst = (globalForDb.__mmsDb ??= makeDb())
    const value = inst[prop as keyof DB]
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(inst)
      : value
  },
})

export { schema }
