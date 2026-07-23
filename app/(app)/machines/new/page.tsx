import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines } from "@/lib/db/schema";
import { MachineForm } from "../machine-form";

export const metadata = { title: "Add machine · MMS" };

export default async function NewMachinePage() {
  await requireAdmin();
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(machines);
  const suggested = `M-${String((row?.c ?? 0) + 1).padStart(3, "0")}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href="/machines"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Machines
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        Add machine
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <MachineForm suggestedCode={suggested} />
      </div>
    </div>
  );
}
