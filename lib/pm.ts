import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  pmSchedules,
  workOrders,
  workOrderStatusHistory,
  checklistItems,
  machines,
} from "@/lib/db/schema";

// PM work orders are generated this many days ahead of their due date (E4-S2).
const HORIZON_DAYS = 7;

// Local-midnight date `days` after `base` — day-granular, matching how manual
// due dates are stored, so the queue's overdue logic treats PM jobs identically.
export function addLocalDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

// A schedule's checklist template is a JSON array of step strings. Parse safely
// (bad/blank JSON → no steps) and trim.
export function parseChecklistTemplate(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr
          .filter((s) => typeof s === "string" && s.trim())
          .map((s: string) => s.trim())
      : [];
  } catch {
    return [];
  }
}

const isUnique = (e: unknown) => /unique/i.test(String(e));
const isBusy = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  "code" in e &&
  (e as { code?: string }).code === "SQLITE_BUSY";

// Invariant #3 — idempotent PM generation. For every active schedule on a live
// machine whose next due date falls within the horizon, create ONE work order
// for that due date, unless one already exists. The (pmScheduleId, dueDate)
// unique index makes a re-run, a double tick after a restart, and catch-up after
// downtime the SAME safe code path. Next due only advances on completion (E4-S3),
// so there's at most one open PM job per schedule and a missed cycle keeps its
// original (now-overdue) due date. Returns how many jobs were created.
export async function generateDuePmWorkOrders(
  now: Date = new Date(),
): Promise<number> {
  const horizon = addLocalDays(now, HORIZON_DAYS);
  const dueSchedules = await db
    .select({
      id: pmSchedules.id,
      machineId: pmSchedules.machineId,
      title: pmSchedules.title,
      nextDueDate: pmSchedules.nextDueDate,
      defaultAssigneeId: pmSchedules.defaultAssigneeId,
      checklistTemplate: pmSchedules.checklistTemplate,
      createdBy: pmSchedules.createdBy,
    })
    .from(pmSchedules)
    .innerJoin(machines, eq(pmSchedules.machineId, machines.id))
    .where(
      and(
        eq(pmSchedules.paused, false),
        isNull(machines.retiredAt),
        lte(pmSchedules.nextDueDate, horizon),
      ),
    );

  let created = 0;
  for (const s of dueSchedules) {
    if (await generateOne(s)) created++;
  }
  return created;
}

type DueSchedule = {
  id: number;
  machineId: number;
  title: string;
  nextDueDate: Date;
  defaultAssigneeId: number | null;
  checklistTemplate: string | null;
  createdBy: number | null;
};

async function generateOne(s: DueSchedule): Promise<boolean> {
  try {
    return await db.transaction(async (tx) => {
      // One open PM job per schedule at a time (invariant #3): if this schedule
      // already has an open/in-progress generated job, don't create another —
      // even if the due date was since edited (which would otherwise slip past a
      // date-keyed check). The (pmScheduleId, dueDate) unique index remains the
      // backstop against an exact duplicate under concurrency.
      const [openJob] = await tx
        .select({ id: workOrders.id })
        .from(workOrders)
        .where(
          and(
            eq(workOrders.pmScheduleId, s.id),
            inArray(workOrders.status, ["open", "in_progress"]),
          ),
        )
        .limit(1);
      if (openJob) return false;

      const [wo] = await tx
        .insert(workOrders)
        .values({
          title: s.title,
          machineId: s.machineId,
          priority: "medium",
          status: "open",
          assigneeId: s.defaultAssigneeId ?? null,
          dueDate: s.nextDueDate,
          source: "pm",
          pmScheduleId: s.id,
          createdBy: s.createdBy ?? null,
        })
        .returning({ id: workOrders.id });

      await tx.insert(workOrderStatusHistory).values({
        workOrderId: wo.id,
        fromStatus: null,
        toStatus: "open",
        actorId: s.createdBy ?? null,
        note: "PM-generated",
      });

      const steps = parseChecklistTemplate(s.checklistTemplate);
      if (steps.length) {
        await tx.insert(checklistItems).values(
          steps.map((text, i) => ({
            workOrderId: wo.id,
            position: i + 1,
            text,
            checked: false,
          })),
        );
      }
      return true;
    });
  } catch (e) {
    // Lost a race to a concurrent generator on the unique index, or hit write
    // contention — neither is an error; the next run catches up idempotently.
    if (isUnique(e) || isBusy(e)) return false;
    throw e;
  }
}

// E4-S3 — after a PM job is completed, its schedule's next due floats to
// completion date + interval (day-granular), so a PM done late doesn't trigger a
// pointless early repeat. The completed job keeps its own due date (late stays
// visible on the record). Called from completeWork.
export async function advanceScheduleAfterCompletion(
  pmScheduleId: number,
  completedAt: Date,
): Promise<void> {
  const [s] = await db
    .select({ intervalDays: pmSchedules.intervalDays })
    .from(pmSchedules)
    .where(eq(pmSchedules.id, pmScheduleId))
    .limit(1);
  if (!s) return;
  await db
    .update(pmSchedules)
    .set({
      nextDueDate: addLocalDays(completedAt, s.intervalDays),
      updatedAt: new Date(),
    })
    .where(eq(pmSchedules.id, pmScheduleId));
}
