"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
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
  const t = useT();

  return (
    <form action={action} className="flex flex-col gap-4">
      {editing ? (
        <input type="hidden" name="scheduleId" value={scheduleId} />
      ) : (
        <input type="hidden" name="machineId" value={machineId} />
      )}

      <Field label={t.pm.titleField} htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          autoFocus
          defaultValue={values?.title}
          placeholder={t.pm.titlePlaceholder}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t.pm.everyDaysField} htmlFor="intervalDays">
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
        <Field label={t.pm.firstDueField} htmlFor="nextDueDate">
          <Input
            id="nextDueDate"
            name="nextDueDate"
            type="date"
            required
            defaultValue={values?.nextDueDate}
          />
        </Field>
      </div>

      <Field label={t.pm.defaultAssignee} htmlFor="defaultAssigneeId">
        <Select
          id="defaultAssigneeId"
          name="defaultAssigneeId"
          defaultValue={values?.defaultAssigneeId ?? ""}
        >
          <option value="">{t.workOrders.unassigned}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label={t.pm.checklistTemplate}
        htmlFor="checklist"
        hint={t.pm.checklistHint}
      >
        <Textarea
          id="checklist"
          name="checklist"
          rows={4}
          defaultValue={values?.checklist}
          placeholder={t.pm.checklistPlaceholder}
        />
      </Field>

      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>
        {editing ? t.pm.saveSchedule : t.pm.createSchedule}
      </SubmitButton>
    </form>
  );
}
