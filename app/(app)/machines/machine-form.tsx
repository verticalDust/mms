"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
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
  return (
    <form action={action} className="flex flex-col gap-4">
      {machine && <input type="hidden" name="id" value={machine.id} />}
      <Field label="Name" htmlFor="name">
        <Input
          id="name"
          name="name"
          required
          autoFocus
          defaultValue={machine?.name}
        />
      </Field>
      <Field
        label="Code"
        htmlFor="code"
        hint={
          editing
            ? "Changing this changes what its QR label points to. Reprint if it's already mounted."
            : "Suggested for you. Change it if you have your own scheme."
        }
      >
        <Input
          id="code"
          name="code"
          defaultValue={machine?.code ?? suggestedCode}
          className="font-mono"
        />
      </Field>
      <Field label="Location" htmlFor="location">
        <Input
          id="location"
          name="location"
          placeholder="e.g. Line B, bay 3"
          defaultValue={machine?.location ?? ""}
        />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={machine?.notes ?? ""} />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{editing ? "Save changes" : "Save machine"}</SubmitButton>
    </form>
  );
}
