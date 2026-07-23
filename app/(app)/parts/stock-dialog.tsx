"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Scale, X } from "lucide-react";
import { Field, Input, Textarea, Mono, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import {
  receiveStock,
  issueStock,
  adjustStock,
  type StockFormState,
} from "./actions";

type Mode = "receive" | "issue" | "adjust";

type Cfg = {
  action: (
    prev: StockFormState,
    formData: FormData,
  ) => Promise<StockFormState>;
  title: string;
  verb: string;
  trigger: string;
  triggerVariant: "primary" | "secondary";
  icon: typeof Plus;
};

const CONFIG: Record<Mode, Cfg> = {
  receive: {
    action: receiveStock,
    title: "Receive stock",
    verb: "Receive",
    trigger: "Receive",
    triggerVariant: "primary",
    icon: Plus,
  },
  issue: {
    action: issueStock,
    title: "Issue stock",
    verb: "Issue",
    trigger: "Issue",
    triggerVariant: "secondary",
    icon: Minus,
  },
  adjust: {
    action: adjustStock,
    title: "Adjust count",
    verb: "Save count",
    trigger: "Adjust",
    triggerVariant: "secondary",
    icon: Scale,
  },
};

// One dialog shell, three modes (SCREENS §6). Native <dialog> gives the backdrop,
// focus trap, and ESC for free. The inner form is remounted on every open (keyed
// on openSeq) so each open starts from a clean action state — no stale error, and
// the close-on-success fires reliably every time (not just the first).
export function StockDialog({
  mode,
  partId,
  onHand,
  unit,
  bin,
}: {
  mode: Mode;
  partId: number;
  onHand: number;
  unit: string;
  bin: string | null;
}) {
  const cfg = CONFIG[mode];
  const Icon = cfg.icon;
  const ref = useRef<HTMLDialogElement>(null);
  const [openSeq, setOpenSeq] = useState(0);
  const titleId = `stock-${mode}-${partId}-title`;

  const open = () => {
    setOpenSeq((n) => n + 1);
    ref.current?.showModal();
  };
  const close = useCallback(() => ref.current?.close(), []);

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={buttonClass(cfg.triggerVariant)}
      >
        <Icon className="h-4 w-4" />
        {cfg.trigger}
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        // Tap the backdrop (outside the card) to dismiss on mobile.
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
      >
        <StockForm
          key={openSeq}
          cfg={cfg}
          mode={mode}
          partId={partId}
          onHand={onHand}
          unit={unit}
          bin={bin}
          titleId={titleId}
          onDone={close}
        />
      </dialog>
    </>
  );
}

function StockForm({
  cfg,
  mode,
  partId,
  onHand,
  unit,
  bin,
  titleId,
  onDone,
}: {
  cfg: Cfg;
  mode: Mode;
  partId: number;
  onHand: number;
  unit: string;
  bin: string | null;
  titleId: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<StockFormState, FormData>(
    cfg.action,
    {},
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2
            id={titleId}
            className="font-condensed text-lg font-semibold text-slate-900"
          >
            {cfg.title}
          </h2>
          <p className="text-[13px] text-slate-500">
            On hand <Mono className="text-slate-700">{onHand}</Mono> {unit}
            {bin && (
              <>
                {" · bin "}
                <Mono className="text-slate-700">{bin}</Mono>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onDone}
          className="flex h-11 w-11 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input type="hidden" name="partId" value={partId} />

      {mode === "adjust" ? (
        <Field
          label="Counted quantity"
          htmlFor="counted"
          hint="What the shelf actually holds right now."
        >
          <Input
            id="counted"
            name="counted"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            defaultValue={onHand}
            required
            autoFocus
            className="font-mono"
          />
        </Field>
      ) : (
        <Field label="Quantity" htmlFor="qty">
          <Input
            id="qty"
            name="qty"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            autoFocus
            placeholder="0"
            className="font-mono"
          />
        </Field>
      )}

      {mode === "receive" && (
        <Field label="Unit cost" htmlFor="unitCost" hint="Optional.">
          <Input
            id="unitCost"
            name="unitCost"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder="0.00"
            className="font-mono"
          />
        </Field>
      )}

      {mode === "receive" && (
        <Field label="Note" htmlFor="note">
          <Textarea id="note" name="note" placeholder="e.g. PO number, supplier" />
        </Field>
      )}

      {mode === "issue" && (
        <Field label="Reason" htmlFor="reason" hint="Why it's leaving the store.">
          <Input id="reason" name="reason" placeholder="e.g. used on Line B" />
        </Field>
      )}

      {mode === "adjust" && (
        <Field label="Reason" htmlFor="reason">
          <Input
            id="reason"
            name="reason"
            required
            placeholder="e.g. stock-take correction"
          />
        </Field>
      )}

      {state.error && (
        <p role="alert" className="text-[13px] text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-2 pt-1">
        <SubmitButton variant="primary">{cfg.verb}</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="h-11 text-[14px] text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
