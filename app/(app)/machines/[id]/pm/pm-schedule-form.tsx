"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  createPmSchedule,
  updatePmSchedule,
  type FormState,
} from "../../../pm/actions";

type Option = { id: number; label: string };
export type PmFormValues = {
  title: string;
  intervalDays: number;
  nextDueDate: string; // yyyy-mm-dd
  defaultAssigneeId: number | null;
  checklist: string; // one step per line
};

export function PmScheduleForm({
  machineId,
  scheduleId,
  users,
  values,
}: {
  machineId: number;
  scheduleId?: number;
  users: Option[];
  values?: PmFormValues;
}) {
  const editing = scheduleId != null;
  const [state, action] = useActionState<FormState, FormData>(
    editing ? updatePmSchedule : createPmSchedule,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      {editing ? (
        <input type="hidden" name="scheduleId" value={scheduleId} />
      ) : (
        <input type="hidden" name="machineId" value={machineId} />
      )}

      <Field label="Title" htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          autoFocus
          defaultValue={values?.title}
          placeholder="e.g. Lubrication"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Every (days)" htmlFor="intervalDays">
          <Input
            id="intervalDays"
            name="intervalDays"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            defaultValue={values?.intervalDays ?? 30}
            className="font-mono"
          />
        </Field>
        <Field label="First due date" htmlFor="nextDueDate">
          <Input
            id="nextDueDate"
            name="nextDueDate"
            type="date"
            required
            defaultValue={values?.nextDueDate}
          />
        </Field>
      </div>

      <Field label="Default assignee" htmlFor="defaultAssigneeId">
        <Select
          id="defaultAssigneeId"
          name="defaultAssigneeId"
          defaultValue={values?.defaultAssigneeId ?? ""}
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Checklist template"
        htmlFor="checklist"
        hint="One step per line — each generated job starts with these."
      >
        <Textarea
          id="checklist"
          name="checklist"
          rows={4}
          defaultValue={values?.checklist}
          placeholder={"Check oil level\nInspect belts\nTorque mounting bolts"}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{editing ? "Save schedule" : "Create schedule"}</SubmitButton>
    </form>
  );
}
