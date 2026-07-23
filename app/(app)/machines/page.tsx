import Link from "next/link";
import { Plus, Factory, Clock } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listMachines } from "@/lib/queries";
import { buttonClass, Mono, EmptyState } from "@/components/ui";
import { MachineStatusChip } from "@/components/status-chip";
import { downtimeSince } from "@/lib/format";

export const metadata = { title: "Machines · MMS" };

export default async function MachinesPage() {
  const user = await requireUser();
  const machines = await listMachines();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Machines
        </h1>
        {user.role === "admin" && (
          <Link href="/machines/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            Add machine
          </Link>
        )}
      </div>

      {machines.length === 0 ? (
        <EmptyState
          icon={<Factory className="h-6 w-6" />}
          title="No machines yet."
          action={
            user.role === "admin" ? (
              <Link href="/machines/new" className={buttonClass("primary")}>
                <Plus className="h-4 w-4" />
                Add machine
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {machines.map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.id}`}
              className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
            >
              <Mono className="w-20 shrink-0 text-[13px] text-slate-500">
                {m.code}
              </Mono>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] text-slate-900">
                  {m.name}
                </div>
                {m.location && (
                  <div className="truncate text-[13px] text-slate-500">
                    {m.location}
                  </div>
                )}
              </div>
              {m.status === "down" && m.downSince && (
                <span className="inline-flex items-center gap-1 text-[13px] text-red-600">
                  <Clock className="h-3.5 w-3.5" />
                  <Mono>{downtimeSince(m.downSince)}</Mono>
                </span>
              )}
              <MachineStatusChip status={m.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
