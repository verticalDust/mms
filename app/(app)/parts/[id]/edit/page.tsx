import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { PartForm } from "../../parts-form";

export const metadata = { title: "Edit part · MMS" };

export default async function EditPartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [part] = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  if (!part) notFound();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href={`/parts/${part.id}`}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {part.name}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        Edit part
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <PartForm
          part={{
            id: part.id,
            sku: part.sku,
            name: part.name,
            unit: part.unit,
            binLocation: part.binLocation,
            minLevel: part.minLevel,
            unitCost: part.unitCost,
          }}
        />
      </div>
    </div>
  );
}
