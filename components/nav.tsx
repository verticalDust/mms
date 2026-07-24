"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  ClipboardList,
  Factory,
  Package,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

type Item = { href: string; label: string; icon: LucideIcon };

// Only routes that exist today. More light up as their epics land.
const ITEMS: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-work", label: "My work", icon: Wrench },
  { href: "/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/machines", label: "Machines", icon: Factory },
  { href: "/parts", label: "Parts", icon: Package },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// The low-stock count rides on the Parts item (E2-S7); it clears itself when
// stock recovers because the layout recomputes it on every navigation.
function badgeFor(href: string, lowStock: number): number {
  return href === "/parts" ? lowStock : 0;
}

export function Sidebar({ lowStock = 0 }: { lowStock?: number }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge = badgeFor(href, lowStock);
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
            {badge > 0 && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 font-mono text-[11px] font-medium tabular-nums text-amber-700">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs({ lowStock = 0 }: { lowStock?: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge = badgeFor(href, lowStock);
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
