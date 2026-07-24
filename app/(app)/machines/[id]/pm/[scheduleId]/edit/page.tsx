import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, users } from "@/lib/db/schema";
import { getPmSchedule } from "@/lib/queries";
import { parseChecklistTemplate } from "@/lib/pm";
import { toDateInputValue } from "@/lib/format";
import { Mono } from "@/components/ui";
import { PmScheduleForm } from "../../pm-schedule-form";

export const metadata = { title: "Edit PM schedule · MMS" };

export default async function EditPmSchedulePage({
  params,
}: {
  params: Promise<{ id: string; scheduleId: string }>;
}) {
  await requireAdmin();
  const { id, scheduleId } = await params;
  const machineId = Number(id);
  const sId = Number(scheduleId);
  if (!Number.isInteger(machineId) || !Number.isInteger(sId)) notFound();

  const schedule = await getPmSchedule(sId);
  if (!schedule || schedule.machineId !== machineId) notFound();

  const [machine] = await db
    .select({ code: machines.code, name: machines.name })
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
          Edit PM schedule
        </h1>
        <p className="mt-0.5 text-[14px] text-slate-500">
          <Mono>{machine.code}</Mono> · {machine.name}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <PmScheduleForm
          machineId={machineId}
          scheduleId={sId}
          users={userOptions.map((u) => ({ id: u.id, label: u.name }))}
          values={{
            title: schedule.title,
            intervalDays: schedule.intervalDays,
            nextDueDate: toDateInputValue(schedule.nextDueDate),
            defaultAssigneeId: schedule.defaultAssigneeId,
            checklist: parseChecklistTemplate(schedule.checklistTemplate).join("\n"),
          }}
        />
      </div>
    </div>
  );
}
