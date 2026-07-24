import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./data/mms.db'
// Set for a remote libsql/Turso database (serverless deploys — e.g. Vercel —
// can't use a local file). Undefined for a local `file:` URL, which is fine.
const authToken = process.env.DATABASE_AUTH_TOKEN

// libsql: a local file (SQLite-compatible, WAL) in dev, or a remote Turso DB
// over HTTP when DATABASE_URL is libsql://…. A single client is reused across
// the app; Next.js hot-reload safety via a global cache in dev.
const globalForDb = globalThis as unknown as {
  __mmsClient?: ReturnType<typeof createClient>
}

// timeout = SQLite busy-timeout (ms) for the local file. Each write transaction
// runs BEGIN IMMEDIATE and takes its own connection, so overlapping writers
// contend for the single write lock; without a busy-timeout the loser gets
// SQLITE_BUSY immediately. 5s lets a contending writer wait its turn. (On remote
// Turso the server serialises writes, so this is a harmless no-op there.)
const client =
  globalForDb.__mmsClient ?? createClient({ url, authToken, timeout: 5000 })
if (process.env.NODE_ENV !== 'production') globalForDb.__mmsClient = client

export const db = drizzle(client, { schema })
export { schema }
