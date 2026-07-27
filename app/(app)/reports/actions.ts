"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { reports } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";

export type FormState = { error?: string; ok?: boolean };

const dismissSchema = (t: Messages) =>
  z.object({
    reportId: z.coerce.number().int().positive(),
    reason: z
      .string()
      .trim()
      .min(1, t.reports.errReasonRequired)
      .max(300, t.reports.errReasonTooLong),
  });

// Dismiss a report that isn't worth a work order (E5-S2). A reason is required
// so the triage decision is auditable — the report stays in history, it just
// leaves the queue. Planner-only (report:triage).
export async function dismissReport(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "report:triage");
  } catch {
    return { error: t.reports.errOnlyPlannerTriage };
  }

  const parsed = dismissSchema(t).safeParse({
    reportId: formData.get("reportId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.common.checkForm };
  }
  const { reportId, reason } = parsed.data;

  const [r] = await db
    .select({ status: reports.status })
    .from(reports)
    .where(eq(reports.id, reportId))
    .limit(1);
  if (!r) return { error: t.workOrders.errReportGone };
  // Only an untriaged report can be dismissed — a report already turned into a
  // job (or dismissed) is settled, and its link stays put.
  if (r.status !== "new")
    return { error: t.workOrders.errReportHandled };

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
    return { error: t.workOrders.errReportHandled };

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { ok: true };
}
