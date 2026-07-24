import Link from "next/link";
import { Wrench, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { searchWorkOrders } from "@/lib/queries";
import { Mono, EmptyState } from "@/components/ui";
import { startOfLocalDay, dueState } from "@/lib/format";
import { cn } from "@/lib/cn";
import { startWork, completeWork } from "../work-orders/actions";
import { JobAction } from "./job-action";

export const metadata = { title: "My work · MMS" };

export default async function MyWorkPage() {
  const user = await requireUser();
  // Active jobs assigned to me, overdue-first (same query the queue uses).
  const { rows } = await searchWorkOrders({ assigneeId: user.id });
  const startOfToday = startOfLocalDay();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          My work
        </h1>
        <p className="mt-0.5 text-[14px] text-slate-500">
          Your open jobs, soonest due first.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wrench className="h-6 w-6" />}
          title="No jobs assigned to you. New work lands here when the planner assigns it."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((wo) => {
            const ds = dueState(wo.dueDate, startOfToday);
            const overdue = ds.kind === "overdue";
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
                        <Mono>{ds.days}d</Mono> over
                      </span>
                    ) : ds.kind === "today" ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-amber-700">
                        <span aria-hidden>·</span>
                        <Clock className="h-3.5 w-3.5" />
                        Due today
                      </span>
                    ) : ds.kind === "future" ? (
                      <span className="shrink-0">
                        <span aria-hidden>· </span>due{" "}
                        <Mono>{ds.date.toLocaleDateString()}</Mono>
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
                    label={`${
                      wo.status === "open" ? "Start" : "Complete"
                    } WO-${wo.id} — ${wo.title}`}
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
