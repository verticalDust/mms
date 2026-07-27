"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Select, Mono } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import { createWorkOrder, type FormState } from "./actions";

type Option = { id: number; label: string };

export function WorkOrderForm({
  machines,
  users,
  defaultMachineId,
  reportId,
  defaultTitle,
  defaultDescription,
  lockedMachine,
}: {
  machines: Option[];
  users: Option[];
  defaultMachineId?: number;
  // Triage → job (E5-S2): carries the report link, prefilled text, and a machine
  // fixed to the report's equipment (so it can't be reassigned in the form).
  reportId?: number;
  defaultTitle?: string;
  defaultDescription?: string;
  lockedMachine?: { id: number; label: string };
}) {
  const [state, action] = useActionState<FormState, FormData>(
    createWorkOrder,
    {},
  );
  const t = useT();
  return (
    <form action={action} className="flex flex-col gap-4">
      {reportId != null && (
        <input type="hidden" name="reportId" value={reportId} />
      )}
      <Field label={t.workOrders.titleField} htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          autoFocus
          defaultValue={defaultTitle}
        />
      </Field>
      {lockedMachine ? (
        <Field label={t.workOrders.machineField}>
          {/* Machine is set by the report — shown, not chosen. */}
          <input type="hidden" name="machineId" value={lockedMachine.id} />
          <div className="flex h-11 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-[15px] text-slate-700">
            <Mono>{lockedMachine.label}</Mono>
          </div>
        </Field>
      ) : (
        <Field label={t.workOrders.machineField} htmlFor="machineId">
          <Select
            id="machineId"
            name="machineId"
            required
            defaultValue={defaultMachineId ?? ""}
          >
            <option value="" disabled>
              {t.workOrders.selectMachine}
            </option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.workOrders.priorityField} htmlFor="priority">
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">{t.priority.low}</option>
            <option value="medium">{t.priority.medium}</option>
            <option value="high">{t.priority.high}</option>
            <option value="critical">{t.priority.critical}</option>
          </Select>
        </Field>
        <Field label={t.workOrders.dueDateField} htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" />
        </Field>
      </div>
      <Field label={t.workOrders.assigneeField} htmlFor="assigneeId">
        <Select id="assigneeId" name="assigneeId" defaultValue="">
          <option value="">{t.workOrders.unassigned}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t.workOrders.descriptionField} htmlFor="description">
        <Textarea
          id="description"
          name="description"
          defaultValue={defaultDescription}
        />
      </Field>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton>{t.workOrders.createWorkOrder}</SubmitButton>
    </form>
  );
}
