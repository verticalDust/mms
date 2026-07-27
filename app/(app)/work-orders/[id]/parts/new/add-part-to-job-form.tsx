"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import { addPartToJob, type FormState } from "../../../actions";

export function AddPartToJobForm({
  workOrderId,
  partId,
  onHand,
  unit,
}: {
  workOrderId: number;
  partId: number;
  onHand: number;
  unit: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(addPartToJob, {});
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="partId" value={partId} />
      <Field
        label={t.workOrders.quantityUsed}
        htmlFor="quantity"
        hint={t.workOrders.quantityHint(onHand, unit)}
      >
        <Input
          id="quantity"
          name="quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          defaultValue={1}
          required
          className="font-mono"
        />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{t.workOrders.addToJob}</SubmitButton>
    </form>
  );
}
