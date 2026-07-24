import {
  and,
  asc,
  eq,
  isNull,
  isNotNull,
  sql,
  inArray,
  notInArray,
  desc,
} from "drizzle-orm";
import { db } from "@/lib/db";
import { startOfLocalDay } from "@/lib/format";
import {
  machines,
  downtimePeriods,
  workOrders,
  workOrderParts,
  parts,
  machineParts,
  reports,
  users,
  photos,
  checklistItems,
  pmSchedules,
} from "@/lib/db/schema";

export type MachineStatus = "running" | "down" | "retired";

export type MachineListRow = {
  id: number;
  code: string;
  name: string;
  location: string | null;
  status: MachineStatus;
  downSince: Date | null;
};

// EntityList search over machines (E1-S2). Filters survive refresh because they
// live in the URL (the caller passes them through from searchParams). Scale is
// ~200 rows, so a LIKE scan + in-memory status filter is comfortably sub-1s.
export type MachineStatusFilter = "running" | "down" | "retired";

export async function searchMachines({
  q,
  status,
  location,
}: {
  q?: string;
  status?: MachineStatusFilter;
  location?: string;
} = {}): Promise<MachineListRow[]> {
  const conds = [
    // "Retired" is the only view that shows retired machines; every other view
    // is active-only (invariant: retired leaves the default lists — E1-S6).
    status === "retired"
      ? isNotNull(machines.retiredAt)
      : isNull(machines.retiredAt),
  ];
  if (location) conds.push(eq(machines.location, location));
  if (q && q.trim()) {
    // Escape LIKE metacharacters so a literal % or _ in the query matches
    // itself instead of acting as a wildcard (backslash is the escape char).
    const esc = q
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const like = `%${esc}%`;
    conds.push(
      sql`(lower(${machines.code}) like ${like} escape '\\' or lower(${machines.name}) like ${like} escape '\\' or lower(coalesce(${machines.location}, '')) like ${like} escape '\\')`,
    );
  }

  const rows = await db
    .select({
      id: machines.id,
      code: machines.code,
      name: machines.name,
      location: machines.location,
      retiredAt: machines.retiredAt,
      openDowntimeId: downtimePeriods.id,
      downSince: downtimePeriods.startedAt,
    })
    .from(machines)
    .leftJoin(
      downtimePeriods,
      and(
        eq(downtimePeriods.machineId, machines.id),
        isNull(downtimePeriods.endedAt),
      ),
    )
    .where(and(...conds))
    .orderBy(machines.code);

  let out: MachineListRow[] = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    location: r.location,
    status: (r.retiredAt
      ? "retired"
      : r.openDowntimeId
        ? "down"
        : "running") as MachineStatus,
    downSince: r.openDowntimeId ? r.downSince : null,
  }));

  // Running/Down are derived from the open-period join, so filter after mapping.
  if (status === "running") out = out.filter((r) => r.status === "running");
  else if (status === "down") out = out.filter((r) => r.status === "down");
  return out;
}

// Distinct locations for the machines filter (active machines only).
export async function listMachineLocations(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ location: machines.location })
    .from(machines)
    .where(and(isNull(machines.retiredAt), isNotNull(machines.location)))
    .orderBy(machines.location);
  return rows.map((r) => r.location).filter((l): l is string => !!l);
}

export async function getMachineStatus(
  machineId: number,
): Promise<MachineStatus> {
  const [m] = await db
    .select({ retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);
  if (!m) return "running";
  if (m.retiredAt) return "retired";
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
  return open ? "down" : "running";
}

// The machine's currently-open downtime period, if any (E3-S8). Drives the
// "mark it running?" prompt on a finished breakdown job.
export async function openDowntimeFor(
  machineId: number,
): Promise<{ id: number; startedAt: Date } | null> {
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
  return open ?? null;
}

// The downtime period this job closed, if it closed one (period.workOrderId is
// the link). Lets the done job show the stopped time — read from the period
// only, so job and machine views can never disagree (invariant #2).
export async function downtimeResolvedBy(
  workOrderId: number,
): Promise<{ startedAt: Date; endedAt: Date | null; durationMs: number | null } | null> {
  const [p] = await db
    .select({
      startedAt: downtimePeriods.startedAt,
      endedAt: downtimePeriods.endedAt,
      durationMs: downtimePeriods.durationMs,
    })
    .from(downtimePeriods)
    .where(eq(downtimePeriods.workOrderId, workOrderId))
    .orderBy(desc(downtimePeriods.startedAt))
    .limit(1);
  return p ?? null;
}

const ACTIVE_STATUSES = ["open", "in_progress"] as const;

export type DashboardCounts = {
  openJobs: number;
  overdue: number;
  machinesDown: number;
  lowStock: number;
  untriaged: number;
};

async function scalar(
  query: PromiseLike<{ c: number }[]>,
): Promise<number> {
  const rows = await query;
  return rows[0]?.c ?? 0;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const now = new Date();
  const [openJobs, overdue, machinesDown, lowStock, untriaged] =
    await Promise.all([
      scalar(
        db
          .select({ c: sql<number>`count(*)` })
          .from(workOrders)
          .where(inArray(workOrders.status, [...ACTIVE_STATUSES])),
      ),
      scalar(
        db
          .select({ c: sql<number>`count(*)` })
          .from(workOrders)
          .where(
            and(
              inArray(workOrders.status, [...ACTIVE_STATUSES]),
              // Day-granular: overdue is strictly before today (a job due today
              // is due, not late) — matches the queue's DueCell (lib/format).
              sql`${workOrders.dueDate} is not null and ${workOrders.dueDate} < ${startOfLocalDay(now)}`,
            ),
          ),
      ),
      scalar(
        db
          .select({
            c: sql<number>`count(distinct ${downtimePeriods.machineId})`,
          })
          .from(downtimePeriods)
          .where(isNull(downtimePeriods.endedAt)),
      ),
      scalar(
        db
          .select({ c: sql<number>`count(*)` })
          .from(parts)
          .where(sql`${parts.onHand} <= ${parts.minLevel}`),
      ),
      scalar(
        db
          .select({ c: sql<number>`count(*)` })
          .from(reports)
          .where(eq(reports.status, "new")),
      ),
    ]);

  return { openJobs, overdue, machinesDown, lowStock, untriaged };
}

export type QueueRow = {
  id: number;
  title: string;
  status: "open" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  dueDate: Date | null;
  machineCode: string;
  machineName: string;
};

export async function listWorkOrders(
  statuses: readonly ("open" | "in_progress" | "done" | "cancelled")[] = [
    "open",
    "in_progress",
  ],
): Promise<QueueRow[]> {
  return db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueDate: workOrders.dueDate,
      machineCode: machines.code,
      machineName: machines.name,
    })
    .from(workOrders)
    .innerJoin(machines, eq(workOrders.machineId, machines.id))
    .where(inArray(workOrders.status, [...statuses]))
    .orderBy(desc(workOrders.dueDate));
}

// ── Work-order queue with filters (E3-S2) ────────────────────────────────────

export type WorkStatus = "open" | "in_progress" | "done" | "cancelled";
export type WorkPriority = "low" | "medium" | "high" | "critical";

export type QueueFilters = {
  q?: string;
  // undefined status ⇒ the working queue (open + in progress)
  status?: WorkStatus;
  assigneeId?: number | "unassigned";
  machineId?: number;
  priority?: WorkPriority;
};

export type QueueItem = {
  id: number;
  title: string;
  status: WorkStatus;
  priority: WorkPriority;
  dueDate: Date | null;
  completedAt: Date | null;
  machineId: number;
  machineCode: string;
  machineName: string;
  assigneeName: string | null;
};

export type QueueCounts = {
  active: number;
  open: number;
  in_progress: number;
  done: number;
  cancelled: number;
};

const QUEUE_CAP = 100;

// Shared WHERE builder for the queue and its facet counts. `includeStatus`
// is off for the counts query so each status bucket is counted under the
// *other* active filters (assignee/machine/priority/q).
function queueConds(f: QueueFilters, includeStatus = true) {
  const conds = [];
  if (includeStatus) {
    if (f.status) conds.push(eq(workOrders.status, f.status));
    else conds.push(inArray(workOrders.status, [...ACTIVE_STATUSES]));
  }
  if (f.assigneeId === "unassigned") conds.push(isNull(workOrders.assigneeId));
  else if (typeof f.assigneeId === "number")
    conds.push(eq(workOrders.assigneeId, f.assigneeId));
  if (typeof f.machineId === "number")
    conds.push(eq(workOrders.machineId, f.machineId));
  if (f.priority) conds.push(eq(workOrders.priority, f.priority));
  if (f.q && f.q.trim()) {
    const esc = f.q
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, (ch) => `\\${ch}`);
    conds.push(
      sql`lower(${workOrders.title}) like ${`%${esc}%`} escape '\\'`,
    );
  }
  return conds;
}

// The queue (E3-S2). Active statuses sort overdue-first: due_date ASC puts the
// most-overdue (smallest past timestamp) on top, then soonest, then undated
// last. Closed statuses show most-recently-finished first. Capped with a
// truncation signal so a long Done history never renders unbounded.
export async function searchWorkOrders(
  f: QueueFilters,
): Promise<{ rows: QueueItem[]; truncated: boolean }> {
  const conds = queueConds(f);
  const closed = f.status === "done" || f.status === "cancelled";
  const order = closed
    ? [desc(workOrders.completedAt), desc(workOrders.id)]
    : [
        sql`case when ${workOrders.dueDate} is null then 1 else 0 end`,
        asc(workOrders.dueDate),
        asc(workOrders.id),
      ];

  const rows = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueDate: workOrders.dueDate,
      completedAt: workOrders.completedAt,
      machineId: machines.id,
      machineCode: machines.code,
      machineName: machines.name,
      assigneeName: users.name,
    })
    .from(workOrders)
    .innerJoin(machines, eq(workOrders.machineId, machines.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(and(...conds))
    .orderBy(...order)
    .limit(QUEUE_CAP + 1);

  const truncated = rows.length > QUEUE_CAP;
  return { rows: truncated ? rows.slice(0, QUEUE_CAP) : rows, truncated };
}

// Per-status counts for the tab bar, under the current non-status filters.
export async function workOrderStatusCounts(
  f: QueueFilters,
): Promise<QueueCounts> {
  const conds = queueConds(f, false);
  const rows = await db
    .select({ status: workOrders.status, c: sql<number>`count(*)` })
    .from(workOrders)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(workOrders.status);

  const by: Partial<Record<WorkStatus, number>> = {};
  for (const r of rows) by[r.status] = r.c;
  const open = by.open ?? 0;
  const in_progress = by.in_progress ?? 0;
  return {
    active: open + in_progress,
    open,
    in_progress,
    done: by.done ?? 0,
    cancelled: by.cancelled ?? 0,
  };
}

// Options for the queue's assignee + machine selects. Machines are limited to
// those that actually carry a work order, so the dropdown stays short.
export async function queueFilterOptions(): Promise<{
  machines: { id: number; code: string; name: string }[];
  assignees: { id: number; name: string }[];
}> {
  const [machineRows, assigneeRows] = await Promise.all([
    db
      .selectDistinct({
        id: machines.id,
        code: machines.code,
        name: machines.name,
      })
      .from(machines)
      .innerJoin(workOrders, eq(workOrders.machineId, machines.id))
      .orderBy(asc(machines.code)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name)),
  ]);
  return { machines: machineRows, assignees: assigneeRows };
}

// Parts used on a job (E3-S6) — the active (non-reversed) lines, oldest first,
// with each line's cost when the part carries a unit cost.
export type WorkOrderPartRow = {
  lineId: number;
  partId: number;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unitCost: number | null;
  lineCost: number | null;
};

export async function listWorkOrderParts(
  workOrderId: number,
): Promise<WorkOrderPartRow[]> {
  const rows = await db
    .select({
      lineId: workOrderParts.id,
      partId: parts.id,
      sku: parts.sku,
      name: parts.name,
      unit: parts.unit,
      quantity: workOrderParts.quantity,
      unitCost: parts.unitCost,
    })
    .from(workOrderParts)
    .innerJoin(parts, eq(workOrderParts.partId, parts.id))
    .where(
      and(
        eq(workOrderParts.workOrderId, workOrderId),
        eq(workOrderParts.reversed, false),
      ),
    )
    .orderBy(asc(workOrderParts.id));

  return rows.map((r) => ({
    ...r,
    lineCost: r.unitCost != null ? r.unitCost * r.quantity : null,
  }));
}

// Photos attached to a job (E3-S7). The bytes stream from the per-photo route;
// here we only need the id (for the URL) + who/when for the stamp.
export type WorkOrderPhoto = {
  id: number;
  uploadedBy: number | null;
  uploaderName: string | null;
  createdAt: Date;
};

export async function listWorkOrderPhotos(
  workOrderId: number,
): Promise<WorkOrderPhoto[]> {
  return db
    .select({
      id: photos.id,
      uploadedBy: photos.uploadedBy,
      uploaderName: users.name,
      createdAt: photos.createdAt,
    })
    .from(photos)
    .leftJoin(users, eq(photos.uploadedBy, users.id))
    .where(
      and(
        eq(photos.entityType, "work_order"),
        eq(photos.entityId, workOrderId),
      ),
    )
    .orderBy(asc(photos.createdAt));
}

export type ChecklistItemRow = {
  id: number;
  text: string;
  checked: boolean;
  checkedAt: Date | null;
  checkerName: string | null;
};

// Ordered checklist steps for a job (E3-S5), each with who ticked it and when.
export async function listChecklistItems(
  workOrderId: number,
): Promise<ChecklistItemRow[]> {
  return db
    .select({
      id: checklistItems.id,
      text: checklistItems.text,
      checked: checklistItems.checked,
      checkedAt: checklistItems.checkedAt,
      checkerName: users.name,
    })
    .from(checklistItems)
    .leftJoin(users, eq(checklistItems.checkedBy, users.id))
    .where(eq(checklistItems.workOrderId, workOrderId))
    .orderBy(asc(checklistItems.position), asc(checklistItems.id));
}

// Unticked checklist step texts for a set of jobs, keyed by work order — used by
// My Work to warn (naming them) before a one-tap Done skips over open steps.
export async function uncheckedStepsFor(
  workOrderIds: number[],
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();
  if (workOrderIds.length === 0) return map;
  const rows = await db
    .select({
      workOrderId: checklistItems.workOrderId,
      text: checklistItems.text,
    })
    .from(checklistItems)
    .where(
      and(
        inArray(checklistItems.workOrderId, workOrderIds),
        eq(checklistItems.checked, false),
      ),
    )
    .orderBy(asc(checklistItems.workOrderId), asc(checklistItems.position));
  for (const r of rows) {
    const list = map.get(r.workOrderId);
    if (list) list.push(r.text);
    else map.set(r.workOrderId, [r.text]);
  }
  return map;
}

// Total labour logged against a machine's completed jobs (E3-S7 time-spent).
export async function machineLaborMinutes(machineId: number): Promise<number> {
  return scalar(
    db
      .select({
        c: sql<number>`coalesce(sum(${workOrders.timeSpentMinutes}), 0)`,
      })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.machineId, machineId),
          eq(workOrders.status, "done"),
        ),
      ),
  );
}

// ── Preventive maintenance (E4) ──────────────────────────────────────────────

export type PmScheduleRow = {
  id: number;
  machineId: number;
  title: string;
  intervalDays: number;
  nextDueDate: Date;
  paused: boolean;
  defaultAssigneeId: number | null;
  assigneeName: string | null;
  checklistTemplate: string | null;
};

// Schedules on one machine, soonest due first (E4-S1).
export async function listMachinePmSchedules(
  machineId: number,
): Promise<PmScheduleRow[]> {
  return db
    .select({
      id: pmSchedules.id,
      machineId: pmSchedules.machineId,
      title: pmSchedules.title,
      intervalDays: pmSchedules.intervalDays,
      nextDueDate: pmSchedules.nextDueDate,
      paused: pmSchedules.paused,
      defaultAssigneeId: pmSchedules.defaultAssigneeId,
      assigneeName: users.name,
      checklistTemplate: pmSchedules.checklistTemplate,
    })
    .from(pmSchedules)
    .leftJoin(users, eq(pmSchedules.defaultAssigneeId, users.id))
    .where(eq(pmSchedules.machineId, machineId))
    .orderBy(asc(pmSchedules.nextDueDate));
}

export type PmRegisterRow = PmScheduleRow & {
  machineCode: string;
  machineName: string;
};

// The global PM register (E4-S5): every schedule, active ones first, then by
// next due. Paused schedules are marked in the UI.
export async function listPmSchedules(): Promise<PmRegisterRow[]> {
  return db
    .select({
      id: pmSchedules.id,
      machineId: pmSchedules.machineId,
      title: pmSchedules.title,
      intervalDays: pmSchedules.intervalDays,
      nextDueDate: pmSchedules.nextDueDate,
      paused: pmSchedules.paused,
      defaultAssigneeId: pmSchedules.defaultAssigneeId,
      assigneeName: users.name,
      checklistTemplate: pmSchedules.checklistTemplate,
      machineCode: machines.code,
      machineName: machines.name,
    })
    .from(pmSchedules)
    .innerJoin(machines, eq(pmSchedules.machineId, machines.id))
    .leftJoin(users, eq(pmSchedules.defaultAssigneeId, users.id))
    .orderBy(asc(pmSchedules.paused), asc(pmSchedules.nextDueDate));
}

// One schedule by id (for the edit form).
export async function getPmSchedule(id: number): Promise<PmScheduleRow | null> {
  const [row] = await listRowsForSchedule(id);
  return row ?? null;
}
async function listRowsForSchedule(id: number): Promise<PmScheduleRow[]> {
  return db
    .select({
      id: pmSchedules.id,
      machineId: pmSchedules.machineId,
      title: pmSchedules.title,
      intervalDays: pmSchedules.intervalDays,
      nextDueDate: pmSchedules.nextDueDate,
      paused: pmSchedules.paused,
      defaultAssigneeId: pmSchedules.defaultAssigneeId,
      assigneeName: users.name,
      checklistTemplate: pmSchedules.checklistTemplate,
    })
    .from(pmSchedules)
    .leftJoin(users, eq(pmSchedules.defaultAssigneeId, users.id))
    .where(eq(pmSchedules.id, id))
    .limit(1);
}

// Machine ids that have at least one schedule — powers the "no PM" discovery
// filter on the machines list (E4-S5).
export async function machineIdsWithPm(): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ machineId: pmSchedules.machineId })
    .from(pmSchedules);
  return new Set(rows.map((r) => r.machineId));
}

// ── Parts (E2) ────────────────────────────────────────────────────────────────

export type StockLevel = "out" | "low" | "ok";

export type PartListRow = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  binLocation: string | null;
  onHand: number;
  minLevel: number;
  stock: StockLevel;
};

// Low-stock is on-hand ≤ min (matches the dashboard count); "out" is ≤ 0.
export function stockLevel(onHand: number, minLevel: number): StockLevel {
  if (onHand <= 0) return "out";
  if (onHand <= minLevel) return "low";
  return "ok";
}

export async function searchParts({
  q,
  low,
}: {
  q?: string;
  low?: boolean;
} = {}): Promise<PartListRow[]> {
  const conds = [];
  if (low) conds.push(sql`${parts.onHand} <= ${parts.minLevel}`);
  if (q && q.trim()) {
    const esc = q
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const like = `%${esc}%`;
    conds.push(
      sql`(lower(${parts.sku}) like ${like} escape '\\' or lower(${parts.name}) like ${like} escape '\\' or lower(coalesce(${parts.binLocation}, '')) like ${like} escape '\\')`,
    );
  }

  const rows = await db
    .select({
      id: parts.id,
      sku: parts.sku,
      name: parts.name,
      unit: parts.unit,
      binLocation: parts.binLocation,
      onHand: parts.onHand,
      minLevel: parts.minLevel,
    })
    .from(parts)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(parts.sku));

  return rows.map((r) => ({ ...r, stock: stockLevel(r.onHand, r.minLevel) }));
}

export async function countLowStock(): Promise<number> {
  return scalar(
    db
      .select({ c: sql<number>`count(*)` })
      .from(parts)
      .where(sql`${parts.onHand} <= ${parts.minLevel}`),
  );
}

// ── Machine parts / fitment (E2-S8/S9, PLAN §6) ──────────────────────────────

export type MachinePartRow = {
  linkId: number;
  partId: number;
  sku: string;
  name: string;
  unit: string;
  binLocation: string | null;
  onHand: number;
  minLevel: number;
  stock: StockLevel;
  quantity: number | null;
  note: string | null;
};

// The spares a machine uses, with live stock so a Low/Out part is obvious.
export async function listMachineParts(
  machineId: number,
): Promise<MachinePartRow[]> {
  const rows = await db
    .select({
      linkId: machineParts.id,
      partId: parts.id,
      sku: parts.sku,
      name: parts.name,
      unit: parts.unit,
      binLocation: parts.binLocation,
      onHand: parts.onHand,
      minLevel: parts.minLevel,
      quantity: machineParts.quantity,
      note: machineParts.note,
    })
    .from(machineParts)
    .innerJoin(parts, eq(machineParts.partId, parts.id))
    .where(eq(machineParts.machineId, machineId))
    .orderBy(asc(parts.sku));
  return rows.map((r) => ({ ...r, stock: stockLevel(r.onHand, r.minLevel) }));
}

export type PartMachineRow = {
  machineId: number;
  code: string;
  name: string;
  retired: boolean;
};

// The reverse view: machines that use a given part (E2-S10 "Fits machines").
export async function listPartMachines(
  partId: number,
): Promise<PartMachineRow[]> {
  const rows = await db
    .select({
      machineId: machines.id,
      code: machines.code,
      name: machines.name,
      retiredAt: machines.retiredAt,
    })
    .from(machineParts)
    .innerJoin(machines, eq(machineParts.machineId, machines.id))
    .where(eq(machineParts.partId, partId))
    .orderBy(asc(machines.code));
  return rows.map((r) => ({
    machineId: r.machineId,
    code: r.code,
    name: r.name,
    retired: Boolean(r.retiredAt),
  }));
}

// Catalog search limited to parts NOT already attached to this machine — the
// picker for the attach flow (E2-S8). Capped; the user narrows with the query.
export async function searchUnattachedParts(
  machineId: number,
  q?: string,
): Promise<PartListRow[]> {
  const attached = db
    .select({ id: machineParts.partId })
    .from(machineParts)
    .where(eq(machineParts.machineId, machineId));

  const conds = [notInArray(parts.id, attached)];
  if (q && q.trim()) {
    const esc = q
      .trim()
      .toLowerCase()
      .replace(/[\\%_]/g, (ch) => `\\${ch}`);
    const like = `%${esc}%`;
    conds.push(
      sql`(lower(${parts.sku}) like ${like} escape '\\' or lower(${parts.name}) like ${like} escape '\\' or lower(coalesce(${parts.binLocation}, '')) like ${like} escape '\\')`,
    );
  }

  const rows = await db
    .select({
      id: parts.id,
      sku: parts.sku,
      name: parts.name,
      unit: parts.unit,
      binLocation: parts.binLocation,
      onHand: parts.onHand,
      minLevel: parts.minLevel,
    })
    .from(parts)
    .where(and(...conds))
    .orderBy(asc(parts.sku))
    .limit(51); // one extra so the caller can signal "there are more — refine"

  return rows.map((r) => ({ ...r, stock: stockLevel(r.onHand, r.minLevel) }));
}
