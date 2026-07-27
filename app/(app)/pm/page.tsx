import Link from "next/link";
import { CalendarClock, Clock, PauseCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import { listPmSchedules } from "@/lib/queries";
import { Mono, SectionLabel, EmptyState } from "@/components/ui";
import { factoryStartOfDay, dueState, formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { GeneratePmButton } from "./generate-pm-button";

export const metadata = { title: "Preventive maintenance · MMS" };

export default async function PmRegisterPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const locale = await getLocale();
  const schedules = await listPmSchedules();
  // Overdue in the factory timezone, matching the dashboard/queue (PLAN §1.5).
  const timeZone = (await getSettings())?.timezone ?? "UTC";
  const startOfToday = factoryStartOfDay(timeZone);
  const active = schedules.filter((s) => !s.paused);
  const overdue = active.filter(
    (s) => dueState(s.nextDueDate, startOfToday).kind === "overdue",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-condensed text-2xl font-semibold text-slate-900">
            Preventive maintenance
          </h1>
          <p className="mt-0.5 text-[14px] text-slate-500">
            {active.length} active schedule{active.length === 1 ? "" : "s"}
            {overdue > 0 && (
              <>
                {" · "}
                <span className="text-red-600">{overdue} overdue</span>
              </>
            )}
          </p>
        </div>
        {isAdmin && <GeneratePmButton />}
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="No PM schedules yet. Add one from any machine's page to plan routine care."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {schedules.map((s) => {
            const ds = dueState(s.nextDueDate, startOfToday);
            const overdueRow = !s.paused && ds.kind === "overdue";
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
                  overdueRow && "border-l-[3px] border-l-red-600",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-slate-900">
                    {s.title}
                  </div>
                  <Link
                    href={`/machines/${s.machineId}`}
                    className="mt-0.5 inline-flex items-center gap-1.5 truncate text-[13px] text-slate-500 hover:text-slate-700"
                  >
                    <Mono>{s.machineCode}</Mono>
                    <span className="min-w-0 truncate">{s.machineName}</span>
                  </Link>
                  <div className="mt-0.5 text-[13px] text-slate-500">
                    Every {s.intervalDays} days
                    {s.assigneeName ? ` · ${s.assigneeName}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[13px]">
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
                      Next <Mono>{formatDate(s.nextDueDate, locale)}</Mono>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
