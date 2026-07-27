"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createPart, updatePart, type FormState } from "./actions";

type Existing = {
  id: number;
  sku: string;
  name: string;
  unit: string;
  binLocation: string | null;
  minLevel: number;
  unitCost: number | null;
};

// One form, two modes: create (with optional opening stock) or edit (catalog
// fields only — on-hand changes only through the ledger, never here).
export function PartForm({
  part,
  suggestedSku,
}: {
  part?: Existing;
  suggestedSku?: string;
}) {
  const editing = Boolean(part);
  const [state, action] = useActionState<FormState, FormData>(
    editing ? updatePart : createPart,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      {part && <input type="hidden" name="id" value={part.id} />}
      <Field
        label="SKU"
        htmlFor="sku"
        hint={editing ? undefined : "Suggested for you. Replace with the real part number."}
      >
        <Input
          id="sku"
          name="sku"
          required
          autoFocus
          defaultValue={part?.sku ?? suggestedSku}
          className="font-mono"
        />
      </Field>
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required defaultValue={part?.name} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Unit" htmlFor="unit">
          <Input
            id="unit"
            name="unit"
            placeholder="pcs"
            defaultValue={part?.unit ?? ""}
          />
        </Field>
        <Field label="Bin" htmlFor="binLocation">
          <Input
            id="binLocation"
            name="binLocation"
            placeholder="e.g. B-3"
            defaultValue={part?.binLocation ?? ""}
            className="font-mono"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Minimum level"
          htmlFor="minLevel"
          hint="Reorder at or below this."
        >
          <Input
            id="minLevel"
            name="minLevel"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={part?.minLevel ?? 0}
            className="font-mono"
          />
        </Field>
        <Field label="Unit cost" htmlFor="unitCost" hint="Optional.">
          <Input
            id="unitCost"
            name="unitCost"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            defaultValue={part?.unitCost ?? ""}
            className="font-mono"
          />
        </Field>
      </div>
      {!editing && (
        <Field
          label="Quantity on hand now"
          htmlFor="initialQty"
          hint="Optional opening stock, recorded as the first ledger movement."
        >
          <Input
            id="initialQty"
            name="initialQty"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={0}
            className="font-mono"
          />
        </Field>
      )}
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{editing ? "Save changes" : "Save part"}</SubmitButton>
    </form>
  );
}
