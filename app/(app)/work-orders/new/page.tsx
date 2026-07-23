import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, eq, isNull, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, users } from "@/lib/db/schema";
import { WorkOrderForm } from "../work-order-form";

export const metadata = { title: "New work order · MMS" };

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ machine?: string }>;
}) {
  await requireAdmin();
  const { machine } = await searchParams;

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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href="/work-orders"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Work orders
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        New work order
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <WorkOrderForm
          machines={machineOptions.map((m) => ({
            id: m.id,
            label: `${m.code} · ${m.name}`,
          }))}
          users={userOptions.map((u) => ({ id: u.id, label: u.name }))}
          defaultMachineId={machine ? Number(machine) : undefined}
        />
      </div>
    </div>
  );
}
