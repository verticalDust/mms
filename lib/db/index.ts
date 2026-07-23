import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import * as schema from './schema'

const url = process.env.DATABASE_URL ?? 'file:./data/mms.db'

// libsql local file (SQLite-compatible, WAL). A single client is reused across
// the app; Next.js hot-reload safety via a global cache in dev.
const globalForDb = globalThis as unknown as {
  __mmsClient?: ReturnType<typeof createClient>
}

const client = globalForDb.__mmsClient ?? createClient({ url })
if (process.env.NODE_ENV !== 'production') globalForDb.__mmsClient = client

export const db = drizzle(client, { schema })
export { schema }
