"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-4">
      {part && <input type="hidden" name="id" value={part.id} />}
      <Field
        label={t.parts.skuField}
        htmlFor="sku"
        hint={editing ? undefined : t.parts.skuHint}
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
      <Field label={t.parts.nameField} htmlFor="name">
        <Input id="name" name="name" required defaultValue={part?.name} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.parts.unitField} htmlFor="unit">
          <Input
            id="unit"
            name="unit"
            placeholder={t.parts.unitPlaceholder}
            defaultValue={part?.unit ?? ""}
          />
        </Field>
        <Field label={t.parts.binField} htmlFor="binLocation">
          <Input
            id="binLocation"
            name="binLocation"
            placeholder={t.parts.binPlaceholder}
            defaultValue={part?.binLocation ?? ""}
            className="font-mono"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label={t.parts.minLevelField}
          htmlFor="minLevel"
          hint={t.parts.minLevelHint}
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
        <Field label={t.parts.unitCostField} htmlFor="unitCost" hint={t.parts.unitCostHint}>
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
          label={t.parts.openingQtyField}
          htmlFor="initialQty"
          hint={t.parts.openingQtyHint}
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
      <SubmitButton>
        {editing ? t.common.saveChanges : t.parts.savePart}
      </SubmitButton>
    </form>
  );
}
