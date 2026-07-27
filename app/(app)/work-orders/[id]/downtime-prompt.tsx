"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { resolveDowntimeForJob } from "../actions";

// Breakdown → downtime close (E3-S8). Shown on a finished job whose machine is
// still marked Down: one tap ends that downtime period and links it to this job.
// Declining is just not tapping — the machine stays Down, the offer stays put.
export function DowntimePrompt({
  workOrderId,
  machineId,
  machineCode,
  downLabel,
}: {
  workOrderId: number;
  machineId: number;
  machineCode: string;
  downLabel: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-slate-900">
            {machineCode} is still marked Down.
          </p>
          <p className="mt-0.5 text-[13px] text-slate-600">
            Down {downLabel}. Is it running again now that this job is done?
          </p>
        </div>
      </div>
      <form
        action={resolveDowntimeForJob}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="workOrderId" value={workOrderId} />
        <MarkRunningButton />
        <Link href={`/machines/${machineId}`} className={buttonClass("secondary")}>
          Machine page
        </Link>
      </form>
      <p className="text-[12px] text-slate-500">
        Leaving it Down is fine. Mark it running here or on the machine page when
        it&rsquo;s back.
      </p>
    </div>
  );
}

function MarkRunningButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("primary")}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      Yes, mark it running
    </button>
  );
}
