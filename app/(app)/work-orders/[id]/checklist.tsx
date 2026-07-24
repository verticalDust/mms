"use client";

import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Input, buttonClass } from "@/components/ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { cn } from "@/lib/cn";
import {
  addChecklistItem,
  removeChecklistItem,
  toggleChecklistItem,
  type FormState,
} from "../actions";

export type ChecklistRow = {
  id: number;
  text: string;
  checked: boolean;
  stamp: string | null; // "Maria Novak · 24 Jul, 11:10" once ticked
};

// Job checklist (E3-S5): ordered steps, each tick saves immediately with actor +
// time (optimistic so it feels instant on a phone). A planner (canManage) adds
// and removes steps; anyone working the job (canCheck) ticks them. On a closed
// job both are false, so the list renders read-only.
export function Checklist({
  workOrderId,
  items,
  canCheck,
  canManage,
}: {
  workOrderId: number;
  items: ChecklistRow[];
  canCheck: boolean;
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              workOrderId={workOrderId}
              item={item}
              canCheck={canCheck}
              canManage={canManage}
            />
          ))}
        </div>
      )}
      {canManage && <AddStepForm workOrderId={workOrderId} />}
    </div>
  );
}

function ChecklistItemRow({
  workOrderId,
  item,
  canCheck,
  canManage,
}: {
  workOrderId: number;
  item: ChecklistRow;
  canCheck: boolean;
  canManage: boolean;
}) {
  const [pending, start] = useTransition();
  const [optimisticChecked, setOptimistic] = useOptimistic(item.checked);
  const [failed, setFailed] = useState(false);
  const inputId = `chk-${item.id}`;

  function toggle() {
    start(async () => {
      setOptimistic(!item.checked);
      setFailed(false);
      // If the write is refused or contended, the transition still settles and
      // the optimistic value re-bases to the server truth (item.checked) — the
      // box un-flips itself. Catch so a thrown error reverts too, never crashes.
      try {
        const res = await toggleChecklistItem(item.id, !item.checked);
        if (!res?.ok) setFailed(true);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <input
        id={inputId}
        type="checkbox"
        checked={optimisticChecked}
        disabled={!canCheck || pending}
        onChange={toggle}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-orange-600 disabled:cursor-default"
      />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={inputId}
          className={cn(
            "text-[15px]",
            optimisticChecked ? "text-slate-500 line-through" : "text-slate-900",
            canCheck && "cursor-pointer",
          )}
        >
          {item.text}
        </label>
        {optimisticChecked && item.stamp && (
          <p className="mt-0.5 text-[12px] text-slate-500">
            Ticked · {item.stamp}
          </p>
        )}
        {failed && (
          <p role="alert" className="mt-0.5 text-[12px] text-red-600">
            Couldn&rsquo;t save — try again.
          </p>
        )}
      </div>
      {pending && (
        <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-slate-400" />
      )}
      {canManage && (
        <form action={removeChecklistItem}>
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="workOrderId" value={workOrderId} />
          <ConfirmSubmit
            compact
            label={`Remove step: ${item.text}`}
            icon={<Trash2 className="h-4 w-4" />}
            message={`Remove this step?\n\n"${item.text}"`}
          />
        </form>
      )}
    </div>
  );
}

function AddStepForm({ workOrderId }: { workOrderId: number }) {
  const [state, action] = useActionState<FormState, FormData>(
    addChecklistItem,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the input once a step lands so the planner can type the next one.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="workOrderId" value={workOrderId} />
      <div className="flex gap-2">
        <Input
          name="text"
          placeholder="Add a step…"
          maxLength={200}
          aria-label="New checklist step"
          className="flex-1"
        />
        <AddButton />
      </div>
      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClass("secondary"), "shrink-0")}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      Add
    </button>
  );
}
