"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { machines, downtimePeriods } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";

export type FormState = { error?: string };

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  code: z.string().trim().optional(),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

async function suggestCode(): Promise<string> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(machines);
  const n = (row?.c ?? 0) + 1;
  return `M-${String(n).padStart(3, "0")}`;
}

export async function createMachine(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "machine:manage");
  } catch {
    return { error: "Only an admin can add machines." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const code = parsed.data.code || (await suggestCode());

  let newId: number;
  try {
    const [row] = await db
      .insert(machines)
      .values({
        name: parsed.data.name,
        code,
        location: parsed.data.location || null,
        notes: parsed.data.notes || null,
        createdBy: user.id,
      })
      .returning({ id: machines.id });
    newId = row.id;
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `A machine with code ${code} already exists.` };
    }
    throw e;
  }

  revalidatePath("/machines");
  redirect(`/machines/${newId}`);
}

async function requireStatusActor() {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:set-status");
  return user;
}

export async function markDown(formData: FormData): Promise<void> {
  const user = await requireStatusActor();
  const machineId = Number(formData.get("machineId"));

  // Idempotent: only open a period if none is currently open (invariant #2).
  const [open] = await db
    .select({ id: downtimePeriods.id })
    .from(downtimePeriods)
    .where(
      and(
        eq(downtimePeriods.machineId, machineId),
        isNull(downtimePeriods.endedAt),
      ),
    )
    .limit(1);

  if (!open) {
    await db.insert(downtimePeriods).values({
      machineId,
      startedAt: new Date(),
      openedBy: user.id,
    });
  }
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}

export async function markRunning(formData: FormData): Promise<void> {
  const user = await requireStatusActor();
  const machineId = Number(formData.get("machineId"));

  const [open] = await db
    .select({ id: downtimePeriods.id, startedAt: downtimePeriods.startedAt })
    .from(downtimePeriods)
    .where(
      and(
        eq(downtimePeriods.machineId, machineId),
        isNull(downtimePeriods.endedAt),
      ),
    )
    .limit(1);

  if (open) {
    const ended = new Date();
    await db
      .update(downtimePeriods)
      .set({
        endedAt: ended,
        durationMs: ended.getTime() - open.startedAt.getTime(),
        closedBy: user.id,
      })
      .where(eq(downtimePeriods.id, open.id));
  }
  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}
