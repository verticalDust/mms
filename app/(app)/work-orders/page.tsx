import Link from "next/link";
import { Plus, ClipboardList, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listWorkOrders } from "@/lib/queries";
import { buttonClass, Mono, EmptyState } from "@/components/ui";
import { WorkStatusChip, PriorityChip } from "@/components/status-chip";

export const metadata = { title: "Work orders · MMS" };

export default async function WorkOrdersPage() {
  const user = await requireUser();
  const now = Date.now();

  const queue = (await listWorkOrders(["open", "in_progress"]))
    .map((r) => ({
      ...r,
      overdueMs:
        r.dueDate && r.dueDate.getTime() < now ? now - r.dueDate.getTime() : 0,
    }))
    .sort((a, b) => {
      if (a.overdueMs !== b.overdueMs) return b.overdueMs - a.overdueMs;
      const ad = a.dueDate?.getTime() ?? Infinity;
      const bd = b.dueDate?.getTime() ?? Infinity;
      return ad - bd;
    });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Work orders
        </h1>
        {user.role === "admin" && (
          <Link href="/work-orders/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            New work order
          </Link>
        )}
      </div>

      {queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No open work orders."
          action={
            user.role === "admin" ? (
              <Link href="/work-orders/new" className={buttonClass("primary")}>
                <Plus className="h-4 w-4" />
                New work order
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {queue.map((wo) => (
            <Link
              key={wo.id}
              href={`/work-orders/${wo.id}`}
              className={
                "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50" +
                (wo.overdueMs > 0 ? " border-l-[3px] border-l-red-600" : "")
              }
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
  );
}
