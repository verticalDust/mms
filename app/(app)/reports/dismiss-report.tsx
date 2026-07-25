"use client";

import { useActionState, useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import { buttonClass, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { dismissReport, type FormState } from "./actions";

// Dismiss a report from the triage row. Collapsed to a single button until
// opened; dismissing requires a reason (server-enforced) so the record explains
// itself. On success the row revalidates away, so this just unmounts.
export function DismissReport({ reportId }: { reportId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    dismissReport,
    {},
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonClass("secondary"))}
      >
        <Ban className="h-4 w-4" />
        Dismiss
      </button>
    );
  }

  return (
    <form action={action} className="flex w-full flex-col gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <Input
        name="reason"
        required
        autoFocus
        maxLength={300}
        placeholder="Why is this being dismissed?"
      />
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={cn(buttonClass("danger"))}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Ban className="h-4 w-4" />
          )}
          Dismiss report
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={cn(buttonClass("ghost"))}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
