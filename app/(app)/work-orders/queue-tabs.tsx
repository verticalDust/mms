import Link from "next/link";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/server";
import type { QueueCounts } from "@/lib/queries";

// Status tabs with live counts (E3-S2). These are navigation links, not an ARIA
// tab widget — activating one performs a full RSC navigation to a new URL, so we
// use <nav> + aria-current rather than role="tablist"/"tab" (which would promise
// an in-place panel switch and keyboard model we don't implement). State lives
// in the URL — shareable, survives refresh, no client JS. Each link carries the
// other active filters forward; only `status` changes.
export async function QueueTabs({
  active,
  counts,
  baseParams,
}: {
  active: WorkStatusFilter;
  counts: QueueCounts;
  baseParams: Record<string, string>;
}) {
  const t = await getT();
  const tabs: { value: WorkStatusFilter; label: string; count: number }[] = [
    { value: null, label: t.workOrders.tabs.active, count: counts.active },
    { value: "open", label: t.workOrders.tabs.open, count: counts.open },
    {
      value: "in_progress",
      label: t.workOrders.tabs.in_progress,
      count: counts.in_progress,
    },
    { value: "done", label: t.workOrders.tabs.done, count: counts.done },
    {
      value: "cancelled",
      label: t.workOrders.tabs.cancelled,
      count: counts.cancelled,
    },
  ];

  function href(value: WorkStatusFilter) {
    const p = new URLSearchParams(baseParams);
    if (value) p.set("status", value);
    const qs = p.toString();
    return qs ? `/work-orders?${qs}` : "/work-orders";
  }

  return (
    <nav
      aria-label={t.workOrders.tabsAria}
      className="flex gap-2 overflow-x-auto pb-1"
    >
      {tabs.map((t) => {
        const isActive = t.value === active;
        return (
          <Link
            key={t.value ?? "active"}
            href={href(t.value)}
            scroll={false}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3.5",
              "font-condensed text-[13px] font-medium tracking-wide transition-colors",
              isActive
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded px-1.5 font-mono text-[12px] tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {t.count}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// null ⇒ the default "Active" tab (open + in progress).
export type WorkStatusFilter =
  | null
  | "open"
  | "in_progress"
  | "done"
  | "cancelled";
