import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Play, Check, Plus, Package, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  workOrders,
  machines,
  users,
  workOrderStatusHistory,
} from "@/lib/db/schema";
import { listWorkOrderParts, listWorkOrderPhotos } from "@/lib/queries";
import {
  buttonClass,
  Mono,
  SectionLabel,
  Input,
  EmptyState,
} from "@/components/ui";
import { WorkStatusChip, PriorityChip } from "@/components/status-chip";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { formatDate } from "@/lib/format";
import { startWork, completeWork, removePartFromJob } from "../actions";
import { JobPhotos } from "./job-photos";

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
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
      timeSpentMinutes: workOrders.timeSpentMinutes,
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

  const jobParts = await listWorkOrderParts(id);
  // Sum in integer cents so the shown total is exact. Lines whose part has no
  // unit cost are counted separately so the total is never silently understated.
  const costedCents = jobParts
    .filter((p) => p.lineCost != null)
    .map((p) => Math.round((p.lineCost as number) * 100));
  const totalCost = costedCents.length
    ? costedCents.reduce((s, c) => s + c, 0) / 100
    : null;
  const uncostedCount = jobParts.filter((p) => p.unitCost == null).length;
  // Parts/photos can only be logged/removed while the job is still open — a done
  // or cancelled job's record of what was used is locked.
  const canLog = wo.status !== "done" && wo.status !== "cancelled";

  const rawPhotos = await listWorkOrderPhotos(id);
  const jobPhotos = rawPhotos.map((p) => ({
    id: p.id,
    uploader: p.uploaderName ?? "Unknown",
    when: `${formatDate(p.createdAt)} ${p.createdAt.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    canRemove: canLog && (user.role === "admin" || p.uploadedBy === user.id),
  }));

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
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Time spent (minutes, optional)</SectionLabel>
            <Input
              name="timeSpentMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="e.g. 45"
              className="w-40 font-mono"
            />
          </div>
          <button type="submit" className={buttonClass("primary", true)}>
            <Check className="h-4 w-4" />
            Mark done
          </button>
        </form>
      )}
      {wo.status === "done" && (wo.completionNote || wo.timeSpentMinutes != null) && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Completion</SectionLabel>
          {wo.completionNote && (
            <p className="whitespace-pre-wrap text-[15px] text-slate-700">
              {wo.completionNote}
            </p>
          )}
          {wo.timeSpentMinutes != null && (
            <p className="text-[14px] text-slate-500">
              Time spent: <Mono className="text-slate-700">{wo.timeSpentMinutes}</Mono> min
            </p>
          )}
        </div>
      )}

      {/* Parts used (E3-S6) — each line is a stock Issue; removing it reverses
          the movement. Hidden entirely on a closed job with no parts. */}
      {(jobParts.length > 0 || canLog) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Parts used</SectionLabel>
            {canLog && (
              <Link
                href={`/work-orders/${wo.id}/parts/new`}
                className="inline-flex min-h-[44px] items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add part
              </Link>
            )}
          </div>
          {jobParts.length === 0 ? (
            <EmptyState
              icon={<Package className="h-6 w-6" />}
              title="No parts logged on this job yet."
              action={
                canLog ? (
                  <Link
                    href={`/work-orders/${wo.id}/parts/new`}
                    className={buttonClass("secondary")}
                  >
                    <Plus className="h-4 w-4" />
                    Add part
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {jobParts.map((p) => (
                <div
                  key={p.lineId}
                  className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <Link
                    href={`/parts/${p.partId}`}
                    className="flex min-w-0 flex-1 flex-col gap-0.5 hover:opacity-80"
                  >
                    <Mono className="text-[12px] text-slate-500">{p.sku}</Mono>
                    <span className="truncate text-[15px] text-slate-900">
                      {p.name}
                    </span>
                  </Link>
                  <div className="shrink-0 text-right">
                    <Mono className="text-[15px] font-medium text-slate-900">
                      {p.quantity}
                    </Mono>
                    <span className="text-[13px] text-slate-500"> {p.unit}</span>
                  </div>
                  {canLog && (
                    <form action={removePartFromJob}>
                      <input type="hidden" name="lineId" value={p.lineId} />
                      <input type="hidden" name="workOrderId" value={wo.id} />
                      <ConfirmSubmit
                        compact
                        label={`Remove ${p.name}`}
                        icon={<Trash2 className="h-4 w-4" />}
                        message={`Remove ${p.quantity} × ${p.name}? This puts the stock back.`}
                      />
                    </form>
                  )}
                </div>
              ))}
              {totalCost != null && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-[14px]">
                  <span className="text-slate-600">
                    Parts cost
                    {uncostedCount > 0 && (
                      <span className="text-slate-500">
                        {" · "}
                        {uncostedCount} without a listed cost
                      </span>
                    )}
                  </span>
                  <Mono className="font-medium text-slate-900">
                    {totalCost.toFixed(2)}
                  </Mono>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Photos (E3-S7) — camera/gallery, thumbnails open full-screen. Shown
          on an open job (to add) or any job that already has photos. */}
      {(jobPhotos.length > 0 || canLog) && (
        <div className="flex flex-col gap-3">
          <SectionLabel>Photos</SectionLabel>
          <JobPhotos
            workOrderId={wo.id}
            photos={jobPhotos}
            canEdit={canLog}
            max={10}
          />
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
                  <span className="text-slate-500"> · {h.actorName}</span>
                )}
              </span>
              <span className="text-[13px] text-slate-500">
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
