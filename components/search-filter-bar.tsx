"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

// The EntityList search + filter bar (SCREENS §1). All state lives in the URL,
// so it survives refresh and is shareable. Reused across machines / parts /
// queue — each caller just declares its search param, chip groups, and selects.
export type Option = { value: string; label: string };
export type ChipGroup = { param: string; allLabel?: string; options: Option[] };
export type SelectFilter = { param: string; allLabel: string; options: Option[] };

export function SearchFilterBar({
  searchParam = "q",
  placeholder = "Search…",
  chips = [],
  selects = [],
}: {
  searchParam?: string;
  placeholder?: string;
  chips?: ChipGroup[];
  selects?: SelectFilter[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  // The debounced search fires later — read the LATEST params through a ref so
  // a chip/select change made during the 250ms window isn't clobbered by a
  // stale snapshot when the timeout runs.
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const current = params.get(searchParam) ?? "";
  const [text, setText] = useState(current);

  // Reflect external URL changes (back/forward, chip clicks) into the input.
  useEffect(() => {
    setText(current);
  }, [current]);

  function commit(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(paramsRef.current.toString());
    mutate(next);
    const qs = next.toString();
    startTransition(() =>
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }),
    );
  }

  function setParam(key: string, value: string | null) {
    commit((next) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cancel a pending debounce if the bar unmounts mid-type.
  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );
  function onSearch(v: string) {
    setText(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setParam(searchParam, v.trim() || null);
    }, 250);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          inputMode="search"
          aria-label={placeholder}
          value={text}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-md border border-slate-200 bg-white pl-9 pr-12 text-[16px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onSearch("")}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {(chips.length > 0 || selects.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((group) => {
            // Fall back to "All" when the URL carries an unknown/garbage value
            // (stale link, typo) so the bar never shows every chip unselected.
            const raw = params.get(group.param);
            const active = group.options.some((o) => o.value === raw)
              ? raw
              : null;
            return (
              <div key={group.param} className="flex flex-wrap gap-2">
                <Chip
                  active={!active}
                  onClick={() => setParam(group.param, null)}
                >
                  {group.allLabel ?? "All"}
                </Chip>
                {group.options.map((o) => (
                  <Chip
                    key={o.value}
                    active={active === o.value}
                    onClick={() =>
                      setParam(group.param, active === o.value ? null : o.value)
                    }
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            );
          })}

          {selects.map((s) => {
            // Fall back to the "All" state when the URL carries a value that
            // isn't in this select's options (a stale/shared link filtered by a
            // now-deactivated user, or hand-edited garbage) — mirrors the chip
            // fallback above, so the control never renders a blank selection.
            const raw = params.get(s.param);
            const value = s.options.some((o) => o.value === raw) ? raw! : "";
            return (
              <select
                key={s.param}
                aria-label={s.allLabel}
                value={value}
                onChange={(e) => setParam(s.param, e.target.value || null)}
                className="h-11 rounded-md border border-slate-200 bg-white px-2.5 text-[14px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 cursor-pointer"
              >
                <option value="">{s.allLabel}</option>
                {s.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-11 rounded-md px-3.5 font-condensed text-[13px] font-medium tracking-wide transition-colors cursor-pointer",
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
