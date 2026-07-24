import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:./data/mms.db',
    // Set for a remote Turso DB; undefined (ignored) for a local file.
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
})
