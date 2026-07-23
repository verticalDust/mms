"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
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
  { href: "/work-orders", label: "Work orders", icon: ClipboardList },
  { href: "/machines", label: "Machines", icon: Factory },
  { href: "/parts", label: "Parts", icon: Package },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
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
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-condensed tracking-wide",
              active ? "text-orange-600" : "text-slate-500",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
