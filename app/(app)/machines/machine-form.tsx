"use client";

import { useActionState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createMachine, type FormState } from "./actions";

export function MachineForm({ suggestedCode }: { suggestedCode: string }) {
  const [state, action] = useActionState<FormState, FormData>(
    createMachine,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="name">
        <Input id="name" name="name" required autoFocus />
      </Field>
      <Field
        label="Code"
        htmlFor="code"
        hint="Suggested automatically — change it if you have your own scheme."
      >
        <Input
          id="code"
          name="code"
          defaultValue={suggestedCode}
          className="font-mono"
        />
      </Field>
      <Field label="Location" htmlFor="location">
        <Input id="location" name="location" placeholder="e.g. Line B, bay 3" />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>Save machine</SubmitButton>
    </form>
  );
}
