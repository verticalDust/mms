"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";

export type FormState = { error?: string; ok?: boolean };

const dismissSchema = z.object({
  reportId: z.coerce.number().int().positive(),
  reason: z
    .string()
    .trim()
    .min(1, "Give a reason so the record explains itself.")
    .max(300, "Keep the reason under 300 characters."),
});

// Dismiss a report that isn't worth a work order (E5-S2). A reason is required
// so the triage decision is auditable — the report stays in history, it just
// leaves the queue. Planner-only (report:triage).
export async function dismissReport(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "report:triage");
  } catch {
    return { error: "Only a planner can triage reports." };
  }

  const parsed = dismissSchema.safeParse({
    reportId: formData.get("reportId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { reportId, reason } = parsed.data;

  const [r] = await db
    .select({ status: reports.status })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!r) return { error: "That report no longer exists." };
  // Only an untriaged report can be dismissed — a report already turned into a
  // job (or dismissed) is settled, and its link stays put.
  if (r.status !== "new")
    return { error: "This report has already been handled." };

  // The pre-check above is a courtesy message; the WHERE status='new' guard is
  // the real gate. Without it, a dismiss racing a concurrent create-WO could
  // clobber a just-handled report — leaving it 'dismissed' while still pointing
  // at a live work order. rowsAffected===0 means someone won the race first.
  const res = await db
    .update(reports)
    .set({
      status: "dismissed",
      dismissReason: reason,
      handledBy: user.id,
      handledAt: new Date(),
    })
    .where(and(eq(reports.id, reportId), eq(reports.status, "new")));
  if (res.rowsAffected === 0)
    return { error: "This report has already been handled." };

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { ok: true };
}
