import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ArrowLeft, Package, SearchX, Wrench } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { workOrders, machines, parts } from "@/lib/db/schema";
import { listMachineParts, searchParts, stockLevel } from "@/lib/queries";
import type { Metadata } from "next";
import { Mono, EmptyState, buttonClass, SectionLabel } from "@/components/ui";
import { StockStatusChip } from "@/components/status-chip";
import { SearchFilterBar } from "@/components/search-filter-bar";
import { getT } from "@/lib/i18n/server";
import { AddPartToJobForm } from "./add-part-to-job-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.addPartToJob };
}

type PickRow = {
  id: number;
  sku: string;
  name: string;
  binLocation: string | null;
  onHand: number;
  stock: "out" | "low" | "ok";
};

const PICK_CAP = 50;

export default async function AddJobPartPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireUser();
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;

  const [wo] = await db
    .select({
      id: workOrders.id,
      title: workOrders.title,
      status: workOrders.status,
      machineId: machines.id,
    })
    .from(workOrders)
    .innerJoin(machines, eq(workOrders.machineId, machines.id))
    .where(eq(workOrders.id, id))
    .limit(1);
  if (!wo) notFound();
  // A closed job's parts are locked — nothing to add.
  if (wo.status === "done" || wo.status === "cancelled")
    redirect(`/work-orders/${id}`);

  const q = typeof sp.q === "string" ? sp.q : "";
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  const selectedId = typeof sp.part === "string" ? Number(sp.part) : Number.NaN;

  // Step 2 — set the quantity used for the chosen part.
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

    if (part) {
      return (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <Link
            href={`/work-orders/${id}/parts/new${qs}`}
            className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {t.workOrders.chooseDifferent}
          </Link>
          <h1 className="font-condensed text-2xl font-semibold text-slate-900">
            {t.workOrders.addPartToWo(wo.id)}
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
              <div className="flex flex-col items-end gap-1">
                <StockStatusChip level={stockLevel(part.onHand, part.minLevel)} />
                <div className="text-[13px] text-slate-500">
                  {t.parts.onHand(part.onHand, part.unit)}
                </div>
              </div>
            </div>
            <AddPartToJobForm
              workOrderId={wo.id}
              partId={part.id}
              onHand={part.onHand}
              unit={part.unit}
            />
          </div>
        </div>
      );
    }
    // part vanished → fall through to the picker.
  }

  // Step 1 — pick a part. With no search, the machine's own spares surface first
  // (E2-S10 quick-pick); searching spans the whole catalog.
  const fitment = q ? [] : await listMachineParts(wo.machineId);
  let results: PickRow[];
  let heading: string;
  let capped = false;
  let suggested = false;

  if (q) {
    const raw = await searchParts({ q });
    capped = raw.length > PICK_CAP;
    results = (capped ? raw.slice(0, PICK_CAP) : raw).map(toPick);
    heading = t.parts.headingSearchResults;
  } else if (fitment.length) {
    results = fitment.map((p) => ({
      id: p.partId,
      sku: p.sku,
      name: p.name,
      binLocation: p.binLocation,
      onHand: p.onHand,
      stock: p.stock,
    }));
    heading = t.parts.headingSuggestedMachine;
    suggested = true;
  } else {
    const raw = await searchParts();
    capped = raw.length > PICK_CAP;
    results = (capped ? raw.slice(0, PICK_CAP) : raw).map(toPick);
    heading = t.parts.headingAll;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <Link
        href={`/work-orders/${id}`}
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        WO-{wo.id} · {wo.title}
      </Link>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.workOrders.addPartToWo(wo.id)}
      </h1>

      <SearchFilterBar placeholder={t.parts.searchSkuName} />

      {results.length === 0 ? (
        <EmptyState
          icon={
            q ? (
              <SearchX className="h-6 w-6" />
            ) : (
              <Package className="h-6 w-6" />
            )
          }
          title={q ? t.parts.noMatchSearch : t.parts.noneInCatalog}
          action={
            !q ? (
              <Link href="/parts/new" className={buttonClass("secondary")}>
                {t.parts.addToCatalog}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            {suggested && <Wrench className="h-3.5 w-3.5 text-slate-400" />}
            <SectionLabel>{heading}</SectionLabel>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {results.map((p) => (
              <Link
                key={p.id}
                href={`/work-orders/${id}/parts/new?part=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
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
          {suggested && (
            <p className="text-[13px] text-slate-500">
              {t.workOrders.needAnother}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function toPick(p: {
  id: number;
  sku: string;
  name: string;
  binLocation: string | null;
  onHand: number;
  stock: "out" | "low" | "ok";
}): PickRow {
  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    binLocation: p.binLocation,
    onHand: p.onHand,
    stock: p.stock,
  };
}
