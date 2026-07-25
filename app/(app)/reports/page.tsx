import Link from "next/link";
import { Clock, Inbox, ClipboardPlus, User, Ban } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listNewReports } from "@/lib/queries";
import { formatDuration } from "@/lib/format";
import { Mono, SectionLabel, EmptyState } from "@/components/ui";
import { ClearChip } from "@/components/status-chip";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DismissReport } from "./dismiss-report";

export const metadata = { title: "Triage · MMS" };

// Triage queue (E5-S2) — new reports awaiting a decision, oldest first. Each is
// turned into a work order (prefilled) or dismissed with a reason. Planner-only;
// the nav badge tracks the count and the queue green-flips when clear.
export default async function ReportsPage() {
  await requireAdmin();
  const reports = await listNewReports();
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Triage
        </h1>
        {reports.length === 0 ? (
          <ClearChip>Inbox clear</ClearChip>
        ) : (
          <span className="font-condensed text-[13px] font-medium tracking-wide text-slate-500">
            {reports.length} waiting
          </span>
        )}
      </div>

      <SectionLabel>Reported faults · oldest first</SectionLabel>

      {reports.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title="No reports waiting — the floor's all quiet."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 border-l-[3px] border-l-slate-300 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/machines/${r.machineId}`}
                  className="min-w-0 hover:underline"
                >
                  <Mono className="text-[13px] text-slate-500">
                    {r.machineCode}
                  </Mono>
                  <div className="truncate font-condensed text-[15px] font-medium text-slate-900">
                    {r.machineName}
                  </div>
                </Link>
                <span className="inline-flex shrink-0 items-center gap-1 text-[13px] text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  <Mono>{formatDuration(now - r.createdAt.getTime())}</Mono>
                </span>
              </div>

              <div className="flex gap-3">
                {r.hasPhoto && (
                  <Link
                    href={`/reports/${r.id}/photo`}
                    target="_blank"
                    className="shrink-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/reports/${r.id}/photo`}
                      alt="Reported fault"
                      className="h-16 w-16 rounded-md border border-slate-200 object-cover"
                    />
                  </Link>
                )}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
                    {r.description}
                  </p>
                  {r.reporterName && (
                    <div className="mt-1 inline-flex items-center gap-1 text-[13px] text-slate-500">
                      <User className="h-3.5 w-3.5" />
                      {r.reporterName}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-start gap-2 border-t border-slate-100 pt-3">
                {r.machineRetired ? (
                  // A retired machine refuses new work orders — this report can
                  // only be dismissed, so don't offer a dead-end Create action.
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-500">
                    <Ban className="h-4 w-4" />
                    Machine retired — dismiss only
                  </span>
                ) : (
                  <Link
                    href={`/work-orders/new?fromReport=${r.id}`}
                    className={cn(buttonClass("primary"))}
                  >
                    <ClipboardPlus className="h-4 w-4" />
                    Create work order
                  </Link>
                )}
                <DismissReport reportId={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
