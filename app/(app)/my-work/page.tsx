import Link from "next/link";
import { Wrench, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/setup";
import { searchWorkOrders, uncheckedStepsFor } from "@/lib/queries";
import { Mono, EmptyState } from "@/components/ui";
import { factoryStartOfDay, dueState, formatDate } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { cn } from "@/lib/cn";
import { startWork, completeWork } from "../work-orders/actions";
import { JobAction } from "./job-action";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.myWork };
}

export default async function MyWorkPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getT();
  // Active jobs assigned to me, overdue-first (same query the queue uses).
  const { rows } = await searchWorkOrders({ assigneeId: user.id });
  // "Overdue" in the factory timezone, matching the dashboard + queue (§1.5).
  const timeZone = (await getSettings())?.timezone ?? "UTC";
  const startOfToday = factoryStartOfDay(timeZone);
  // Unticked steps per job, so a one-tap Done can warn before skipping them.
  const uncheckedByJob = await uncheckedStepsFor(rows.map((r) => r.id));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          {t.nav.myWork}
        </h1>
        <p className="mt-0.5 text-[14px] text-slate-500">{t.myWork.subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title={t.myWork.empty}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((wo) => {
            const ds = dueState(wo.dueDate, startOfToday);
            const overdue = ds.kind === "overdue";
            // Only an in-progress job completes from here; warn if it still has
            // unticked steps (warn, never block — same wording as the job page).
            const unticked =
              wo.status === "open" ? [] : uncheckedByJob.get(wo.id) ?? [];
            const doneWarning =
              unticked.length > 0
                ? t.workOrders.doneWarning(unticked)
                : undefined;
            return (
              <div
                key={wo.id}
                className={cn(
                  "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0",
                  overdue && "border-l-[3px] border-l-red-600",
                )}
              >
                <Link
                  href={`/work-orders/${wo.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 hover:opacity-80"
                >
                  <span className="truncate text-[15px] text-slate-900">
                    {wo.title}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-[13px] text-slate-500">
                    <Mono>WO-{wo.id}</Mono>
                    <span aria-hidden>·</span>
                    <Mono>{wo.machineCode}</Mono>
                    <span className="min-w-0 truncate">{wo.machineName}</span>
                    {ds.kind === "overdue" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-red-600">
                        <span aria-hidden>·</span>
                        <Clock className="h-3.5 w-3.5" />
                        <Mono>
                          {ds.days}
                          {t.common.dayShort}
                        </Mono>{" "}
                        {t.due.over}
                      </span>
                    ) : ds.kind === "today" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-amber-700">
                        <span aria-hidden>·</span>
                        <Clock className="h-3.5 w-3.5" />
                        {t.due.today}
                      </span>
                    ) : ds.kind === "future" ? (
                      <span className="shrink-0">
                        <span aria-hidden>· </span>
                        {t.due.duePrefix}{" "}
                        <Mono>{formatDate(ds.date, locale, timeZone)}</Mono>
                      </span>
                    ) : null}
                  </span>
                </Link>

                <form
                  action={wo.status === "open" ? startWork : completeWork}
                  className="shrink-0"
                >
                  <input type="hidden" name="workOrderId" value={wo.id} />
                  <JobAction
                    kind={wo.status === "open" ? "start" : "done"}
                    label={
                      wo.status === "open"
                        ? t.myWork.startAria(wo.id, wo.title)
                        : t.myWork.completeAria(wo.id, wo.title)
                    }
                    confirmMessage={doneWarning}
                  />
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
