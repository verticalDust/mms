import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import {
  getDashboardCounts,
  listWorkOrders,
  type QueueRow,
} from "@/lib/queries";
import { Mono, SectionLabel, EmptyState } from "@/components/ui";
import {
  WorkStatusChip,
  PriorityChip,
  ClearChip,
  StatusChip,
} from "@/components/status-chip";
import {
  OctagonX,
  TriangleAlert,
  Clock,
  Inbox,
  ClipboardList,
} from "lucide-react";
import {
  bucketBoundaries,
  bucketOf,
  dueState,
  formatDate,
  type WorkBucket,
  type BucketBoundaries,
} from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Dashboard · MMS" };

type Tone = "red" | "amber" | "slate";

function Gauge({
  label,
  value,
  href,
  tone,
  hot,
  clearWord,
  hotChip,
}: {
  label: string;
  value: number;
  href: string;
  tone: Tone;
  hot: boolean;
  clearWord: string;
  hotChip: React.ReactNode;
}) {
  const rail =
    hot && tone === "red"
      ? "border-l-red-600"
      : hot && tone === "amber"
        ? "border-l-amber-500"
        : "border-l-slate-300";
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-slate-200 border-l-[3px] bg-white p-4 transition-colors hover:bg-slate-50",
        rail,
      )}
    >
      <div className="font-condensed text-[13px] font-medium tracking-wide text-slate-600">
        {label}
      </div>
      <Mono className="text-[26px] font-medium leading-none text-slate-900">
        {value}
      </Mono>
      <div>{hot ? hotChip : <ClearChip>{clearWord}</ClearChip>}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const timeZone = (await getSettings())?.timezone ?? "UTC";
  // Every "today / overdue / this week" decision is made in the factory's zone,
  // not the server's (PLAN §1.5) — the gauge count, the queue rail, and these
  // buckets all read the same boundaries, so they can never disagree.
  const bounds = bucketBoundaries(timeZone);
  const counts = await getDashboardCounts(bounds.startOfToday);

  const openWork = await listWorkOrders(["open", "in_progress"]);

  // Partition once into the four buckets; within each, soonest-due first and
  // undated last (Overdue thus reads most-overdue → least).
  const buckets: Record<WorkBucket, QueueRow[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };
  for (const wo of openWork) buckets[bucketOf(wo.dueDate, bounds)].push(wo);
  const byDue = (a: QueueRow, b: QueueRow) =>
    (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
  for (const k of Object.keys(buckets) as WorkBucket[]) buckets[k].sort(byDue);

  const isAdmin = user.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Dashboard
        </h1>
      </div>

      {/* Gauge readout row — each tile deep-links to its filtered list */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Gauge
          label="Open jobs"
          value={counts.openJobs}
          href="/work-orders"
          tone="slate"
          hot={false}
          clearWord="None open"
          hotChip={null}
        />
        <Gauge
          label="Overdue"
          value={counts.overdue}
          href="/work-orders?overdue=1"
          tone="red"
          hot={counts.overdue > 0}
          clearWord="None overdue"
          hotChip={
            <StatusChip tone="red" icon={TriangleAlert}>
              Overdue
            </StatusChip>
          }
        />
        <Gauge
          label="Machines down"
          value={counts.machinesDown}
          href="/machines?status=down"
          tone="red"
          hot={counts.machinesDown > 0}
          clearWord="All running"
          hotChip={
            <StatusChip tone="red" icon={OctagonX}>
              Down
            </StatusChip>
          }
        />
        <Gauge
          label="Low stock"
          value={counts.lowStock}
          href="/parts?low=1"
          tone="amber"
          hot={counts.lowStock > 0}
          clearWord="Stock OK"
          hotChip={
            <StatusChip tone="amber" icon={TriangleAlert}>
              Low stock
            </StatusChip>
          }
        />
        {/* Triage is admin-only — a technician tapping this would bounce off
            /reports' requireAdmin() straight back here, so don't offer it. */}
        {isAdmin && (
          <Gauge
            label="Untriaged reports"
            value={counts.untriaged}
            href="/reports"
            tone="slate"
            hot={counts.untriaged > 0}
            clearWord="Inbox clear"
            hotChip={
              <StatusChip tone="slate" icon={Inbox}>
                To triage
              </StatusChip>
            }
          />
        )}
      </div>

      {/* Open work, bucketed in factory time — the standup screen (E6-S2) */}
      <div className="flex flex-col gap-5">
        <SectionLabel>Open work · this week</SectionLabel>
        {openWork.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No open work orders."
          />
        ) : (
          <div className="flex flex-col gap-5">
            <Bucket
              bucket="overdue"
              label="Overdue"
              rows={buckets.overdue}
              clearWord="None overdue"
              timeZone={timeZone}
              bounds={bounds}
            />
            <Bucket
              bucket="today"
              label="Today"
              rows={buckets.today}
              clearWord="Nothing due today"
              timeZone={timeZone}
              bounds={bounds}
            />
            <Bucket
              bucket="week"
              label="This week"
              rows={buckets.week}
              clearWord="Nothing later this week"
              timeZone={timeZone}
              bounds={bounds}
            />
            <Bucket
              bucket="later"
              label="Later"
              rows={buckets.later}
              clearWord="Nothing scheduled later"
              timeZone={timeZone}
              bounds={bounds}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// A due-date bucket: header (label + count, or a green-flip when empty) over the
// job rows. Only the Overdue bucket carries the red rail + red count.
function Bucket({
  bucket,
  label,
  rows,
  clearWord,
  timeZone,
  bounds,
}: {
  bucket: WorkBucket;
  label: string;
  rows: QueueRow[];
  clearWord: string;
  timeZone: string;
  bounds: BucketBoundaries;
}) {
  const countTone =
    bucket === "overdue"
      ? "bg-red-50 text-red-700"
      : bucket === "today"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        {rows.length === 0 ? (
          <ClearChip>{clearWord}</ClearChip>
        ) : (
          <span
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-medium tabular-nums",
              countTone,
            )}
          >
            {rows.length}
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((wo) => (
            <JobRow
              key={wo.id}
              wo={wo}
              overdueRail={bucket === "overdue"}
              timeZone={timeZone}
              bounds={bounds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({
  wo,
  overdueRail,
  timeZone,
  bounds,
}: {
  wo: QueueRow;
  overdueRail: boolean;
  timeZone: string;
  bounds: BucketBoundaries;
}) {
  return (
    <Link
      href={`/work-orders/${wo.id}`}
      className={cn(
        "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50",
        overdueRail && "border-l-[3px] border-l-red-600",
      )}
    >
      <Mono className="w-16 shrink-0 text-[13px] text-slate-500">
        WO-{wo.id}
      </Mono>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] text-slate-900">{wo.title}</div>
        <div className="truncate text-[13px] text-slate-500">
          <Mono>{wo.machineCode}</Mono> · {wo.machineName}
        </div>
      </div>
      <div className="hidden shrink-0 sm:block">
        <PriorityChip priority={wo.priority} />
      </div>
      <WorkStatusChip status={wo.status} />
      <div className="w-24 shrink-0 text-right">
        <DueCell dueDate={wo.dueDate} timeZone={timeZone} bounds={bounds} />
      </div>
    </Link>
  );
}

async function DueCell({
  dueDate,
  timeZone,
  bounds,
}: {
  dueDate: Date | null;
  timeZone: string;
  bounds: BucketBoundaries;
}) {
  const locale = await getLocale();
  // Pass startOfTomorrow so the "today" label agrees with bucketOf on a
  // DST-transition day (both use the same DST-correct boundary).
  const ds = dueState(dueDate, bounds.startOfToday, bounds.startOfTomorrow);
  if (ds.kind === "overdue")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-red-600">
        <Clock className="h-3.5 w-3.5" />
        <Mono>{ds.days}d</Mono> over
      </span>
    );
  if (ds.kind === "today")
    return (
      <span className="inline-flex items-center gap-1 text-[13px] text-amber-700">
        <Clock className="h-3.5 w-3.5" />
        Due today
      </span>
    );
  if (ds.kind === "future")
    return (
      <Mono className="text-[13px] text-slate-500">
        {formatDate(ds.date, locale, timeZone)}
      </Mono>
    );
  return <span className="text-[13px] text-slate-500">No date</span>;
}
