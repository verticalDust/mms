"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { attachPart, type FormState } from "../../../actions";

export function AttachPartForm({
  machineId,
  partId,
}: {
  machineId: number;
  partId: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(attachPart, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="partId" value={partId} />
      <Field
        label="Quantity"
        htmlFor="quantity"
        hint="How many this machine uses. Optional."
      >
        <Input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="—"
          className="font-mono"
        />
      </Field>
      <Field label="Note" htmlFor="note" hint="e.g. position. Optional.">
        <Input id="note" name="note" placeholder="e.g. front bearing" />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>Attach part</SubmitButton>
    </form>
  );
}
