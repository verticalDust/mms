import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { eq, isNull, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, users } from "@/lib/db/schema";
import { getReport } from "@/lib/queries";
import { WorkOrderForm } from "../work-order-form";

export const metadata = { title: "New work order · MMS" };

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string; fromReport?: string }>;
}) {
  await requireAdmin();
  const { machine, fromReport } = await searchParams;

  // Triage → job (E5-S2): load the report and prefill. Only an untriaged report
  // on a live machine prefills; anything else falls back to a blank form.
  const reportId = fromReport ? Number(fromReport) : NaN;
  const report = Number.isInteger(reportId) ? await getReport(reportId) : null;
  const fromValidReport =
    report && report.status === "new" && !report.machineRetiredAt
      ? report
      : null;

  const machineOptions = await db
    .select({ id: machines.id, code: machines.code, name: machines.name })
    .from(machines)
    .where(isNull(machines.retiredAt))
    .orderBy(asc(machines.code));

  const userOptions = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name));

  const backHref = fromValidReport ? "/reports" : "/work-orders";
  const backLabel = fromValidReport ? "Triage" : "Work orders";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {fromValidReport ? "Work order from report" : "New work order"}
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <WorkOrderForm
          machines={machineOptions.map((m) => ({
            id: m.id,
            label: `${m.code} · ${m.name}`,
          }))}
          users={userOptions.map((u) => ({ id: u.id, label: u.name }))}
          defaultMachineId={machine ? Number(machine) : undefined}
          reportId={fromValidReport ? fromValidReport.id : undefined}
          defaultTitle={
            fromValidReport
              ? fromValidReport.description.replace(/\s+/g, " ").trim().slice(0, 80)
              : undefined
          }
          defaultDescription={
            fromValidReport ? fromValidReport.description : undefined
          }
          lockedMachine={
            fromValidReport
              ? {
                  id: fromValidReport.machineId,
                  label: `${fromValidReport.machineCode} · ${fromValidReport.machineName}`,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
