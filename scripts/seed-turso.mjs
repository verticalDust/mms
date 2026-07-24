// Seed a Turso (remote libsql) database from the local dev SQLite file, so the
// hosted demo starts with real-looking data. Run AFTER `drizzle-kit migrate` has
// created the schema on the target. Re-runnable: it clears the target tables
// first, then copies.
//
// Usage (PowerShell):
//   $env:TURSO_DATABASE_URL="libsql://<db>.turso.io"
//   $env:TURSO_AUTH_TOKEN="<token>"
//   node scripts/seed-turso.mjs
//
// Skips transient/local-only rows: sessions + password_resets (users log in
// fresh) and photos (the image blobs don't exist on the target). Photo path
// columns are nulled for the same reason. All users' passwords are reset to a
// single known DEMO password so the hosted demo has predictable logins.

import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";

const SOURCE_URL = process.env.SOURCE_DATABASE_URL ?? "file:./data/mms.db";
// Target: accept either the Turso-integration names or the app's own names.
const DEST_URL = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
const DEST_TOKEN =
  process.env.TURSO_AUTH_TOKEN ?? process.env.DATABASE_AUTH_TOKEN;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "demo-mms-2026";

if (!DEST_URL || DEST_URL.startsWith("file:")) {
  console.error(
    "Set TURSO_DATABASE_URL/DATABASE_URL (and its token) to your remote Turso DB first.",
  );
  process.exit(1);
}

// Parents before children (FK-safe). Transient + photo rows are intentionally
// absent; photoPath columns are nulled on copy.
const ORDER = [
  "users",
  "settings",
  "machines",
  "downtime_periods",
  "parts",
  "machine_parts",
  "stock_movements",
  "pm_schedules",
  "reports",
  "work_orders",
  "wo_status_history",
  "work_order_parts",
  "checklist_items",
];
const NULL_COLUMNS = {
  machines: ["photo_path"],
  parts: ["photo_path"],
  reports: ["photo_path"],
};

const source = createClient({ url: SOURCE_URL });
const dest = createClient({ url: DEST_URL, authToken: DEST_TOKEN });

async function main() {
  // Clear the target (reverse FK order) so the seed is a clean reset.
  for (const table of [...ORDER].reverse()) {
    await dest.execute(`delete from ${table}`);
  }
  await dest.execute("delete from sessions");
  await dest.execute("delete from password_resets");
  await dest.execute("delete from photos");

  let total = 0;
  for (const table of ORDER) {
    const { rows } = await source.execute(`select * from ${table}`);
    const nulls = NULL_COLUMNS[table] ?? [];
    for (const row of rows) {
      for (const c of nulls) if (c in row) row[c] = null;
      const cols = Object.keys(row);
      const sql = `insert into ${table} (${cols
        .map((c) => `"${c}"`)
        .join(", ")}) values (${cols.map(() => "?").join(", ")})`;
      await dest.execute({ sql, args: cols.map((c) => row[c]) });
    }
    console.log(`  ${table}: ${rows.length}`);
    total += rows.length;
  }

  // Predictable demo logins: every seeded user shares DEMO_PASSWORD (roles still
  // differ — admin vs technician — to show RBAC).
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  await dest.execute({
    sql: "update users set password_hash = ?",
    args: [hash],
  });

  const { rows: users } = await dest.execute(
    "select email, role from users order by id",
  );
  console.log(`\nSeeded ${total} rows. Demo logins (password: ${DEMO_PASSWORD}):`);
  for (const u of users) console.log(`  ${u.email}  (${u.role})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
