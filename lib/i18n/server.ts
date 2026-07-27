import { cache } from "react";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { LANG_COOKIE, pickLocale, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

// Server-side locale resolution. This module imports next/headers, so a stray
// client import fails the build — that's the guard keeping it server-only.
//
// Resolution order: the signed-in user's saved preference → the per-device
// cookie → Bulgarian. `cache()` memoizes per request, so the root layout,
// generateMetadata, the page, async status chips, and any server action all
// share one resolution (and one getCurrentUser lookup).

export const getLocale = cache(async (): Promise<Locale> => {
  const user = await getCurrentUser();
  if (user) return pickLocale(user.locale);
  const jar = await cookies();
  return pickLocale(jar.get(LANG_COOKIE)?.value);
});

export const getT = cache(async (): Promise<Messages> => {
  return getMessages(await getLocale());
});

// Writes the per-device pointer. Non-httpOnly so the client toggles can also set
// it via document.cookie. CALLABLE ONLY from server actions / route handlers —
// Next forbids cookie mutation during a Server Component render.
export async function setLocaleCookie(locale: Locale): Promise<void> {
  const jar = await cookies();
  jar.set(LANG_COOKIE, locale, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
