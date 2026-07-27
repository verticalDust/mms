import Link from "next/link";
import { Plus, Factory, Clock, Printer, SearchX } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  searchMachines,
  listMachineLocations,
  machineIdsWithPm,
  type MachineStatusFilter,
} from "@/lib/queries";
import { buttonClass, Mono, EmptyState } from "@/components/ui";
import { MachineStatusChip } from "@/components/status-chip";
import { SearchFilterBar } from "@/components/search-filter-bar";
import { downtimeSince } from "@/lib/format";
import { getLocale } from "@/lib/i18n/server";

export const metadata = { title: "Machines · MMS" };

const STATUS_VALUES: MachineStatusFilter[] = ["running", "down", "retired"];

// A subtle left rail so status reads at a glance down the column (SCREENS §1).
const rail: Record<string, string> = {
  down: "border-l-red-600",
  retired: "border-l-slate-300",
  running: "border-l-transparent",
};

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q : "";
  const status = STATUS_VALUES.includes(sp.status as MachineStatusFilter)
    ? (sp.status as MachineStatusFilter)
    : undefined;
  const location = typeof sp.location === "string" ? sp.location : undefined;
  const noPm = sp.pm === "none";
  const filtered = Boolean(q || status || location || noPm);

  const [machinesRaw, locations, pmIds] = await Promise.all([
    searchMachines({ q, status, location }),
    listMachineLocations(),
    machineIdsWithPm(),
  ]);
  // "No PM" discovery filter (E4-S5): machines with no schedule at all.
  const machines = noPm
    ? machinesRaw.filter((m) => !pmIds.has(m.id))
    : machinesRaw;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          Machines
        </h1>
        {/* On the true-empty state the empty-state CTA is the sole primary, so
            the header actions step aside (one orange primary per screen). */}
        {user.role === "admin" && (machines.length > 0 || filtered) && (
          <div className="flex items-center gap-2">
            <Link href="/print/labels" className={buttonClass("secondary")}>
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print labels</span>
            </Link>
            <Link href="/machines/new" className={buttonClass("primary")}>
              <Plus className="h-4 w-4" />
              Add machine
            </Link>
          </div>
        )}
      </div>

      <SearchFilterBar
        placeholder="Search code, name or location…"
        chips={[
          {
            param: "status",
            options: [
              { value: "running", label: "Running" },
              { value: "down", label: "Down" },
              { value: "retired", label: "Retired" },
            ],
          },
          {
            param: "pm",
            options: [{ value: "none", label: "No PM" }],
          },
        ]}
        selects={
          locations.length
            ? [
                {
                  param: "location",
                  allLabel: "All locations",
                  options: locations.map((l) => ({ value: l, label: l })),
                },
              ]
            : []
        }
      />

      {machines.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title="No machines match these filters."
            action={
              <Link href="/machines" className={buttonClass("secondary")}>
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Factory className="h-6 w-6" />}
            title="No machines yet."
            action={
              user.role === "admin" ? (
                <Link href="/machines/new" className={buttonClass("primary")}>
                  <Plus className="h-4 w-4" />
                  Add machine
                </Link>
              ) : undefined
            }
          />
        )
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {machines.map((m) => (
            <Link
              key={m.id}
              href={`/machines/${m.id}`}
              className={`flex items-center gap-3 border-b border-b-slate-100 border-l-[3px] px-4 py-3 last:border-b-0 hover:bg-slate-50 ${rail[m.status]}`}
            >
              <Mono className="w-20 shrink-0 text-[13px] text-slate-500">
                {m.code}
              </Mono>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] text-slate-900">
                  {m.name}
                </div>
                {m.location && (
                  <div className="truncate text-[13px] text-slate-500">
                    {m.location}
                  </div>
                )}
              </div>
              {m.status === "down" && m.downSince && (
                <span className="inline-flex items-center gap-1 text-[13px] text-red-600">
                  <Clock className="h-3.5 w-3.5" />
                  <Mono>{downtimeSince(m.downSince, locale)}</Mono>
                </span>
              )}
              <MachineStatusChip status={m.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
