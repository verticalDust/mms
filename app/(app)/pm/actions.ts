"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { pmSchedules, workOrders, machines } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import { generateDuePmWorkOrders } from "@/lib/pm";

export type FormState = { error?: string };

// Textarea (one step per line) → trimmed JSON array, or null when empty.
function parseChecklistLines(raw: string): string | null {
  const steps = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
  return steps.length ? JSON.stringify(steps) : null;
}

const scheduleSchema = (t: Messages) =>
  z.object({
    title: z.string().trim().min(1, t.pm.errTitleRequired),
    intervalDays: z
      .coerce.number()
      .int()
      .min(1, t.pm.errIntervalMin)
      .max(3650, t.pm.errIntervalMax),
    nextDueDate: z.string().trim().min(1, t.pm.errPickDate),
    defaultAssigneeId: z.coerce.number().int().positive().optional(),
    checklist: z.string().optional(),
  });

async function requirePlanner() {
  const t = await getT();
  const user = await getCurrentUser();
  if (!user) return { user: null, error: t.common.notSignedIn };
  try {
    authorize(user, "pm:manage");
  } catch {
    return { user: null, error: t.pm.errOnlyPlanner };
  }
  return { user, error: undefined };
}

export async function createPmSchedule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, error } = await requirePlanner();
  if (!user) return { error };
  const t = await getT();

  const machineId = Number(formData.get("machineId"));
  if (!Number.isInteger(machineId)) return { error: t.common.machineGone };

  const parsed = scheduleSchema(t).safeParse({
    title: formData.get("title"),
    intervalDays: formData.get("intervalDays"),
    nextDueDate: formData.get("nextDueDate"),
    defaultAssigneeId: formData.get("defaultAssigneeId") || undefined,
    checklist: formData.get("checklist"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? t.common.checkForm };

  const [machine] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);
  if (!machine) return { error: t.common.machineGone };
  if (machine.retiredAt) return { error: t.pm.errMachineRetired };

  const due = new Date(parsed.data.nextDueDate + "T00:00:00");
  if (isNaN(due.getTime())) return { error: t.pm.errFirstDateInvalid };

  await db.insert(pmSchedules).values({
    machineId,
    title: parsed.data.title,
    intervalDays: parsed.data.intervalDays,
    nextDueDate: due,
    defaultAssigneeId: parsed.data.defaultAssigneeId ?? null,
    checklistTemplate: parseChecklistLines(parsed.data.checklist ?? ""),
    createdBy: user.id,
  });

  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/pm");
  redirect(`/machines/${machineId}`);
}

export async function updatePmSchedule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, error } = await requirePlanner();
  if (!user) return { error };
  const t = await getT();

  const id = Number(formData.get("scheduleId"));
  if (!Number.isInteger(id)) return { error: t.pm.errScheduleGone };

  const parsed = scheduleSchema(t).safeParse({
    title: formData.get("title"),
    intervalDays: formData.get("intervalDays"),
    nextDueDate: formData.get("nextDueDate"),
    defaultAssigneeId: formData.get("defaultAssigneeId") || undefined,
    checklist: formData.get("checklist"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? t.common.checkForm };

  const [existing] = await db
    .select({ machineId: pmSchedules.machineId })
    .from(pmSchedules)
    .where(eq(pmSchedules.id, id))
    .limit(1);
  if (!existing) return { error: t.pm.errScheduleGone };

  const due = new Date(parsed.data.nextDueDate + "T00:00:00");
  if (isNaN(due.getTime())) return { error: t.pm.errDateInvalid };

  await db
    .update(pmSchedules)
    .set({
      title: parsed.data.title,
      intervalDays: parsed.data.intervalDays,
      nextDueDate: due,
      defaultAssigneeId: parsed.data.defaultAssigneeId ?? null,
      checklistTemplate: parseChecklistLines(parsed.data.checklist ?? ""),
      updatedAt: new Date(),
    })
    .where(eq(pmSchedules.id, id));

  revalidatePath(`/machines/${existing.machineId}`);
  revalidatePath("/pm");
  redirect(`/machines/${existing.machineId}`);
}

export async function setPmPaused(formData: FormData): Promise<void> {
  const { user } = await requirePlanner();
  if (!user) throw new Error("FORBIDDEN");
  const id = Number(formData.get("scheduleId"));
  const paused = formData.get("paused") === "true";
  if (!Number.isInteger(id)) return;

  const [s] = await db
    .select({ machineId: pmSchedules.machineId })
    .from(pmSchedules)
    .where(eq(pmSchedules.id, id))
    .limit(1);
  if (!s) return;

  await db
    .update(pmSchedules)
    .set({ paused, updatedAt: new Date() })
    .where(eq(pmSchedules.id, id));
  revalidatePath(`/machines/${s.machineId}`);
  revalidatePath("/pm");
}

export async function deletePmSchedule(formData: FormData): Promise<void> {
  const { user } = await requirePlanner();
  if (!user) throw new Error("FORBIDDEN");
  const id = Number(formData.get("scheduleId"));
  if (!Number.isInteger(id)) return;

  const [s] = await db
    .select({ machineId: pmSchedules.machineId })
    .from(pmSchedules)
    .where(eq(pmSchedules.id, id))
    .limit(1);
  if (!s) return;

  // Keep any jobs this schedule already generated as history — just unlink them
  // (their source stays "pm") before removing the schedule, so the FK holds.
  await db.transaction(async (tx) => {
    await tx
      .update(workOrders)
      .set({ pmScheduleId: null })
      .where(eq(workOrders.pmScheduleId, id));
    await tx.delete(pmSchedules).where(eq(pmSchedules.id, id));
  });

  revalidatePath(`/machines/${s.machineId}`);
  revalidatePath("/pm");
}

export type GenerateState = { generated?: number; error?: string };

// Manual "generate due PM jobs now" (E4-S2) — the same idempotent function the
// daily cron calls, so clicking it twice never duplicates.
export async function generatePmNow(
  _prev: GenerateState,
  _formData: FormData,
): Promise<GenerateState> {
  const { user, error } = await requirePlanner();
  if (!user) return { error };

  const generated = await generateDuePmWorkOrders();
  revalidatePath("/pm");
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  return { generated };
}
