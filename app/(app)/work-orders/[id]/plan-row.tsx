"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil } from "lucide-react";
import { Field, Input, Select, buttonClass } from "@/components/ui";
import { updateWorkOrderPlan, type FormState } from "../actions";

type UserOption = { id: number; label: string };
type Priority = "low" | "medium" | "high" | "critical";

// Plan line in the WO header (E3-S9). Everyone sees assignee + due; a planner
// gets an Edit button that swaps in an inline reassign/reschedule/reprioritize
// form. The button is only rendered when the caller passes canManage (admin on
// an open/in-progress job) — the server action re-checks the permission anyway.
export function PlanRow({
  workOrderId,
  canManage,
  assigneeName,
  dueLabel,
  assigneeId,
  dueValue,
  priority,
  users,
}: {
  workOrderId: number;
  canManage: boolean;
  assigneeName: string;
  dueLabel: string | null;
  assigneeId: number | null;
  dueValue: string;
  priority: Priority;
  users: UserOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(
    updateWorkOrderPlan,
    {},
  );

  // Collapse back to the read line once a save lands. Re-runs on every dispatch
  // (useActionState returns a fresh state object each time), so a second edit
  // closes too; reopening doesn't change state, so the editor stays open.
  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state]);

  if (!editing) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-[14px] text-slate-500">
        <span>
          Assignee:{" "}
          <span className="text-slate-700">{assigneeName}</span>
        </span>
        {dueLabel && (
          <span>
            Due: <span className="text-slate-700">{dueLabel}</span>
          </span>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-[44px] items-center gap-1 text-slate-500 hover:text-slate-700"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
    >
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Assignee" htmlFor="assigneeId">
          <Select
            id="assigneeId"
            name="assigneeId"
            defaultValue={assigneeId ?? ""}
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Due date" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={dueValue} />
        </Field>
        <Field label="Priority" htmlFor="priority">
          <Select id="priority" name="priority" defaultValue={priority}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </Select>
        </Field>
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <SaveButton />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className={buttonClass("secondary")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("primary")}
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      Save
    </button>
  );
}
