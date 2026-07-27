import * as React from "react";
import {
  CircleDot,
  OctagonX,
  TriangleAlert,
  PlayCircle,
  Check,
  Circle,
  Clock,
  Ban,
  CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { getT } from "@/lib/i18n/server";

// Status is NEVER color alone — every chip carries color + icon + word.
type Tone = "red" | "amber" | "green" | "slate";

// Status-chip surfaces route through the semantic tokens in globals.css (red =
// destructive, amber = caution, green = good); slate is neutral chrome and stays
// on Tailwind's scale. The tokens equal the same hues, so this is swappability,
// not a recolor.
const tones: Record<Tone, string> = {
  red: "bg-destructive-tint text-destructive-ink",
  amber: "bg-caution-tint text-caution-ink",
  green: "bg-good-tint text-good-ink",
  slate: "bg-slate-100 text-slate-600",
};

export function StatusChip({
  tone,
  icon: Icon,
  children,
}: {
  tone: Tone;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5",
        "font-condensed text-[12px] font-medium tracking-wide",
        tones[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {children}
    </span>
  );
}

// The status chips are async server components: they read the current locale's
// labels from the catalog (getT), which is the single source of status wording.
// Safe because every importer is a server page (no client component renders a
// chip directly).
export async function MachineStatusChip({
  status,
}: {
  status: "running" | "down" | "retired";
}) {
  const t = await getT();
  if (status === "down")
    return (
      <StatusChip tone="red" icon={OctagonX}>
        {t.status.machine.down}
      </StatusChip>
    );
  if (status === "retired")
    return (
      <StatusChip tone="slate" icon={Ban}>
        {t.status.machine.retired}
      </StatusChip>
    );
  return (
    <StatusChip tone="green" icon={CircleDot}>
      {t.status.machine.running}
    </StatusChip>
  );
}

export async function WorkStatusChip({
  status,
}: {
  status: "open" | "in_progress" | "done" | "cancelled";
}) {
  const t = await getT();
  switch (status) {
    case "in_progress":
      return (
        <StatusChip tone="amber" icon={PlayCircle}>
          {t.status.work.in_progress}
        </StatusChip>
      );
    case "done":
      return (
        <StatusChip tone="green" icon={Check}>
          {t.status.work.done}
        </StatusChip>
      );
    case "cancelled":
      return (
        <StatusChip tone="slate" icon={Ban}>
          {t.status.work.cancelled}
        </StatusChip>
      );
    default:
      return (
        <StatusChip tone="slate" icon={Circle}>
          {t.status.work.open}
        </StatusChip>
      );
  }
}

export async function PriorityChip({
  priority,
}: {
  priority: "low" | "medium" | "high" | "critical";
}) {
  const t = await getT();
  if (priority === "critical")
    return (
      <StatusChip tone="red" icon={TriangleAlert}>
        {t.priority.critical}
      </StatusChip>
    );
  if (priority === "high")
    return (
      <StatusChip tone="amber" icon={TriangleAlert}>
        {t.priority.high}
      </StatusChip>
    );
  return (
    <StatusChip tone="slate" icon={Circle}>
      {priority === "medium" ? t.priority.medium : t.priority.low}
    </StatusChip>
  );
}

export async function StockStatusChip({
  level,
}: {
  level: "out" | "low" | "ok";
}) {
  const t = await getT();
  if (level === "out")
    return (
      <StatusChip tone="red" icon={OctagonX}>
        {t.status.stock.out}
      </StatusChip>
    );
  if (level === "low")
    return (
      <StatusChip tone="amber" icon={TriangleAlert}>
        {t.status.stock.low}
      </StatusChip>
    );
  return (
    <StatusChip tone="green" icon={CircleCheck}>
      {t.status.stock.ok}
    </StatusChip>
  );
}

// The green-flip: a zero/all-clear count renders as reassurance, not a dead 0.
export function ClearChip({ children }: { children: React.ReactNode }) {
  return (
    <StatusChip tone="green" icon={CircleCheck}>
      {children}
    </StatusChip>
  );
}

export { Clock };
