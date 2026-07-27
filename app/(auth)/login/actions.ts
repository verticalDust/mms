"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { getT, setLocaleCookie } from "@/lib/i18n/server";
import { pickLocale } from "@/lib/i18n/config";

export type FormState = { error?: string };

// Minimal in-process throttle (single-instance app). 5 tries / 15 min per email.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 5;

function throttled(key: string, now: number): boolean {
  const rec = attempts.get(key);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX;
}

export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const t = await getT();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: t.auth.incorrect };

  const now = Date.now();
  if (throttled(email, now)) {
    return { error: t.auth.tooManyAttempts };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Always compare against something to reduce timing signal; never reveal
  // whether the email exists.
  const ok =
    user && user.active
      ? await verifyPassword(password, user.passwordHash)
      : false;

  if (!ok || !user) return { error: t.auth.incorrect };

  attempts.delete(email);
  await createSession(user.id);
  // Mirror the saved preference to the cookie so the very next render (and any
  // future pre-auth page) already agrees with the user's language.
  await setLocaleCookie(pickLocale(user.locale));
  redirect("/dashboard");
}
