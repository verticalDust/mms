"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { workOrders, workOrderStatusHistory, machines } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";

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
