"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import { attachPart, type FormState } from "../../../actions";

export function AttachPartForm({
  machineId,
  partId,
}: {
  machineId: number;
  partId: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(attachPart, {});
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="machineId" value={machineId} />
      <input type="hidden" name="partId" value={partId} />
      <Field
        label={t.machines.quantityField}
        htmlFor="quantity"
        hint={t.machines.quantityHintMachine}
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
      <Field
        label={t.machines.noteField}
        htmlFor="note"
        hint={t.machines.noteHint}
      >
        <Input id="note" name="note" placeholder={t.machines.notePlaceholder} />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{t.machines.attachPart}</SubmitButton>
    </form>
  );
}
