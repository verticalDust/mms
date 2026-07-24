// Apply the Drizzle migrations in ./drizzle to a remote Turso database, using
// drizzle-orm's migrator directly (no drizzle-kit env-file juggling). Pair it
// with Node's --env-file so it reads the values Vercel's Turso integration
// pulled for you:
//
//   vercel env pull .env.development.local
//   node --env-file=.env.development.local scripts/migrate-turso.mjs
//   node --env-file=.env.development.local scripts/seed-turso.mjs
//
// Or set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (or DATABASE_URL / _AUTH_TOKEN)
// in the shell and drop the --env-file flag.

import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
const authToken =
  process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;

if (!url || url.startsWith("file:")) {
  console.error(
    "Set TURSO_DATABASE_URL/DATABASE_URL (and its token) to your remote Turso DB first.",
  );
  process.exit(1);
}

const db = drizzle(createClient({ url, authToken }));

migrate(db, { migrationsFolder: "./drizzle" })
  .then(() => {
    console.log(`Migrations applied to ${url}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
