import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

const COOKIE = "mms_session";
const MAX_AGE_DAYS = 30;

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "technician";
  locale: "bg" | "en";
};

export async function createSession(userId: number): Promise<void> {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 24 * 3600 * 1000);
  await db.insert(sessions).values({ id, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    await db.delete(sessions).where(eq(sessions.id, id));
    jar.delete(COOKIE);
  }
}

// Wrapped in React.cache() so the many callers within one request (root layout,
// getLocale, the (app) layout's requireUser, each page) share a single DB read
// instead of re-querying. No behavioural change — just deduplication.
export const getCurrentUser = cache(
  async (): Promise<SessionUser | null> => {
    const jar = await cookies();
    const id = jar.get(COOKIE)?.value;
    if (!id) return null;

    const rows = await db
      .select({
        sessionExpires: sessions.expiresAt,
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        locale: users.locale,
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    if (row.sessionExpires.getTime() < Date.now()) {
      await db.delete(sessions).where(eq(sessions.id, id));
      return null;
    }
    if (!row.active) return null;

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      locale: row.locale,
    };
  },
);

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
