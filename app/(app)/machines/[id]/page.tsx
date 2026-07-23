import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, inArray } from "drizzle-orm";
import { ArrowLeft, MapPin, OctagonX, CircleDot, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, downtimePeriods, workOrders } from "@/lib/db/schema";
import { getMachineStatus } from "@/lib/queries";
import { buttonClass, Mono, SectionLabel, EmptyState } from "@/components/ui";
import {
  MachineStatusChip,
  WorkStatusChip,
  PriorityChip,
} from "@/components/status-chip";
import { downtimeSince, formatDuration, formatDate } from "@/lib/format";
import { markDown, markRunning } from "../actions";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.id, id))
    .limit(1);
  if (!machine) notFound();

  const status = await getMachineStatus(id);

  const [openPeriod] = await db
    .select()
    .from(downtimePeriods)
    .where(
      and(eq(downtimePeriods.machineId, id), isNull(downtimePeriods.endedAt)),
    )
    .limit(1);

  const openJobs = await db
    .select()
    .from(workOrders)
    .where(
      and(
        eq(workOrders.machineId, id),
        inArray(workOrders.status, ["open", "in_progress"]),
      ),
    )
    .orderBy(desc(workOrders.dueDate));

  const history = await db
    .select()
    .from(downtimePeriods)
    .where(eq(downtimePeriods.machineId, id))
    .orderBy(desc(downtimePeriods.startedAt))
    .limit(10);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/machines"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Machines
      </Link>

      {/* Nameplate header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Mono className="text-[13px] font-medium text-slate-500">
              {machine.code}
            </Mono>
            <h1 className="font-condensed text-2xl font-semibold text-slate-900">
              {machine.name}
            </h1>
            {machine.location && (
              <div className="mt-1 flex items-center gap-1.5 text-[14px] text-slate-500">
                <MapPin className="h-4 w-4" />
                {machine.location}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <MachineStatusChip status={status} />
            {status === "down" && openPeriod && (
              <span className="text-[13px] text-red-600">
                <Mono>{downtimeSince(openPeriod.startedAt)}</Mono>
              </span>
            )}
          </div>
        </div>

        {status !== "retired" && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {status === "down" ? (
              <form action={markRunning}>
                <input type="hidden" name="machineId" value={machine.id} />
                <button type="submit" className={buttonClass("primary")}>
                  <CircleDot className="h-4 w-4" />
                  Mark running
                </button>
              </form>
            ) : (
              <form action={markDown}>
                <input type="hidden" name="machineId" value={machine.id} />
                <button type="submit" className={buttonClass("danger")}>
                  <OctagonX className="h-4 w-4" />
                  Mark down
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {machine.notes && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Notes</SectionLabel>
          <p className="whitespace-pre-wrap text-[15px] text-slate-700">
            {machine.notes}
          </p>
        </div>
      )}

      {/* Open work */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Open work orders</SectionLabel>
          <Link
            href={`/work-orders/new?machine=${machine.id}`}
            className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </Link>
        </div>
        {openJobs.length === 0 ? (
          <EmptyState title="No open work orders on this machine." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {openJobs.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <Mono className="w-16 shrink-0 text-[13px] text-slate-500">
                  WO-{wo.id}
                </Mono>
                <div className="min-w-0 flex-1 truncate text-[15px] text-slate-900">
                  {wo.title}
                </div>
                <PriorityChip priority={wo.priority} />
                <WorkStatusChip status={wo.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Downtime history */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Downtime history</SectionLabel>
        {history.length === 0 ? (
          <EmptyState title="No recorded stoppages." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {history.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-[14px] last:border-b-0"
              >
                <div className="text-slate-700">
                  {formatDate(p.startedAt)}{" "}
                  <span className="text-slate-400">
                    {p.startedAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-right">
                  {p.endedAt ? (
                    <Mono className="text-slate-600">
                      {formatDuration(p.durationMs ?? 0)}
                    </Mono>
                  ) : (
                    <span className="text-[13px] text-red-600">ongoing</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
