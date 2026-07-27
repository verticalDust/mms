"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/setup";
import { getLocale, getT, setLocaleCookie } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

export type FormState = { error?: string };

const schema = (t: Messages) =>
  z.object({
    name: z.string().trim().min(1, t.setup.nameRequired),
    email: z
      .string()
      .trim()
      .refine(
        (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
        t.setup.emailInvalid,
      ),
    password: z.string(),
    factoryName: z.string().trim().min(1, t.setup.factoryNameRequired),
    timezone: z.string().trim().min(1, t.setup.timezoneRequired),
  });

export async function completeSetup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (await isSetupComplete()) redirect("/login");
  const t = await getT();

  const parsed = schema(t).safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    factoryName: formData.get("factoryName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.setup.checkForm };
  }

  const pwError = passwordPolicyError(parsed.data.password);
  if (pwError) return { error: t.setup.passwordTooShort(pwError.minLength) };

  // Honor a pre-setup language choice (the login/setup toggle writes the cookie
  // before any account exists) as the first admin's saved preference.
  const locale = await getLocale();

  const passwordHash = await hashPassword(parsed.data.password);
  const [admin] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: "admin",
      active: true,
      locale,
    })
    .returning({ id: users.id });

  await db.insert(settings).values({
    factoryName: parsed.data.factoryName,
    timezone: parsed.data.timezone,
  });

  await createSession(admin.id);
  await setLocaleCookie(locale);
  redirect("/dashboard");
}
