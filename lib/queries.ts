import { and, eq, isNull, sql, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  machines,
  downtimePeriods,
  workOrders,
  parts,
  reports,
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

export async function listMachines(): Promise<MachineListRow[]> {
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
    .where(isNull(machines.retiredAt))
    .orderBy(machines.code);

  return rows.map((r) => ({
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
              sql`${workOrders.dueDate} is not null and ${workOrders.dueDate} < ${now.getTime()}`,
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
