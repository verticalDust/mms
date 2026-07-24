"use client";

import type { MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { Play, Check, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";

// One-tap Start / Done for the My-work list (E3-S4). The button doubles as the
// status indicator: an open job shows Start, an in-progress job shows Done.
// `label` disambiguates the repeated buttons for screen-reader / voice control.
// `confirmMessage`, when set, warns before completing a job with unticked
// checklist steps (E3-S5) — warn, never block, same as the job detail page.
export function JobAction({
  kind,
  label,
  confirmMessage,
}: {
  kind: "start" | "done";
  label: string;
  confirmMessage?: string;
}) {
  const { pending } = useFormStatus();
  const done = kind === "done";
  const guard = (e: MouseEvent) => {
    if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
  };
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      onClick={guard}
      className={buttonClass(done ? "primary" : "secondary")}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : done ? (
        <Check className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
      {done ? "Done" : "Start"}
    </button>
  );
}
