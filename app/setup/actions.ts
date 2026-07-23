"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, settings } from "@/lib/db/schema";
import { hashPassword, passwordPolicyError } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { isSetupComplete } from "@/lib/setup";

export type FormState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z
    .string()
    .trim()
    .refine((v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Enter a valid email."),
  password: z.string(),
  factoryName: z.string().trim().min(1, "Enter the factory name."),
  timezone: z.string().trim().min(1, "Pick a timezone."),
});

export async function completeSetup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (await isSetupComplete()) redirect("/login");

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    factoryName: formData.get("factoryName"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const pwError = passwordPolicyError(parsed.data.password);
  if (pwError) return { error: pwError };

  const passwordHash = await hashPassword(parsed.data.password);
  const [admin] = await db
    .insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      role: "admin",
      active: true,
    })
    .returning({ id: users.id });

  await db.insert(settings).values({
    factoryName: parsed.data.factoryName,
    timezone: parsed.data.timezone,
  });

  await createSession(admin.id);
  redirect("/dashboard");
}
