import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";

/** Setup is complete once the first Admin account exists. */
export async function isSetupComplete(): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  return (row?.count ?? 0) > 0;
}

export async function getSettings() {
  const rows = await db.select().from(settings).limit(1);
  return rows[0] ?? null;
}
