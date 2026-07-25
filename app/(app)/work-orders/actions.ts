"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  workOrders,
  workOrderStatusHistory,
  workOrderParts,
  checklistItems,
  downtimePeriods,
  machines,
  users,
  reports,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import {
  issuePartToWorkOrder,
  reverseWorkOrderPart,
  StockError,
  insufficientMessage,
} from "@/lib/stock";
import { formatDate } from "@/lib/format";
import { advanceScheduleAfterCompletion } from "@/lib/pm";

// `ok` lets a client editor (the plan editor) tell success from the initial
// blank state so it can collapse itself once the save lands.
export type FormState = { error?: string; ok?: boolean };

const PRIORITY_LABEL: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  machineId: z.coerce.number().int().positive("Pick a machine."),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assigneeId: z.coerce.number().int().positive().optional(),
  dueDate: z.string().trim().optional(),
  description: z.string().trim().optional(),
  // Set when triaging a report into a job (E5-S2): links the job and marks the
  // report handled. The machine then comes from the report, not the form.
  reportId: z.coerce.number().int().positive().optional(),
});

async function logStatus(
  workOrderId: number,
  from: string | null,
  to: string,
  actorId: number,
  note?: string,
) {
  await db.insert(workOrderStatusHistory).values({
    workOrderId,
    fromStatus: from,
    toStatus: to,
    actorId,
    note: note ?? null,
  });
}

export async function createWorkOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "work:create");
  } catch {
    return { error: "Only an admin can create work orders." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    machineId: formData.get("machineId"),
    priority: formData.get("priority") || "medium",
    assigneeId: formData.get("assigneeId") || undefined,
    dueDate: formData.get("dueDate"),
    description: formData.get("description"),
    reportId: formData.get("reportId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  // Triage path: the report must still be untriaged, and it — not the form —
  // decides the machine, so a report can't be linked to the wrong equipment.
  let report: { id: number; machineId: number } | null = null;
  if (parsed.data.reportId) {
    const [rep] = await db
      .select({
        id: reports.id,
        machineId: reports.machineId,
        status: reports.status,
      })
      .from(reports)
      .where(eq(reports.id, parsed.data.reportId))
      .limit(1);
    if (!rep) return { error: "That report no longer exists." };
    if (rep.status !== "new")
      return { error: "That report has already been handled." };
    report = { id: rep.id, machineId: rep.machineId };
  }

  const machineId = report ? report.machineId : parsed.data.machineId;
  const [machine] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);
  if (!machine) return { error: "That machine no longer exists." };
  if (machine.retiredAt)
    return { error: "That machine is retired — you can't open work on it." };

  // Due dates are day-granular. "T00:00:00" (no zone) stores SERVER-local
  // midnight; reads bucket in the factory timezone (lib/format). These agree for
  // any non-negative factory offset (the Bulgarian pilot on a UTC server), but a
  // negative-offset factory would need this written at factory midnight
  // (startOfDayEpoch) — and the same for updateWorkOrderPlan + PM's addLocalDays.
  // Tracked for a future non-EU rollout; see PLAN §4.
  const due = parsed.data.dueDate
    ? new Date(parsed.data.dueDate + "T00:00:00")
    : null;

  let newId: number;
  try {
    newId = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(workOrders)
        .values({
          title: parsed.data.title,
          machineId,
          priority: parsed.data.priority,
          assigneeId: parsed.data.assigneeId ?? null,
          dueDate: due && !isNaN(due.getTime()) ? due : null,
          description: parsed.data.description || null,
          source: report ? "report" : "manual",
          reportId: report ? report.id : null,
          createdBy: user.id,
        })
        .returning({ id: workOrders.id });

      await tx.insert(workOrderStatusHistory).values({
        workOrderId: row.id,
        fromStatus: null,
        toStatus: "open",
        actorId: user.id,
        note: report ? "From report" : null,
      });

      if (report) {
        // Flip only a STILL-new report; the guard + rowsAffected check make a
        // concurrent triage of the same report roll this whole job back rather
        // than leave a duplicate job orphaned from the report.
        const res = await tx
          .update(reports)
          .set({
            status: "handled",
            workOrderId: row.id,
            handledBy: user.id,
            handledAt: new Date(),
          })
          .where(and(eq(reports.id, report.id), eq(reports.status, "new")));
        if (res.rowsAffected === 0) throw new Error("REPORT_TAKEN");
      }
      return row.id;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "REPORT_TAKEN")
      return { error: "That report has already been handled." };
    if (isBusy(e)) return { error: "The queue is busy — try again." };
    throw e;
  }

  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath(`/machines/${machineId}`);
  if (report) revalidatePath("/reports");
  redirect(`/work-orders/${newId}`);
}

export async function startWork(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:start");
  const id = Number(formData.get("workOrderId"));

  const [wo] = await db
    .select({ status: workOrders.status, machineId: workOrders.machineId })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo || wo.status !== "open") return;

  await db
    .update(workOrders)
    .set({ status: "in_progress", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(workOrders.id, id));
  await logStatus(id, "open", "in_progress", user.id);
  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/my-work");
  revalidatePath("/dashboard");
  revalidatePath(`/machines/${wo.machineId}`);
}

export async function completeWork(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:complete");
  const id = Number(formData.get("workOrderId"));
  const note = String(formData.get("completionNote") ?? "").trim();

  // Optional time-spent in minutes (E3-S7). Blank/garbage/≤0 stores null.
  const minsRaw = String(formData.get("timeSpentMinutes") ?? "").trim();
  const mins = minsRaw ? Number(minsRaw) : NaN;
  const timeSpentMinutes =
    Number.isInteger(mins) && mins > 0 && mins < 100_000 ? mins : null;

  const [wo] = await db
    .select({
      status: workOrders.status,
      machineId: workOrders.machineId,
      source: workOrders.source,
      pmScheduleId: workOrders.pmScheduleId,
    })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo || (wo.status !== "in_progress" && wo.status !== "open")) return;

  const completedAt = new Date();
  await db
    .update(workOrders)
    .set({
      status: "done",
      completedAt,
      completionNote: note || null,
      timeSpentMinutes,
      updatedAt: completedAt,
    })
    .where(eq(workOrders.id, id));
  await logStatus(id, wo.status, "done", user.id, note || undefined);

  // E4-S3: completing a PM job floats its schedule's next due to completion +
  // interval, so a late PM doesn't trigger a pointless early repeat.
  if (wo.source === "pm" && wo.pmScheduleId != null) {
    await advanceScheduleAfterCompletion(wo.pmScheduleId, completedAt);
    revalidatePath(`/machines/${wo.machineId}`);
    revalidatePath("/pm");
  }

  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
  revalidatePath("/my-work");
  revalidatePath("/dashboard");
  revalidatePath(`/machines/${wo.machineId}`);
}

// ── Reassign / reschedule / reprioritize (E3-S9, planner-only) ───────────────

const updatePlanSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  assigneeId: z.coerce.number().int().positive().optional(), // "" → unassigned
  dueDate: z.string().trim().optional(), // "" → clear the date
  priority: z.enum(["low", "medium", "high", "critical"]),
});

export async function updateWorkOrderPlan(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "work:reassign");
  } catch {
    return { error: "Only a planner can reassign or reschedule a job." };
  }

  const parsed = updatePlanSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    assigneeId: formData.get("assigneeId") || undefined,
    dueDate: formData.get("dueDate"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { workOrderId, priority } = parsed.data;
  const newAssigneeId = parsed.data.assigneeId ?? null;

  // Blank clears the date; otherwise snap to local midnight like the create form.
  const rawDue = parsed.data.dueDate?.trim();
  let newDue: Date | null = null;
  if (rawDue) {
    const d = new Date(rawDue + "T00:00:00");
    if (isNaN(d.getTime())) return { error: "That due date isn't valid." };
    newDue = d;
  }

  const [wo] = await db
    .select({
      status: workOrders.status,
      machineId: workOrders.machineId,
      assigneeId: workOrders.assigneeId,
      dueDate: workOrders.dueDate,
      priority: workOrders.priority,
    })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) return { error: "That work order no longer exists." };
  // A closed job's plan is locked — its assignee and dates are history now.
  if (wo.status === "done" || wo.status === "cancelled")
    return { error: "This job is closed — its plan can't be changed." };

  // Names for the audit trail (an old assignee may be inactive — still name it).
  const oldName = await userName(wo.assigneeId);
  let newName: string;
  if (newAssigneeId == null) {
    newName = "Unassigned";
  } else if (newAssigneeId === wo.assigneeId) {
    // Unchanged assignee — keep it even if that person was since deactivated;
    // only a *new* assignment has to go to an active person.
    newName = oldName;
  } else {
    const [u] = await db
      .select({ name: users.name, active: users.active })
      .from(users)
      .where(eq(users.id, newAssigneeId))
      .limit(1);
    if (!u || !u.active) return { error: "Pick an active person to assign." };
    newName = u.name;
  }

  // Log one activity row per field that actually changed; nothing on a no-op.
  const events: { label: string; note: string }[] = [];
  if (wo.assigneeId !== newAssigneeId)
    events.push({ label: "reassigned", note: `${oldName} → ${newName}` });
  const oldDueMs = wo.dueDate ? wo.dueDate.getTime() : null;
  const newDueMs = newDue ? newDue.getTime() : null;
  if (oldDueMs !== newDueMs)
    events.push({
      label: "rescheduled",
      note: `${wo.dueDate ? formatDate(wo.dueDate) : "No date"} → ${
        newDue ? formatDate(newDue) : "No date"
      }`,
    });
  if (wo.priority !== priority)
    events.push({
      label: "reprioritized",
      note: `${PRIORITY_LABEL[wo.priority]} → ${PRIORITY_LABEL[priority]}`,
    });

  if (events.length === 0) return { ok: true }; // nothing changed

  // Update + activity rows in one transaction so a partial write can't leave the
  // job changed with the log missing (or vice-versa).
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(workOrders)
        .set({
          assigneeId: newAssigneeId,
          dueDate: newDue,
          priority,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.id, workOrderId));
      for (const ev of events) {
        await tx.insert(workOrderStatusHistory).values({
          workOrderId,
          fromStatus: wo.status,
          toStatus: ev.label,
          actorId: user.id,
          note: ev.note,
        });
      }
    });
  } catch (e) {
    // Rare write contention — the tx rolled back cleanly, so retry beats a 500.
    if (isBusy(e)) return { error: "The job is busy — try again." };
    throw e;
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/work-orders");
  revalidatePath("/my-work");
  revalidatePath("/dashboard");
  revalidatePath(`/machines/${wo.machineId}`);
  return { ok: true };
}

async function userName(id: number | null): Promise<string> {
  if (id == null) return "Unassigned";
  const [u] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return u?.name ?? "Unknown";
}

// ── Checklist on a job (E3-S5) ───────────────────────────────────────────────
// Authoring (add/remove steps) is a planner action; ticking is daily work any
// signed-in user does as they work the job. Both are locked once the job closes.

const addChecklistSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  text: z
    .string()
    .trim()
    .min(1, "Enter a step.")
    .max(200, "Keep a step under 200 characters."),
});

export async function addChecklistItem(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "work:manage-checklist");
  } catch {
    return { error: "Only a planner can edit the checklist." };
  }

  const parsed = addChecklistSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the step." };
  }
  const { workOrderId, text } = parsed.data;

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) return { error: "That work order no longer exists." };
  if (wo.status === "done" || wo.status === "cancelled")
    return { error: "This job is closed — its checklist is locked." };

  // Append after the current last step.
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${checklistItems.position}), 0)` })
    .from(checklistItems)
    .where(eq(checklistItems.workOrderId, workOrderId));

  await db.insert(checklistItems).values({
    workOrderId,
    position: Number(maxPos) + 1,
    text,
    checked: false,
  });

  revalidatePath(`/work-orders/${workOrderId}`);
  return { ok: true };
}

export async function removeChecklistItem(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:manage-checklist");
  const itemId = Number(formData.get("itemId"));
  const workOrderId = Number(formData.get("workOrderId"));
  if (!Number.isInteger(itemId) || !Number.isInteger(workOrderId)) return;

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo || wo.status === "done" || wo.status === "cancelled") return;

  await db
    .delete(checklistItems)
    .where(
      and(
        eq(checklistItems.id, itemId),
        eq(checklistItems.workOrderId, workOrderId),
      ),
    );
  revalidatePath(`/work-orders/${workOrderId}`);
}

// Ticking saves immediately with actor + time (untick clears both). Called
// directly from the client checkbox, so it takes typed args, not FormData, and
// returns { ok } so the optimistic box can revert (not crash) on a failed write.
export async function toggleChecklistItem(
  itemId: number,
  checked: boolean,
): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:check");
  if (!Number.isInteger(itemId)) return { ok: false };

  const [row] = await db
    .select({
      workOrderId: checklistItems.workOrderId,
      status: workOrders.status,
    })
    .from(checklistItems)
    .innerJoin(workOrders, eq(checklistItems.workOrderId, workOrders.id))
    .where(eq(checklistItems.id, itemId))
    .limit(1);
  // A closed job's checklist is frozen — the record of what was done stays put.
  if (!row || row.status === "done" || row.status === "cancelled")
    return { ok: false };

  try {
    await db
      .update(checklistItems)
      .set({
        checked,
        checkedBy: checked ? user.id : null,
        checkedAt: checked ? new Date() : null,
      })
      .where(eq(checklistItems.id, itemId));
  } catch (e) {
    // Rare write contention — report it so the box reverts, no crash (matches
    // the graceful SQLITE_BUSY handling on the parts actions).
    if (isBusy(e)) return { ok: false };
    throw e;
  }
  revalidatePath(`/work-orders/${row.workOrderId}`);
  revalidatePath("/my-work");
  return { ok: true };
}

// ── Breakdown → close downtime (E3-S8) ───────────────────────────────────────
// Finishing a breakdown job can end the machine's downtime in one tap. Closing
// is the same status change as the machine page's "Running" (machine:set-status),
// but here it also links the period to the job that fixed it.
export async function resolveDowntimeForJob(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:set-status");
  const workOrderId = Number(formData.get("workOrderId"));
  if (!Number.isInteger(workOrderId)) return;

  const [wo] = await db
    .select({ machineId: workOrders.machineId, status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) return;
  // Only a finished job closes downtime (the prompt is a post-Done affordance).
  if (wo.status !== "done") return;
  // A job links at most one period — a stale/duplicate tap after a *second*
  // breakdown must not re-attribute another stoppage to this same job.
  const [alreadyLinked] = await db
    .select({ id: downtimePeriods.id })
    .from(downtimePeriods)
    .where(eq(downtimePeriods.workOrderId, workOrderId))
    .limit(1);
  if (alreadyLinked) return;

  const now = new Date();
  const nowMs = now.getTime();
  // One atomic statement scoped to the open period: closes it, stamps duration
  // from the period's own start, and links this job. `ended_at is null` in the
  // filter means a concurrent close (or a second tap) can't double-close or
  // relink — downtime stays single-sourced in the period (invariant #2).
  try {
    await db
      .update(downtimePeriods)
      .set({
        endedAt: now,
        durationMs: sql`${nowMs} - ${downtimePeriods.startedAt}`,
        closedBy: user.id,
        workOrderId,
      })
      .where(
        and(
          eq(downtimePeriods.machineId, wo.machineId),
          isNull(downtimePeriods.endedAt),
        ),
      );
  } catch (e) {
    // Rare write contention — nothing changed, the prompt stays for a retry.
    if (isBusy(e)) return;
    throw e;
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/machines/${wo.machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}

// ── Parts used on a job (E3-S6) ──────────────────────────────────────────────

const addPartSchema = z.object({
  workOrderId: z.coerce.number().int().positive(),
  partId: z.coerce.number().int().positive("Pick a part."),
  quantity: z.coerce.number().int().min(1, "Enter a quantity of 1 or more."),
});

export async function addPartToJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "work:log-parts");
  } catch {
    return { error: "You don't have permission to log parts." };
  }

  const parsed = addPartSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    partId: formData.get("partId"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { workOrderId, partId, quantity } = parsed.data;

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) return { error: "That work order no longer exists." };
  if (wo.status === "done" || wo.status === "cancelled")
    return { error: "This job is closed — parts can only be logged on an open job." };

  try {
    await issuePartToWorkOrder({ workOrderId, partId, quantity, actorId: user.id });
  } catch (e) {
    if (e instanceof StockError) {
      if (e.code === "INSUFFICIENT") return { error: insufficientMessage(e) };
      if (e.code === "NOT_FOUND") return { error: "That part no longer exists." };
      return { error: e.message };
    }
    // Rare write contention — the tx rolled back cleanly, so retry beats a 500.
    if (isBusy(e)) return { error: "The stock ledger is busy — try again." };
    throw e;
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/parts/${partId}`);
  revalidatePath("/dashboard");
  redirect(`/work-orders/${workOrderId}`);
}

export async function removePartFromJob(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:log-parts");
  const lineId = Number(formData.get("lineId"));
  const workOrderId = Number(formData.get("workOrderId"));
  if (!Number.isInteger(lineId) || !Number.isInteger(workOrderId)) return;

  const [line] = await db
    .select({
      id: workOrderParts.id,
      partId: workOrderParts.partId,
      quantity: workOrderParts.quantity,
      movementId: workOrderParts.movementId,
      reversed: workOrderParts.reversed,
      woId: workOrderParts.workOrderId,
    })
    .from(workOrderParts)
    .where(eq(workOrderParts.id, lineId))
    .limit(1);
  // Line must exist, belong to this job, and still be active.
  if (!line || line.reversed || line.woId !== workOrderId) return;

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  // A closed job's parts are locked — the record of what was used stays put.
  if (!wo || wo.status === "done" || wo.status === "cancelled") return;

  try {
    await reverseWorkOrderPart({
      line: {
        id: line.id,
        partId: line.partId,
        quantity: line.quantity,
        movementId: line.movementId,
      },
      workOrderId,
      actorId: user.id,
    });
  } catch (e) {
    // Rare write contention — the line stays put; the tech can tap Remove again.
    if (isBusy(e)) return;
    throw e;
  }

  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath(`/parts/${line.partId}`);
  revalidatePath("/dashboard");
}

// libsql surfaces write contention as a LibsqlError with code SQLITE_BUSY.
function isBusy(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "SQLITE_BUSY"
  );
}
