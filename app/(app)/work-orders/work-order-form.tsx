"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createWorkOrder, type FormState } from "./actions";

type Option = { id: number; label: string };

export function WorkOrderForm({
  machines,
  users,
  defaultMachineId,
}: {
  machines: Option[];
  users: Option[];
  defaultMachineId?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createWorkOrder,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" required autoFocus />
      </Field>
      <Field label="Machine" htmlFor="machineId">
        <Select
          id="machineId"
          name="machineId"
          required
          defaultValue={defaultMachineId ?? ""}
        >
          <option value="" disabled>
            Select a machine
          </option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Field>
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" />
        </Field>
      </div>
      <Field label="Assignee" htmlFor="assigneeId">
        <Select id="assigneeId" name="assigneeId" defaultValue="">
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="description">
        <Textarea id="description" name="description" />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>Create work order</SubmitButton>
    </form>
  );
}
