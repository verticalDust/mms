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

// Status is NEVER color alone — every chip carries color + icon + word.
type Tone = "red" | "amber" | "green" | "slate";

const tones: Record<Tone, string> = {
  red: "bg-red-50 text-red-700",
  amber: "bg-amber-50 text-amber-700",
  green: "bg-green-50 text-green-700",
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

export function MachineStatusChip({
  status,
}: {
  status: "running" | "down" | "retired";
}) {
  if (status === "down")
    return (
      <StatusChip tone="red" icon={OctagonX}>
        Down
      </StatusChip>
    );
  if (status === "retired")
    return (
      <StatusChip tone="slate" icon={Ban}>
        Retired
      </StatusChip>
    );
  return (
    <StatusChip tone="green" icon={CircleDot}>
      Running
    </StatusChip>
  );
}

export function WorkStatusChip({
  status,
}: {
  status: "open" | "in_progress" | "done" | "cancelled";
}) {
  switch (status) {
    case "in_progress":
      return (
        <StatusChip tone="amber" icon={PlayCircle}>
          In progress
        </StatusChip>
      );
    case "done":
      return (
        <StatusChip tone="green" icon={Check}>
          Done
        </StatusChip>
      );
    case "cancelled":
      return (
        <StatusChip tone="slate" icon={Ban}>
          Cancelled
        </StatusChip>
      );
    default:
      return (
        <StatusChip tone="slate" icon={Circle}>
          Open
        </StatusChip>
      );
  }
}

export function PriorityChip({
  priority,
}: {
  priority: "low" | "medium" | "high" | "critical";
}) {
  if (priority === "critical")
    return (
      <StatusChip tone="red" icon={TriangleAlert}>
        Critical
      </StatusChip>
    );
  if (priority === "high")
    return (
      <StatusChip tone="amber" icon={TriangleAlert}>
        High
      </StatusChip>
    );
  const label = priority === "medium" ? "Medium" : "Low";
  return (
    <StatusChip tone="slate" icon={Circle}>
      {label}
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
