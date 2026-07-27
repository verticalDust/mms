"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { pickLocale } from "./config";
import { setLocaleCookie } from "./server";

// Signed-in language switch: persist to the user's row (so it follows them to
// any device) AND mirror to the cookie (so the very next render — including
// pre-auth pages — agrees). revalidatePath purges every cached segment so the
// whole tree re-renders in the new locale. Works as a plain <form action>, no JS.
export async function switchLocale(formData: FormData): Promise<void> {
  const locale = pickLocale(String(formData.get("locale") ?? ""));
  const user = await getCurrentUser();
  if (user) {
    await db
      .update(users)
      .set({ locale, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }
  await setLocaleCookie(locale);
  revalidatePath("/", "layout");
}
