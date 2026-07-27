"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  machines,
  downtimePeriods,
  pmSchedules,
  parts,
  machineParts,
} from "@/lib/db/schema";
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

const updateSchema = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, "Name is required."),
  code: z.string().trim().min(1, "Code is required."),
  location: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export async function updateMachine(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "machine:manage");
  } catch {
    return { error: "Only an admin can edit machines." };
  }

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    code: formData.get("code"),
    location: formData.get("location"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  try {
    await db
      .update(machines)
      .set({
        name: parsed.data.name,
        code: parsed.data.code,
        location: parsed.data.location || null,
        notes: parsed.data.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(machines.id, parsed.data.id));
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: `A machine with code ${parsed.data.code} already exists.` };
    }
    throw e;
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${parsed.data.id}`);
  redirect(`/machines/${parsed.data.id}`);
}

// Retire (E1-S6): leaves the default lists (searchMachines hides retired),
// history stays, new work orders are refused (createWorkOrder checks retiredAt),
// and PMs pause so generation stops. A retired machine is not "Down", so any
// open downtime period is closed here to keep invariant #2 consistent.
export async function retireMachine(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:manage");
  const machineId = Number(formData.get("machineId"));
  if (!Number.isInteger(machineId)) return;
  const now = new Date();
  const nowMs = now.getTime();

  // One transaction so "close every open period + pause PMs + set retiredAt"
  // commits atomically. Combined with markDown's atomic guarded insert, no
  // interleaving can leave an open downtime period on a retired machine (#2).
  await db.transaction(async (tx) => {
    await tx
      .update(downtimePeriods)
      .set({
        endedAt: now,
        durationMs: sql`${nowMs} - ${downtimePeriods.startedAt}`,
        closedBy: user.id,
        note: "Closed on machine retirement",
      })
      .where(
        and(
          eq(downtimePeriods.machineId, machineId),
          isNull(downtimePeriods.endedAt),
        ),
      );

    await tx
      .update(pmSchedules)
      .set({ paused: true, updatedAt: now })
      .where(eq(pmSchedules.machineId, machineId));

    await tx
      .update(machines)
      .set({ retiredAt: now, updatedAt: now })
      .where(eq(machines.id, machineId));
  });

  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}

// Bring a machine back into service. PM schedules stay paused — the planner
// re-enables them deliberately rather than having them silently resume.
export async function unretireMachine(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:manage");
  const machineId = Number(formData.get("machineId"));
  if (!Number.isInteger(machineId)) return;

  await db
    .update(machines)
    .set({ retiredAt: null, updatedAt: new Date() })
    .where(eq(machines.id, machineId));

  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}

// ── Machine parts / fitment (E2-S8/S9) ───────────────────────────────────────

const attachSchema = z.object({
  machineId: z.coerce.number().int().positive(),
  partId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().optional(),
});

export async function attachPart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "machine:manage");
  } catch {
    return { error: "Only an admin can attach parts." };
  }

  const parsed = attachSchema.safeParse({
    machineId: formData.get("machineId"),
    partId: formData.get("partId"),
    quantity: formData.get("quantity") || undefined,
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;

  const [machine] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, d.machineId))
    .limit(1);
  if (!machine) return { error: "That machine no longer exists." };
  if (machine.retiredAt)
    return { error: "That machine is retired. You can't attach parts to it." };

  const [part] = await db
    .select({ id: parts.id })
    .from(parts)
    .where(eq(parts.id, d.partId))
    .limit(1);
  if (!part) return { error: "That part no longer exists." };

  try {
    await db.insert(machineParts).values({
      machineId: d.machineId,
      partId: d.partId,
      // 0 means "unknown", same as blank — never store a "uses 0 of this part".
      quantity: d.quantity && d.quantity > 0 ? d.quantity : null,
      note: d.note || null,
      createdBy: user.id,
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: "That part is already on this machine." };
    }
    throw e;
  }

  revalidatePath(`/machines/${d.machineId}`);
  revalidatePath(`/parts/${d.partId}`);
  redirect(`/machines/${d.machineId}`);
}

// Unlink only — the part and its stock history are untouched (fitment ≠ usage).
export async function removePart(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:manage");
  const linkId = Number(formData.get("linkId"));
  const machineId = Number(formData.get("machineId"));
  const partId = Number(formData.get("partId"));
  if (!Number.isInteger(linkId)) return;

  await db.delete(machineParts).where(eq(machineParts.id, linkId));

  if (Number.isInteger(machineId)) revalidatePath(`/machines/${machineId}`);
  if (Number.isInteger(partId)) revalidatePath(`/parts/${partId}`);
}

async function requireStatusActor() {
  const user = await getCurrentUser();
  if (!user) throw new Error("FORBIDDEN");
  authorize(user, "machine:set-status");
  return user;
}

// A retired machine has no running/down state (getMachineStatus returns
// "retired"). Guard the status actions server-side so a stale page — the detail
// view hides these controls when retired, but the action must enforce it — can't
// open a downtime period on a retired machine and leave it dangling (invariant #2).
async function machineIsRetired(machineId: number): Promise<boolean> {
  const [m] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);
  return !m || Boolean(m.retiredAt);
}

export async function markDown(formData: FormData): Promise<void> {
  const user = await requireStatusActor();
  const machineId = Number(formData.get("machineId"));
  if (!Number.isInteger(machineId)) return;
  const nowMs = Date.now();

  // Open a downtime period only if none is open AND the machine isn't retired —
  // one atomic statement, so no read-then-write gap can leave an open period on
  // a retired machine (invariant #2), even under a concurrent retire. Subsumes
  // both the idempotency check and the retired guard.
  await db.run(sql`
    insert into downtime_periods (machine_id, started_at, opened_by, created_at)
    select ${machineId}, ${nowMs}, ${user.id}, ${nowMs}
    where not exists (
      select 1 from downtime_periods
      where machine_id = ${machineId} and ended_at is null
    )
    and exists (
      select 1 from machines where id = ${machineId} and retired_at is null
    )
  `);

  revalidatePath(`/machines/${machineId}`);
  revalidatePath("/machines");
  revalidatePath("/dashboard");
}

export async function markRunning(formData: FormData): Promise<void> {
  const user = await requireStatusActor();
  const machineId = Number(formData.get("machineId"));
  if (!Number.isInteger(machineId)) return;
  if (await machineIsRetired(machineId)) return;

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
