"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import { createMachine, updateMachine, type FormState } from "./actions";

type Existing = {
  id: number;
  code: string;
  name: string;
  location: string | null;
  notes: string | null;
};

// One form, two modes: create (suggested code) or edit (existing machine).
export function MachineForm({
  suggestedCode,
  machine,
}: {
  suggestedCode?: string;
  machine?: Existing;
}) {
  const editing = Boolean(machine);
  const [state, action] = useActionState<FormState, FormData>(
    editing ? updateMachine : createMachine,
    {},
  );
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-4">
      {machine && <input type="hidden" name="id" value={machine.id} />}
      <Field label={t.machines.nameField} htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={machine?.name}
        />
      </Field>
      <Field
        label={t.machines.codeField}
        htmlFor="code"
        hint={editing ? t.machines.codeHintEdit : t.machines.codeHintNew}
      >
        <Input
          id="code"
          name="code"
          defaultValue={machine?.code ?? suggestedCode}
          className="font-mono"
        />
      </Field>
      <Field label={t.machines.locationField} htmlFor="location">
        <Input
          id="location"
          name="location"
          placeholder={t.machines.locationPlaceholder}
          defaultValue={machine?.location ?? ""}
        />
      </Field>
      <Field label={t.machines.notesField} htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={machine?.notes ?? ""} />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>
        {editing ? t.common.saveChanges : t.machines.saveMachine}
      </SubmitButton>
    </form>
  );
}
