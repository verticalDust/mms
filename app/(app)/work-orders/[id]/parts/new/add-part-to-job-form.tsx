"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
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
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <input type="hidden" name="partId" value={partId} />
      <Field
        label="Quantity used"
        htmlFor="quantity"
        hint={`${onHand} ${unit} on hand — stock drops by what you record.`}
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
      <SubmitButton>Add to job</SubmitButton>
    </form>
  );
}
