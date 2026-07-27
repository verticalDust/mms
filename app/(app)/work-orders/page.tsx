import Link from "next/link";
import { Plus, ClipboardList, Clock, SearchX, X } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import {
  searchWorkOrders,
  workOrderStatusCounts,
  queueFilterOptions,
  type QueueItem,
  type WorkStatus,
  type WorkPriority,
} from "@/lib/queries";
import { buttonClass, Mono, EmptyState } from "@/components/ui";
import { WorkStatusChip, PriorityChip } from "@/components/status-chip";
import { SearchFilterBar } from "@/components/search-filter-bar";
import { factoryStartOfDay, dueState, formatDate } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { QueueTabs, type WorkStatusFilter } from "./queue-tabs";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.workOrders };
}

const STATUS_VALUES: WorkStatus[] = [
  "open",
  "in_progress",
  "done",
  "cancelled",
];
const PRIORITY_VALUES: WorkPriority[] = ["low", "medium", "high", "critical"];

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const t = await getT();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : "";
  const status = STATUS_VALUES.includes(sp.status as WorkStatus)
    ? (sp.status as WorkStatus)
    : undefined;
  const priority = PRIORITY_VALUES.includes(sp.priority as WorkPriority)
    ? (sp.priority as WorkPriority)
    : undefined;

  const assigneeRaw = typeof sp.assignee === "string" ? sp.assignee : "";
  const assigneeId =
    assigneeRaw === "unassigned"
      ? ("unassigned" as const)
      : /^\d+$/.test(assigneeRaw)
        ? Number(assigneeRaw)
        : undefined;

  const machineRaw = typeof sp.machine === "string" ? sp.machine : "";
  const machineId = /^\d+$/.test(machineRaw) ? Number(machineRaw) : undefined;

  const overdue = sp.overdue === "1";

  // Overdue is a factory-timezone boundary (PLAN §1.5) — the same "start of
  // today" the dashboard gauge + buckets use, so all three agree.
  const timeZone = (await getSettings())?.timezone ?? "UTC";
  const startOfToday = factoryStartOfDay(timeZone);

  const filters = {
    q,
    status,
    assigneeId,
    machineId,
    priority,
    overdue,
    startOfToday,
  };

  const [{ rows, truncated }, counts, options] = await Promise.all([
    searchWorkOrders(filters),
    workOrderStatusCounts(filters),
    queueFilterOptions(),
  ]);

  // Carry the non-status filters through the status tabs (validated values
  // only — a garbage ?assignee=foo never rides along).
  const baseParams: Record<string, string> = {};
  if (q) baseParams.q = q;
  if (assigneeId !== undefined) baseParams.assignee = String(assigneeId);
  if (machineId !== undefined) baseParams.machine = String(machineId);
  if (priority) baseParams.priority = priority;
  if (overdue) baseParams.overdue = "1";

  const activeTab: WorkStatusFilter = status ?? null;

  // Faceted counts honour the non-status filters, so their sum tells us whether
  // the *table* is empty vs merely this scope. A truly-empty queue only exists
  // when nothing is filtered and nothing was ever created.
  const explicitFilter = Boolean(
    q || assigneeId !== undefined || machineId !== undefined || priority || overdue,
  );

  // "Clear overdue" keeps every other active filter (incl. the status tab).
  const clearOverdue = new URLSearchParams(baseParams);
  clearOverdue.delete("overdue");
  if (status) clearOverdue.set("status", status);
  const clearOverdueHref = clearOverdue.toString()
    ? `/work-orders?${clearOverdue}`
    : "/work-orders";
  const trulyEmpty =
    !explicitFilter && counts.active + counts.done + counts.cancelled === 0;
  const emptyTitle = explicitFilter
    ? t.workOrders.emptyNoMatch
    : status
      ? t.workOrders.emptyByStatus[status]
      : t.workOrders.emptyNoActive;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          {t.nav.workOrders}
        </h1>
        {user.role === "admin" && (
          <Link href="/work-orders/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.workOrders.newWorkOrder}</span>
            <span className="sm:hidden">{t.workOrders.newShort}</span>
          </Link>
        )}
      </div>

      <QueueTabs active={activeTab} counts={counts} baseParams={baseParams} />

      <SearchFilterBar
        placeholder={t.workOrders.searchPlaceholder}
        selects={[
          {
            param: "assignee",
            allLabel: t.workOrders.filterAnyone,
            options: [
              { value: "unassigned", label: t.workOrders.unassigned },
              ...options.assignees.map((a) => ({
                value: String(a.id),
                label: a.name,
              })),
            ],
          },
          ...(options.machines.length
            ? [
                {
                  param: "machine",
                  allLabel: t.workOrders.filterAnyMachine,
                  options: options.machines.map((m) => ({
                    value: String(m.id),
                    label: `${m.code} · ${m.name}`,
                  })),
                },
              ]
            : []),
          {
            param: "priority",
            allLabel: t.workOrders.filterAnyPriority,
            options: PRIORITY_VALUES.map((p) => ({
              value: p,
              label: t.priority[p],
            })),
          },
        ]}
      />

      {overdue && (
        <div>
          <Link
            href={clearOverdueHref}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 font-condensed text-[13px] font-medium tracking-wide text-red-700 hover:bg-red-100"
          >
            <Clock className="h-3.5 w-3.5" />
            {t.workOrders.overdueOnly}
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {rows.length === 0 ? (
        trulyEmpty ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={t.workOrders.emptyNone}
            action={
              user.role === "admin" ? (
                <Link href="/work-orders/new" className={buttonClass("primary")}>
                  <Plus className="h-4 w-4" />
                  {t.workOrders.newWorkOrder}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title={emptyTitle}
            action={
              explicitFilter ? (
                <Link href="/work-orders" className={buttonClass("secondary")}>
                  {t.common.clearFiltersAction}
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {rows.map((wo) => {
              const overdue =
                wo.status !== "done" &&
                wo.status !== "cancelled" &&
                dueState(wo.dueDate, startOfToday).kind === "overdue";
              return (
                <Link
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  className={
                    "flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50" +
                    (overdue ? " border-l-[3px] border-l-red-600" : "")
                  }
                >
                  <Mono className="w-14 shrink-0 pt-0.5 text-[13px] text-slate-500">
                    WO-{wo.id}
                  </Mono>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] text-slate-900">
                      {wo.title}
                    </div>
                    <div className="truncate text-[13px] text-slate-500">
                      <Mono>{wo.machineCode}</Mono> · {wo.machineName}
                      {wo.assigneeName && <> · {wo.assigneeName}</>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {/* Stack the chips on phones so the title keeps its width;
                        side-by-side once there's room (sm+). */}
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
                      <PriorityChip priority={wo.priority} />
                      <WorkStatusChip status={wo.status} />
                    </div>
                    <DueCell
                      row={wo}
                      startOfToday={startOfToday}
                      timeZone={timeZone}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
          {truncated && (
            <p className="text-[13px] text-slate-500">
              {t.workOrders.truncated(100)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

async function DueCell({
  row,
  startOfToday,
  timeZone,
}: {
  row: QueueItem;
  startOfToday: number;
  timeZone: string;
}) {
  const locale = await getLocale();
  const t = await getT();
  if (row.status === "done" || row.status === "cancelled") {
    return row.completedAt ? (
      <Mono className="text-[13px] text-slate-500">
        {formatDate(row.completedAt, locale, timeZone)}
      </Mono>
    ) : (
      <span className="text-[13px] text-slate-500">—</span>
    );
  }
  const ds = dueState(row.dueDate, startOfToday);
  switch (ds.kind) {
    case "overdue":
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-red-600">
          <Clock className="h-3.5 w-3.5" />
          <Mono>
            {ds.days}
            {t.common.dayShort}
          </Mono>{" "}
          {t.due.over}
        </span>
      );
    case "today":
      return (
        <span className="inline-flex items-center gap-1 text-[13px] text-amber-700">
          <Clock className="h-3.5 w-3.5" />
          {t.due.today}
        </span>
      );
    case "future":
      return (
        <Mono className="text-[13px] text-slate-500">
          {formatDate(ds.date, locale, timeZone)}
        </Mono>
      );
    default:
      return <span className="text-[13px] text-slate-500">—</span>;
  }
}
