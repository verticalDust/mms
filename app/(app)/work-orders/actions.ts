"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  workOrders,
  workOrderStatusHistory,
  workOrderParts,
  machines,
} from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import {
  issuePartToWorkOrder,
  reverseWorkOrderPart,
  StockError,
  insufficientMessage,
} from "@/lib/stock";

export type FormState = { error?: string };

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  machineId: z.coerce.number().int().positive("Pick a machine."),
  priority: z.enum(["low", "medium", "high", "critical"]),
  assigneeId: z.coerce.number().int().positive().optional(),
  dueDate: z.string().trim().optional(),
  description: z.string().trim().optional(),
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
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const [machine] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, parsed.data.machineId))
    .limit(1);
  if (!machine) return { error: "That machine no longer exists." };
  if (machine.retiredAt)
    return { error: "That machine is retired — you can't open work on it." };

  const due = parsed.data.dueDate
    ? new Date(parsed.data.dueDate + "T00:00:00")
    : null;

  const [row] = await db
    .insert(workOrders)
    .values({
      title: parsed.data.title,
      machineId: parsed.data.machineId,
      priority: parsed.data.priority,
      assigneeId: parsed.data.assigneeId ?? null,
      dueDate: due && !isNaN(due.getTime()) ? due : null,
      description: parsed.data.description || null,
      createdBy: user.id,
    })
    .returning({ id: workOrders.id });

  await logStatus(row.id, null, "open", user.id);
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  redirect(`/work-orders/${row.id}`);
}

export async function startWork(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:start");
  const id = Number(formData.get("workOrderId"));

  const [wo] = await db
    .select({ status: workOrders.status })
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
  revalidatePath("/dashboard");
}

export async function completeWork(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "work:complete");
  const id = Number(formData.get("workOrderId"));
  const note = String(formData.get("completionNote") ?? "").trim();

  const [wo] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo || (wo.status !== "in_progress" && wo.status !== "open")) return;

  await db
    .update(workOrders)
    .set({
      status: "done",
      completedAt: new Date(),
      completionNote: note || null,
      updatedAt: new Date(),
    })
    .where(eq(workOrders.id, id));
  await logStatus(id, wo.status, "done", user.id, note || undefined);
  revalidatePath(`/work-orders/${id}`);
  revalidatePath("/work-orders");
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
