import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./data/mms.db'

// libsql local file (SQLite-compatible, WAL). A single client is reused across
// the app; Next.js hot-reload safety via a global cache in dev.
const globalForDb = globalThis as unknown as {
  __mmsClient?: ReturnType<typeof createClient>
}

// timeout = SQLite busy-timeout (ms). Each write transaction runs BEGIN
// IMMEDIATE and takes its own connection, so overlapping writers contend for
// the single write lock; without a busy-timeout the loser gets SQLITE_BUSY
// immediately. 5s lets a contending writer wait its turn instead of erroring.
const client =
  globalForDb.__mmsClient ?? createClient({ url, timeout: 5000 })
if (process.env.NODE_ENV !== 'production') globalForDb.__mmsClient = client

export const db = drizzle(client, { schema })
export { schema }
