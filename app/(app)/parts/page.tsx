import { asc } from "drizzle-orm";
import { Package, TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schema";
import { Mono, EmptyState } from "@/components/ui";
import { StatusChip, ClearChip } from "@/components/status-chip";

export const metadata = { title: "Parts · MMS" };

export default async function PartsPage() {
  await requireUser();
  const rows = await db.select().from(parts).orderBy(asc(parts.sku));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        Parts
      </h1>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="No parts yet. The stock module lands in the next milestone."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.map((p) => {
            const low = p.onHand <= p.minLevel;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <Mono className="w-24 shrink-0 text-[13px] text-slate-500">
                  {p.sku}
                </Mono>
                <div className="min-w-0 flex-1 truncate text-[15px] text-slate-900">
                  {p.name}
                </div>
                <Mono className="w-16 text-right text-[14px] text-slate-900">
                  {p.onHand}
                </Mono>
                {low ? (
                  <StatusChip tone="amber" icon={TriangleAlert}>
                    Low stock
                  </StatusChip>
                ) : (
                  <ClearChip>OK</ClearChip>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
