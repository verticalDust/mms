"use client";

import { useFormStatus } from "react-dom";
import { Play, Check, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui";

// One-tap Start / Done for the My-work list (E3-S4). The button doubles as the
// status indicator: an open job shows Start, an in-progress job shows Done.
// `label` disambiguates the repeated buttons for screen-reader / voice control.
export function JobAction({
  kind,
  label,
}: {
  kind: "start" | "done";
  label: string;
}) {
  const { pending } = useFormStatus();
  const done = kind === "done";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
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
