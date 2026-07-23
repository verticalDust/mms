import Link from "next/link";
import { Plus, Package, SearchX, CircleCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { searchParts } from "@/lib/queries";
import { buttonClass, Mono, EmptyState } from "@/components/ui";
import { StockStatusChip } from "@/components/status-chip";
import { SearchFilterBar } from "@/components/search-filter-bar";

export const metadata = { title: "Parts · MMS" };

const rail: Record<string, string> = {
  out: "border-l-red-600",
  low: "border-l-amber-500",
  ok: "border-l-transparent",
};

export default async function PartsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : "";
  const low = sp.low === "1";
  const filtered = Boolean(q || low);

  const parts = await searchParts({ q, low });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Parts
        </h1>
        {user.role === "admin" && (parts.length > 0 || filtered) && (
          <Link href="/parts/new" className={buttonClass("primary")}>
            <Plus className="h-4 w-4" />
            Add part
          </Link>
        )}
      </div>

      <SearchFilterBar
        placeholder="Search SKU, name or bin…"
        chips={[
          {
            param: "low",
            allLabel: "All parts",
            options: [{ value: "1", label: "Low stock" }],
          },
        ]}
      />

      {parts.length === 0 ? (
        low && !q ? (
          <EmptyState
            icon={<CircleCheck className="h-6 w-6 text-green-600" />}
            title="Nothing to reorder — every part is at or above its minimum."
          />
        ) : filtered ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No parts match these filters."
            action={
              <Link href="/parts" className={buttonClass("secondary")}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="No parts yet."
            action={
              user.role === "admin" ? (
                <Link href="/parts/new" className={buttonClass("primary")}>
                  <Plus className="h-4 w-4" />
                  Add part
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {parts.map((p) => {
            const short = Math.max(p.minLevel - p.onHand, 0);
            return (
              <Link
                key={p.id}
                href={`/parts/${p.id}`}
                className={`flex items-center gap-3 border-b border-b-slate-100 border-l-[3px] px-4 py-3 last:border-b-0 hover:bg-slate-50 ${rail[p.stock]}`}
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
                      bin <Mono>{p.binLocation}</Mono>
                    </div>
                  )}
                </div>
                <div className="w-20 shrink-0 text-right">
                  <Mono className="text-[15px] text-slate-900">{p.onHand}</Mono>
                  <span className="text-[12px] text-slate-500"> / {p.minLevel}</span>
                  {p.stock !== "ok" && short > 0 && (
                    <div className="text-[12px] text-amber-700">need {short}</div>
                  )}
                </div>
                <StockStatusChip level={p.stock} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
