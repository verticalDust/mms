"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Factory,
  CalendarClock,
  Package,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type BadgeKey = "lowStock" | "untriaged";
type Item = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: BadgeKey;
  // Triage is a planner task done at a desk — keep it off the technician's
  // (already full) mobile tab bar, on the desktop sidebar only.
  desktopOnly?: boolean;
};

// Only routes that exist today. More light up as their epics land.
const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-work", label: "My work", icon: Wrench },
  { href: "/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/machines", label: "Machines", icon: Factory },
  { href: "/reports", label: "Reports", icon: Inbox, badge: "untriaged", desktopOnly: true },
  { href: "/pm", label: "PM", icon: CalendarClock },
  { href: "/parts", label: "Parts", icon: Package, badge: "lowStock" },
];

export type NavCounts = { lowStock?: number; untriaged?: number };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function badgeCount(item: Item, counts: NavCounts): number {
  if (item.badge === "lowStock") return counts.lowStock ?? 0;
  if (item.badge === "untriaged") return counts.untriaged ?? 0;
  return 0;
}

// Low-stock rides amber (a caution); untriaged rides slate — severity is unknown
// until a human assesses it (SCREENS §1). Both clear themselves because the
// layout recomputes the counts on every navigation.
const SIDEBAR_BADGE: Record<BadgeKey, string> = {
  lowStock: "bg-amber-100 text-amber-700",
  untriaged: "bg-slate-200 text-slate-700",
};

export function Sidebar(counts: NavCounts = {}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, href);
        const badge = badgeCount(item, counts);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors",
              active
                ? "bg-slate-100 font-medium text-slate-900"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {label}
            {badge > 0 && item.badge && (
              <span
                className={cn(
                  "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-medium tabular-nums",
                  SIDEBAR_BADGE[item.badge],
                )}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs(counts: NavCounts = {}) {
  const pathname = usePathname();
  const items = ITEMS.filter((i) => !i.desktopOnly);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
      {items.map((item) => {
        const { href, label, icon: Icon } = item;
        const active = isActive(pathname, href);
        const badge = badgeCount(item, counts);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 font-condensed text-[11px] tracking-wide",
              active ? "text-orange-600" : "text-slate-500",
            )}
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {badge > 0 && (
                <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-semibold tabular-nums text-amber-950">
                  {badge}
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
