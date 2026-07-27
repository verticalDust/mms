"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Scale, X } from "lucide-react";
import { Field, Input, Textarea, Mono, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { useT } from "@/lib/i18n/client";
import type { Messages } from "@/lib/i18n/messages";
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

// Built per-locale from the catalog. The trigger reuses the ledger movement
// label so the button and the resulting ledger row read the same word.
function config(mode: Mode, t: Messages): Cfg {
  switch (mode) {
    case "receive":
      return {
        action: receiveStock,
        title: t.parts.receiveTitle,
        verb: t.parts.receiveVerb,
        trigger: t.movement.receive,
        triggerVariant: "primary",
        icon: Plus,
      };
    case "issue":
      return {
        action: issueStock,
        title: t.parts.issueTitle,
        verb: t.parts.issueVerb,
        trigger: t.movement.issue,
        triggerVariant: "secondary",
        icon: Minus,
      };
    case "adjust":
      return {
        action: adjustStock,
        title: t.parts.adjustTitle,
        verb: t.parts.adjustVerb,
        trigger: t.movement.adjust,
        triggerVariant: "secondary",
        icon: Scale,
      };
  }
}

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
  const t = useT();
  const cfg = config(mode, t);
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
  const t = useT();

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
            {t.parts.onHandLabel} <Mono className="text-slate-700">{onHand}</Mono>{" "}
            {unit}
            {bin && (
              <>
                {" · "}
                {t.parts.bin}{" "}
                <Mono className="text-slate-700">{bin}</Mono>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label={t.common.close}
          onClick={onDone}
          className="flex h-11 w-11 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input type="hidden" name="partId" value={partId} />

      {mode === "adjust" ? (
        <Field
          label={t.parts.countedQty}
          htmlFor="counted"
          hint={t.parts.countedQtyHint}
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
        <Field label={t.parts.quantityLabel} htmlFor="qty">
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
        <Field
          label={t.parts.unitCostField}
          htmlFor="unitCost"
          hint={t.parts.unitCostHint}
        >
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
        <Field label={t.machines.noteField} htmlFor="note">
          <Textarea
            id="note"
            name="note"
            placeholder={t.parts.stockNotePlaceholder}
          />
        </Field>
      )}

      {mode === "issue" && (
        <Field
          label={t.parts.reasonField}
          htmlFor="reason"
          hint={t.parts.reasonIssueHint}
        >
          <Input
            id="reason"
            name="reason"
            placeholder={t.parts.reasonIssuePlaceholder}
          />
        </Field>
      )}

      {mode === "adjust" && (
        <Field label={t.parts.reasonField} htmlFor="reason">
          <Input
            id="reason"
            name="reason"
            required
            placeholder={t.parts.reasonAdjustPlaceholder}
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
          {t.common.cancel}
        </button>
      </div>
    </form>
  );
}
