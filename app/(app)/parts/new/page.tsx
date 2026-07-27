import Link from "next/link";
import { sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { PartForm } from "../parts-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.addPart };
}

export default async function NewPartPage() {
  await requireAdmin();
  const t = await getT();
  // A valid unique default (P-001, P-002…) the user overrides with the real
  // manufacturer SKU — mirrors the machine-code suggestion.
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(parts);
  const suggestedSku = `P-${String((row?.c ?? 0) + 1).padStart(3, "0")}`;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <Link
        href="/parts"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.nav.parts}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.parts.addPart}
      </h1>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <PartForm suggestedSku={suggestedSku} />
      </div>
    </div>
  );
}
