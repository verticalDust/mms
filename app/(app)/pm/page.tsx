import Link from "next/link";
import { CalendarClock, Clock, PauseCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import { listPmSchedules } from "@/lib/queries";
import { Mono, SectionLabel, EmptyState } from "@/components/ui";
import { factoryStartOfDay, dueState, formatDate } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { cn } from "@/lib/cn";
import { GeneratePmButton } from "./generate-pm-button";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.pm };
}

export default async function PmRegisterPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const locale = await getLocale();
  const t = await getT();
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
            {t.nav.pm}
          </h1>
          <p className="mt-0.5 text-[14px] text-slate-500">
            {t.pm.activeSchedules(active.length)}
            {overdue > 0 && (
              <>
                {" · "}
                <span className="text-red-600">
                  {t.pm.overdueCount(overdue)}
                </span>
              </>
            )}
          </p>
        </div>
        {isAdmin && <GeneratePmButton />}
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title={t.pm.emptyNone}
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
                    {t.machines.everyDays(s.intervalDays)}
                    {s.assigneeName ? ` · ${s.assigneeName}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right text-[13px]">
                  {s.paused ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <PauseCircle className="h-3.5 w-3.5" /> {t.machines.paused}
                    </span>
                  ) : ds.kind === "overdue" ? (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <Clock className="h-3.5 w-3.5" />
                      <Mono>
                        {ds.days}
                        {t.common.dayShort}
                      </Mono>{" "}
                      {t.pm.overdue}
                    </span>
                  ) : ds.kind === "today" ? (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <Clock className="h-3.5 w-3.5" /> {t.due.today}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {t.pm.next}{" "}
                      <Mono>{formatDate(s.nextDueDate, locale)}</Mono>
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
