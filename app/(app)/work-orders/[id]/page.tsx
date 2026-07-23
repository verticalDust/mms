import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Play, Check } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  workOrders,
  machines,
  users,
  workOrderStatusHistory,
} from "@/lib/db/schema";
import { buttonClass, Mono, SectionLabel, Input } from "@/components/ui";
import { WorkStatusChip, PriorityChip } from "@/components/status-chip";
import { formatDate } from "@/lib/format";
import { startWork, completeWork } from "../actions";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [wo] = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      description: workOrders.description,
      dueDate: workOrders.dueDate,
      completionNote: workOrders.completionNote,
      machineId: machines.id,
      machineCode: machines.code,
      machineName: machines.name,
      assigneeName: users.name,
    })
    .from(workOrders)
    .innerJoin(machines, eq(workOrders.machineId, machines.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo) notFound();

  const history = await db
    .select({
      id: workOrderStatusHistory.id,
      toStatus: workOrderStatusHistory.toStatus,
      note: workOrderStatusHistory.note,
      createdAt: workOrderStatusHistory.createdAt,
      actorName: users.name,
    })
    .from(workOrderStatusHistory)
    .leftJoin(users, eq(workOrderStatusHistory.actorId, users.id))
    .where(eq(workOrderStatusHistory.workOrderId, id))
    .orderBy(desc(workOrderStatusHistory.createdAt));

  return (
    <div className="flex flex-col gap-6 pb-4">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Work orders
      </Link>

      {/* Nameplate header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Mono className="text-[13px] font-medium text-slate-500">
              WO-{wo.id}
            </Mono>
            <h1 className="font-condensed text-2xl font-semibold text-slate-900">
              {wo.title}
            </h1>
            <Link
              href={`/machines/${wo.machineId}`}
              className="mt-1 inline-block text-[14px] text-slate-500 hover:text-slate-700"
            >
              <Mono>{wo.machineCode}</Mono> · {wo.machineName}
            </Link>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PriorityChip priority={wo.priority} />
            <WorkStatusChip status={wo.status} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-slate-500">
          <span>
            Assignee:{" "}
            <span className="text-slate-700">
              {wo.assigneeName ?? "Unassigned"}
            </span>
          </span>
          {wo.dueDate && (
            <span>
              Due:{" "}
              <span className="text-slate-700">{formatDate(wo.dueDate)}</span>
            </span>
          )}
        </div>
      </div>

      {wo.description && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Description</SectionLabel>
          <p className="whitespace-pre-wrap text-[15px] text-slate-700">
            {wo.description}
          </p>
        </div>
      )}

      {/* Lifecycle action */}
      {wo.status === "open" && (
        <form action={startWork}>
          <input type="hidden" name="workOrderId" value={wo.id} />
          <button type="submit" className={buttonClass("primary", true)}>
            <Play className="h-4 w-4" />
            Start work
          </button>
        </form>
      )}
      {wo.status === "in_progress" && (
        <form action={completeWork} className="flex flex-col gap-3">
          <input type="hidden" name="workOrderId" value={wo.id} />
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Completion note (optional)</SectionLabel>
            <Input name="completionNote" placeholder="What did you do?" />
          </div>
          <button type="submit" className={buttonClass("primary", true)}>
            <Check className="h-4 w-4" />
            Mark done
          </button>
        </form>
      )}
      {wo.status === "done" && wo.completionNote && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Completion note</SectionLabel>
          <p className="whitespace-pre-wrap text-[15px] text-slate-700">
            {wo.completionNote}
          </p>
        </div>
      )}

      {/* Activity */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Activity</SectionLabel>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-[14px] last:border-b-0"
            >
              <span className="text-slate-700 capitalize">
                {h.toStatus.replace("_", " ")}
                {h.actorName && (
                  <span className="text-slate-400"> · {h.actorName}</span>
                )}
              </span>
              <span className="text-[13px] text-slate-400">
                {formatDate(h.createdAt)}{" "}
                {h.createdAt.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
