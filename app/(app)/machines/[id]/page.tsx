import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import {
  ArrowLeft,
  MapPin,
  OctagonX,
  CircleDot,
  Plus,
  Pencil,
  Printer,
  Ban,
  Undo2,
  PauseCircle,
  Play,
  Clock,
  Trash2,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  machines,
  downtimePeriods,
  workOrders,
  workOrderParts,
} from "@/lib/db/schema";
import {
  getMachineStatus,
  listMachineParts,
  machineLaborMinutes,
  listMachinePmSchedules,
} from "@/lib/queries";
import { buttonClass, Mono, SectionLabel, EmptyState } from "@/components/ui";
import {
  MachineStatusChip,
  WorkStatusChip,
  PriorityChip,
  StatusChip,
  StockStatusChip,
} from "@/components/status-chip";
import { QrImage } from "@/components/qr";
import { ConfirmSubmit } from "@/components/confirm-submit";
import {
  downtimeSince,
  formatDuration,
  formatDate,
  startOfLocalDay,
  dueState,
} from "@/lib/format";
import { qrSvg } from "@/lib/qr";
import { appBaseUrl, machineScanPath } from "@/lib/url";
import {
  markDown,
  markRunning,
  retireMachine,
  unretireMachine,
  removePart,
} from "../actions";
import { setPmPaused, deletePmSchedule } from "../../pm/actions";
import { parseChecklistTemplate } from "@/lib/pm";

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.id, id))
    .limit(1);
  if (!machine) notFound();

  const status = await getMachineStatus(id);
  const isAdmin = user.role === "admin";
  const retired = status === "retired";

  const [openPeriod] = await db
    .select()
    .from(downtimePeriods)
    .where(and(eq(downtimePeriods.machineId, id), isNull(downtimePeriods.endedAt)))
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

  const doneJobs = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.machineId, id), eq(workOrders.status, "done")))
    .orderBy(desc(workOrders.completedAt))
    .limit(10);

  // Parts consumed per completed job (invariant #1 lines, reversals excluded).
  const doneIds = doneJobs.map((j) => j.id);
  const partCountRows = doneIds.length
    ? await db
        .select({
          woId: workOrderParts.workOrderId,
          c: sql<number>`count(*)`,
        })
        .from(workOrderParts)
        .where(
          and(
            inArray(workOrderParts.workOrderId, doneIds),
            eq(workOrderParts.reversed, false),
          ),
        )
        .groupBy(workOrderParts.workOrderId)
    : [];
  const partCounts = new Map(partCountRows.map((r) => [r.woId, Number(r.c)]));

  const attachedParts = await listMachineParts(id);
  const laborMinutes = await machineLaborMinutes(id);

  const schedules = await listMachinePmSchedules(id);
  const startOfToday = startOfLocalDay();

  const history = await db
    .select()
    .from(downtimePeriods)
    .where(eq(downtimePeriods.machineId, id))
    .orderBy(desc(downtimePeriods.startedAt))
    .limit(10);

  const scanUrl = (await appBaseUrl()) + machineScanPath(machine.code);
  const svg = await qrSvg(scanUrl, { margin: 2 });

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/machines"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Machines
      </Link>

      {retired && (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-600">
          <Ban className="h-4 w-4 shrink-0" />
          This machine is retired — kept for its history, and it won&rsquo;t take
          new work.
        </div>
      )}

      {/* Nameplate header + QR-as-motif */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
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
            <div className="mt-3 flex items-center gap-2">
              <MachineStatusChip status={status} />
              {status === "down" && openPeriod && (
                <span className="text-[13px] text-red-600">
                  <Mono>{downtimeSince(openPeriod.startedAt)}</Mono>
                </span>
              )}
            </div>
          </div>

          {/* Asset-tag: the same QR the physical label carries. */}
          <div className="flex shrink-0 items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <QrImage
              svg={svg}
              className="h-24 w-24"
              label={`QR code linking to machine ${machine.code}`}
            />
            <div className="flex flex-col">
              <span className="font-condensed text-[12px] tracking-wide text-slate-500">
                Scan to report
              </span>
              <Mono className="text-[13px] text-slate-700">{machine.code}</Mono>
              {isAdmin && !retired && (
                <Link
                  href={`/print/labels?ids=${machine.id}`}
                  className="mt-2 inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print label
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {!retired &&
            (status === "down" ? (
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
            ))}

          {isAdmin && (
            <Link
              href={`/machines/${machine.id}/edit`}
              className={buttonClass("secondary")}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          )}

          {isAdmin &&
            (retired ? (
              <form action={unretireMachine}>
                <input type="hidden" name="machineId" value={machine.id} />
                <ConfirmSubmit
                  variant="secondary"
                  icon={<Undo2 className="h-4 w-4" />}
                  message="Bring this machine back into service?"
                >
                  Return to service
                </ConfirmSubmit>
              </form>
            ) : (
              <form action={retireMachine} className="sm:ml-auto">
                <input type="hidden" name="machineId" value={machine.id} />
                <ConfirmSubmit
                  variant="secondary"
                  icon={<Ban className="h-4 w-4" />}
                  message="Retire this machine? It leaves the active lists and stops taking new work. Its history is kept, and you can return it to service later."
                >
                  Retire
                </ConfirmSubmit>
              </form>
            ))}
        </div>
      </div>

      {machine.notes && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Notes</SectionLabel>
          <p className="whitespace-pre-wrap text-[15px] text-slate-700">
            {machine.notes}
          </p>
        </div>
      )}

      {/* Parts (fitment — E2-S8/S9) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Parts</SectionLabel>
          {isAdmin && !retired && (
            <Link
              href={`/machines/${machine.id}/parts/new`}
              className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add part
            </Link>
          )}
        </div>
        {attachedParts.length === 0 ? (
          <EmptyState
            title="No parts recorded for this machine yet."
            action={
              isAdmin && !retired ? (
                <Link
                  href={`/machines/${machine.id}/parts/new`}
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
            {attachedParts.map((p) => (
              <div
                key={p.linkId}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <Link
                  href={`/parts/${p.partId}`}
                  className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80"
                >
                  <Mono className="w-24 shrink-0 text-[13px] text-slate-500">
                    {p.sku}
                  </Mono>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-slate-900">
                      {p.name}
                    </div>
                    {(p.binLocation || p.quantity != null || p.note) && (
                      <div className="truncate text-[13px] text-slate-500">
                        {p.binLocation && (
                          <>
                            bin <Mono>{p.binLocation}</Mono>
                          </>
                        )}
                        {p.quantity != null && (
                          <>
                            {p.binLocation ? " · " : ""}qty{" "}
                            <Mono>{p.quantity}</Mono>
                          </>
                        )}
                        {p.note && (
                          <>
                            {p.binLocation || p.quantity != null ? " · " : ""}
                            {p.note}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
                <Mono className="text-[14px] text-slate-900">{p.onHand}</Mono>
                <StockStatusChip level={p.stock} />
                {isAdmin && (
                  <form action={removePart}>
                    <input type="hidden" name="linkId" value={p.linkId} />
                    <input type="hidden" name="machineId" value={machine.id} />
                    <input type="hidden" name="partId" value={p.partId} />
                    <ConfirmSubmit
                      compact
                      label={`Remove ${p.sku}`}
                      icon={<Trash2 className="h-4 w-4" />}
                      message={`Remove ${p.sku} from this machine? Only the link is removed — the part and its stock history stay.`}
                    />
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Open work */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Open work orders</SectionLabel>
          {!retired && (
            <Link
              href={`/work-orders/new?machine=${machine.id}`}
              className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </Link>
          )}
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

      {/* Completed work */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionLabel>Completed work</SectionLabel>
          {laborMinutes > 0 && (
            <span className="text-[13px] text-slate-500">
              <Mono className="text-slate-600">
                {formatDuration(laborMinutes * 60000)}
              </Mono>{" "}
              logged
            </span>
          )}
        </div>
        {doneJobs.length === 0 ? (
          <EmptyState title="No completed work orders yet." />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {doneJobs.map((wo) => {
              const n = partCounts.get(wo.id) ?? 0;
              return (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
                >
                  <Mono className="w-16 shrink-0 text-[13px] text-slate-500">
                    WO-{wo.id}
                  </Mono>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-slate-900">
                      {wo.title}
                    </div>
                    <div className="truncate text-[13px] text-slate-500">
                      {wo.completedAt ? formatDate(wo.completedAt) : "—"}
                      {n > 0 && ` · ${n} part${n === 1 ? "" : "s"} used`}
                    </div>
                  </div>
                  <WorkStatusChip status="done" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Preventive maintenance (E4) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Preventive maintenance</SectionLabel>
          {isAdmin && !retired && (
            <Link
              href={`/machines/${id}/pm/new`}
              className="inline-flex min-h-[44px] items-center gap-1 text-[13px] text-slate-500 hover:text-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add schedule
            </Link>
          )}
        </div>
        {schedules.length === 0 ? (
          <EmptyState
            title="No preventive maintenance scheduled."
            action={
              isAdmin && !retired ? (
                <Link
                  href={`/machines/${id}/pm/new`}
                  className={buttonClass("secondary")}
                >
                  <Plus className="h-4 w-4" />
                  Add PM schedule
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {schedules.map((s) => {
              const steps = parseChecklistTemplate(s.checklistTemplate).length;
              const ds = dueState(s.nextDueDate, startOfToday);
              return (
                <div
                  key={s.id}
                  className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-slate-900">
                      {s.title}
                    </div>
                    <div className="mt-0.5 text-[13px] text-slate-500">
                      Every {s.intervalDays} days
                      {s.assigneeName ? ` · ${s.assigneeName}` : ""}
                      {steps > 0 ? ` · ${steps} step${steps === 1 ? "" : "s"}` : ""}
                    </div>
                    <div className="mt-1 text-[13px]">
                      {s.paused ? (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <PauseCircle className="h-3.5 w-3.5" /> Paused
                        </span>
                      ) : ds.kind === "overdue" ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <Clock className="h-3.5 w-3.5" />
                          <Mono>{ds.days}d</Mono> overdue
                        </span>
                      ) : ds.kind === "today" ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <Clock className="h-3.5 w-3.5" /> Due today
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Next <Mono>{formatDate(s.nextDueDate)}</Mono>
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && !retired && (
                    <div className="flex shrink-0 items-center gap-1">
                      <form action={setPmPaused}>
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <input
                          type="hidden"
                          name="paused"
                          value={s.paused ? "false" : "true"}
                        />
                        <button
                          type="submit"
                          aria-label={
                            s.paused
                              ? `Resume ${s.title}`
                              : `Pause ${s.title}`
                          }
                          className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                        >
                          {s.paused ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <PauseCircle className="h-4 w-4" />
                          )}
                        </button>
                      </form>
                      <Link
                        href={`/machines/${id}/pm/${s.id}/edit`}
                        aria-label={`Edit ${s.title}`}
                        className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <form action={deletePmSchedule}>
                        <input type="hidden" name="scheduleId" value={s.id} />
                        <ConfirmSubmit
                          compact
                          label={`Delete ${s.title}`}
                          icon={<Trash2 className="h-4 w-4" />}
                          message={`Delete the "${s.title}" schedule? Jobs it already created stay as history.`}
                        />
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
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
                className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[14px] last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="text-slate-700">
                    {formatDate(p.startedAt)}{" "}
                    <span className="text-slate-500">
                      {p.startedAt.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {p.workOrderId && (
                    <Link
                      href={`/work-orders/${p.workOrderId}`}
                      className="text-[13px] text-slate-500 hover:text-slate-700"
                    >
                      Fixed by <Mono>WO-{p.workOrderId}</Mono>
                    </Link>
                  )}
                </div>
                <div className="shrink-0 text-right">
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
