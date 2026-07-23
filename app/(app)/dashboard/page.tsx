import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDashboardCounts, listWorkOrders } from "@/lib/queries";
import { Mono, SectionLabel, EmptyState } from "@/components/ui";
import {
  WorkStatusChip,
  PriorityChip,
  ClearChip,
  StatusChip,
} from "@/components/status-chip";
import { OctagonX, TriangleAlert, Clock, Inbox, ClipboardList } from "lucide-react";
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
  await requireUser();
  const counts = await getDashboardCounts();
  const now = Date.now();

  const queue = (await listWorkOrders(["open", "in_progress"]))
    .map((r) => ({
      ...r,
      overdueMs:
        r.dueDate && r.dueDate.getTime() < now
          ? now - r.dueDate.getTime()
          : 0,
    }))
    .sort((a, b) => {
      if (a.overdueMs !== b.overdueMs) return b.overdueMs - a.overdueMs;
      const ad = a.dueDate?.getTime() ?? Infinity;
      const bd = b.dueDate?.getTime() ?? Infinity;
      return ad - bd;
    })
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Dashboard
        </h1>
      </div>

      {/* Five-gauge readout row — single-ink numbers, status in rail + chip */}
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
          href="/work-orders"
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
          href="/machines"
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
          href="/parts"
          tone="amber"
          hot={counts.lowStock > 0}
          clearWord="Stock OK"
          hotChip={
            <StatusChip tone="amber" icon={TriangleAlert}>
              Low stock
            </StatusChip>
          }
        />
        <Gauge
          label="Untriaged reports"
          value={counts.untriaged}
          href="/work-orders"
          tone="slate"
          hot={counts.untriaged > 0}
          clearWord="Inbox clear"
          hotChip={
            <StatusChip tone="slate" icon={Inbox}>
              To triage
            </StatusChip>
          }
        />
      </div>

      {/* Work queue — overdue first */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Open work · overdue first</SectionLabel>
        {queue.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="No open work orders."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {queue.map((wo) => (
              <Link
                key={wo.id}
                href={`/work-orders/${wo.id}`}
                className={cn(
                  "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50",
                  wo.overdueMs > 0 && "border-l-[3px] border-l-red-600",
                )}
              >
                <Mono className="w-16 shrink-0 text-[13px] text-slate-500">
                  WO-{wo.id}
                </Mono>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-slate-900">
                    {wo.title}
                  </div>
                  <div className="truncate text-[13px] text-slate-500">
                    <Mono>{wo.machineCode}</Mono> · {wo.machineName}
                  </div>
                </div>
                <PriorityChip priority={wo.priority} />
                <WorkStatusChip status={wo.status} />
                <div className="w-24 shrink-0 text-right">
                  {wo.overdueMs > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[13px] text-red-600">
                      <Clock className="h-3.5 w-3.5" />
                      <Mono>{Math.floor(wo.overdueMs / 86_400_000)}d</Mono> over
                    </span>
                  ) : wo.dueDate ? (
                    <Mono className="text-[13px] text-slate-500">
                      {wo.dueDate.toLocaleDateString()}
                    </Mono>
                  ) : (
                    <span className="text-[13px] text-slate-400">—</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
