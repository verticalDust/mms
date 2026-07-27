import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Package, SearchX } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines, parts, machineParts } from "@/lib/db/schema";
import { searchUnattachedParts, stockLevel } from "@/lib/queries";
import { Mono, EmptyState, buttonClass } from "@/components/ui";
import { StockStatusChip } from "@/components/status-chip";
import { SearchFilterBar } from "@/components/search-filter-bar";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { AttachPartForm } from "./attach-part-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.addPartToMachine };
}

export default async function AttachPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const [machine] = await db
    .select({
      id: machines.id,
      code: machines.code,
      name: machines.name,
      retiredAt: machines.retiredAt,
    })
    .from(machines)
    .where(eq(machines.id, id))
    .limit(1);
  if (!machine) notFound();
  if (machine.retiredAt) redirect(`/machines/${id}`); // can't attach to retired

  const q = typeof sp.q === "string" ? sp.q : "";
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const selectedId =
    typeof sp.part === "string" ? Number(sp.part) : Number.NaN;

  // Step 2 — configure the chosen part (unless it vanished or is already on).
  if (Number.isInteger(selectedId)) {
    const [part] = await db
      .select({
        id: parts.id,
        sku: parts.sku,
        name: parts.name,
        binLocation: parts.binLocation,
        onHand: parts.onHand,
        minLevel: parts.minLevel,
        unit: parts.unit,
      })
      .from(parts)
      .where(eq(parts.id, selectedId))
      .limit(1);
    const [existing] = part
      ? await db
          .select({ id: machineParts.id })
          .from(machineParts)
          .where(
            and(
              eq(machineParts.machineId, id),
              eq(machineParts.partId, selectedId),
            ),
          )
          .limit(1)
      : [];

    if (part && !existing) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <Link
            href={`/machines/${id}/parts/new${qs}`}
            className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.workOrders.chooseDifferent}
          </Link>
          <h1 className="font-condensed text-2xl font-semibold text-slate-900">
            {t.machines.addPartToMachine(machine.name)}
          </h1>
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <Mono className="text-[13px] text-slate-500">{part.sku}</Mono>
                <div className="text-[15px] text-slate-900">{part.name}</div>
                {part.binLocation && (
                  <div className="text-[13px] text-slate-500">
                    {t.parts.bin} <Mono>{part.binLocation}</Mono>
                  </div>
                )}
              </div>
              <StockStatusChip
                level={stockLevel(part.onHand, part.minLevel)}
              />
            </div>
            <AttachPartForm machineId={id} partId={part.id} />
          </div>
        </div>
      );
    }
    // part missing or already attached → fall through to the search list.
  }

  // Step 1 — search the catalog for an unattached part.
  const raw = await searchUnattachedParts(id, q);
  const PICK_CAP = 50;
  const capped = raw.length > PICK_CAP;
  const results = capped ? raw.slice(0, PICK_CAP) : raw;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link
        href={`/machines/${id}`}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {machine.name}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.machines.addPartToMachine(machine.name)}
      </h1>

      <SearchFilterBar placeholder={t.parts.searchSkuNameBin} />

      {results.length === 0 ? (
        q ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title={t.machines.noMatchOrAttached}
          />
        ) : (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={t.machines.everyPartAttached}
            action={
              <Link href="/parts/new" className={buttonClass("secondary")}>
                {t.parts.addToCatalog}
              </Link>
            }
          />
        )
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {results.map((p) => (
              <Link
                key={p.id}
                href={`/machines/${id}/parts/new?part=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <Mono className="w-24 shrink-0 text-[13px] text-slate-500">
                  {p.sku}
                </Mono>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-slate-900">
                    {p.name}
                  </div>
                  {p.binLocation && (
                    <div className="truncate text-[13px] text-slate-500">
                      {t.parts.bin} <Mono>{p.binLocation}</Mono>
                    </div>
                  )}
                </div>
                <Mono className="text-[14px] text-slate-900">{p.onHand}</Mono>
                <StockStatusChip level={p.stock} />
              </Link>
            ))}
          </div>
          {capped && (
            <p className="text-[13px] text-slate-500">
              {t.parts.showingFirst(PICK_CAP)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
