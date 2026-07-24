import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Play,
  Check,
  Plus,
  Package,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import {
  workOrders,
  machines,
  users,
  workOrderStatusHistory,
} from "@/lib/db/schema";
import {
  listWorkOrderParts,
  listWorkOrderPhotos,
  listChecklistItems,
  openDowntimeFor,
  downtimeResolvedBy,
} from "@/lib/queries";
import {
  buttonClass,
  Mono,
  SectionLabel,
  Input,
  EmptyState,
} from "@/components/ui";
import { WorkStatusChip, PriorityChip } from "@/components/status-chip";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  formatDate,
  toDateInputValue,
  downtimeSince,
  formatDuration,
} from "@/lib/format";
import { startWork, completeWork, removePartFromJob } from "../actions";
import { JobPhotos } from "./job-photos";
import { PlanRow } from "./plan-row";
import { Checklist } from "./checklist";
import { DowntimePrompt } from "./downtime-prompt";

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
      assigneeId: workOrders.assigneeId,
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

  // Reassign/reschedule (E3-S9) is a planner action on a still-open job. Only
  // then do we pay for the assignee list that the inline editor needs.
  const canManage = can(user, "work:reassign") && canLog;
  const assigneeOptions = canManage
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.active, true))
        .orderBy(asc(users.name))
    : [];
  // Keep a since-deactivated current assignee selectable, so editing an unrelated
  // field (date/priority) can't silently unassign the job by falling back to the
  // first option. Only a *new* assignment is restricted to active users.
  const editorUsers = assigneeOptions.map((u) => ({ id: u.id, label: u.name }));
  if (
    canManage &&
    wo.assigneeId != null &&
    !editorUsers.some((u) => u.id === wo.assigneeId)
  ) {
    editorUsers.unshift({
      id: wo.assigneeId,
      label: `${wo.assigneeName ?? "Unknown"} (inactive)`,
    });
  }

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

  // Checklist (E3-S5): anyone signed in ticks steps on an open job; a planner
  // authors them. Both are frozen once the job closes.
  const canCheck = can(user, "work:check") && canLog;
  const canManageChecklist = can(user, "work:manage-checklist") && canLog;
  const rawChecklist = await listChecklistItems(id);
  const checklist = rawChecklist.map((c) => ({
    id: c.id,
    text: c.text,
    checked: c.checked,
    stamp:
      c.checked && c.checkedAt
        ? `${c.checkerName ?? "Unknown"} · ${formatDate(
            c.checkedAt,
          )}, ${c.checkedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : null,
  }));
  const checkedCount = checklist.filter((c) => c.checked).length;
  const uncheckedSteps = checklist.filter((c) => !c.checked).map((c) => c.text);
  // Warn (don't block) if a job is finished with steps still unticked — floor
  // reality wins, but name what's being skipped so it's a choice, not an oversight.
  const doneWarning =
    uncheckedSteps.length > 0
      ? `${uncheckedSteps.length} step${
          uncheckedSteps.length === 1 ? "" : "s"
        } not ticked:\n\n${uncheckedSteps
          .map((s) => `• ${s}`)
          .join("\n")}\n\nMark the job done anyway?`
      : null;

  // Breakdown → downtime (E3-S8). A job resolves at most one period: if it has
  // already closed one, show the stopped time it logged; only otherwise (and
  // while the machine is still down) offer the prompt — so a later, unrelated
  // breakdown can't get re-attributed to this finished job. Read from the period
  // only, so job and machine views can never disagree (invariant #2).
  const resolvedDowntime =
    wo.status === "done" ? await downtimeResolvedBy(wo.id) : null;
  const downtime =
    wo.status === "done" && !resolvedDowntime
      ? await openDowntimeFor(wo.machineId)
      : null;

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

        <PlanRow
          workOrderId={wo.id}
          canManage={canManage}
          assigneeName={wo.assigneeName ?? "Unassigned"}
          dueLabel={wo.dueDate ? formatDate(wo.dueDate) : null}
          assigneeId={wo.assigneeId}
          dueValue={wo.dueDate ? toDateInputValue(wo.dueDate) : ""}
          priority={wo.priority}
          users={editorUsers}
        />
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
          {doneWarning ? (
            <ConfirmSubmit
              variant="primary"
              full
              icon={<Check className="h-4 w-4" />}
              message={doneWarning}
            >
              Mark done
            </ConfirmSubmit>
          ) : (
            <button type="submit" className={buttonClass("primary", true)}>
              <Check className="h-4 w-4" />
              Mark done
            </button>
          )}
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

      {/* Breakdown → downtime close (E3-S8). The prompt shows while the machine
          is still Down; once this job has ended a period, the stopped time it
          logged shows instead (read from the period only — invariant #2). */}
      {downtime && (
        <DowntimePrompt
          workOrderId={wo.id}
          machineId={wo.machineId}
          machineCode={wo.machineCode}
          downLabel={`for ${downtimeSince(downtime.startedAt)}`}
        />
      )}
      {resolvedDowntime && resolvedDowntime.durationMs != null && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[14px] text-slate-600">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-700" />
          <span>
            Ended the machine&rsquo;s downtime —{" "}
            <span className="text-slate-900">
              was down {formatDuration(resolvedDowntime.durationMs)}
            </span>
            .
          </span>
        </div>
      )}

      {/* Checklist (E3-S5) — ordered steps, tick saves immediately. Shown when
          it has steps, or when a planner can start building one on an open job. */}
      {(checklist.length > 0 || canManageChecklist) && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Checklist</SectionLabel>
            {checklist.length > 0 && (
              <Mono className="text-[13px] text-slate-500">
                {checkedCount}/{checklist.length}
              </Mono>
            )}
          </div>
          <Checklist
            workOrderId={wo.id}
            items={checklist}
            canCheck={canCheck}
            canManage={canManageChecklist}
          />
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
              className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-[14px] last:border-b-0"
            >
              <div className="min-w-0">
                <span className="capitalize text-slate-700">
                  {h.toStatus.replace("_", " ")}
                  {h.actorName && (
                    <span className="text-slate-500"> · {h.actorName}</span>
                  )}
                </span>
                {h.note && (
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-slate-500">
                    {h.note}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[13px] text-slate-500 tabular-nums">
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
