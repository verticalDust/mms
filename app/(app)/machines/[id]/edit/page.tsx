import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines } from "@/lib/db/schema";
import { getT } from "@/lib/i18n/server";
import { MachineForm } from "../../machine-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.editMachine };
}

export default async function EditMachinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [machine] = await db
    .select()
    .from(machines)
    .where(eq(machines.id, id))
    .limit(1);
  if (!machine) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href={`/machines/${machine.id}`}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {machine.name}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.machines.editMachine}
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <MachineForm
          machine={{
            id: machine.id,
            code: machine.code,
            name: machine.name,
            location: machine.location,
            notes: machine.notes,
          }}
        />
      </div>
    </div>
  );
}
