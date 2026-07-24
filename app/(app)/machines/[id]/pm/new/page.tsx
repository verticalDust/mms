import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, users } from "@/lib/db/schema";
import { Mono } from "@/components/ui";
import { PmScheduleForm } from "../pm-schedule-form";

export const metadata = { title: "New PM schedule · MMS" };

export default async function NewPmSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const machineId = Number((await params).id);
  if (!Number.isInteger(machineId)) notFound();

  const [machine] = await db
    .select({ id: machines.id, code: machines.code, name: machines.name, retiredAt: machines.retiredAt })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);
  if (!machine) notFound();

  const userOptions = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href={`/machines/${machineId}`}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {machine.code} · {machine.name}
      </Link>
      <div>
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          New PM schedule
        </h1>
        <p className="mt-0.5 text-[14px] text-slate-500">
          For <Mono>{machine.code}</Mono> · {machine.name}
        </p>
      </div>
      {machine.retiredAt ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-[14px] text-slate-600">
          This machine is retired — bring it back into service before scheduling PM.
        </p>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <PmScheduleForm
            machineId={machineId}
            users={userOptions.map((u) => ({ id: u.id, label: u.name }))}
          />
        </div>
      )}
    </div>
  );
}
