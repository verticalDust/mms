"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { buttonClass } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { generatePmNow, type GenerateState } from "./actions";

// Manual trigger for the same idempotent generation the daily cron runs — lets a
// planner pull upcoming PM jobs into the queue on demand (E4-S2).
export function GeneratePmButton() {
  const [state, action] = useActionState<GenerateState, FormData>(
    generatePmNow,
    {},
  );
  const t = useT();
  return (
    <form action={action} className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <GenButton />
      {state.generated != null && (
        <span className="text-[13px] text-slate-500">
          {state.generated === 0
            ? t.pm.nothingDue
            : t.pm.generated(state.generated)}
        </span>
      )}
      {state.error && (
        <span role="alert" className="text-[13px] text-red-600">
          {state.error}
        </span>
      )}
    </form>
  );
}

function GenButton() {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("secondary")}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {t.pm.generateDue}
    </button>
  );
}
