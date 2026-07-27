import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  parts,
  stockMovements,
  workOrderParts,
  workOrders,
} from "@/lib/db/schema";
import type { Messages } from "@/lib/i18n/messages";

// Invariant #1 lives here. Every change to stock goes through recordMovement,
// which inserts a signed movement AND updates parts.onHand in ONE transaction,
// so the cached on-hand can never drift from SUM(movements). on-hand is never
// allowed to go negative. Corrections are new reversing rows — nothing is ever
// updated or deleted in the ledger.

export type MovementType = "receive" | "issue" | "adjust" | "reverse";

export type StockErrorCode = "NOT_FOUND" | "INSUFFICIENT" | "INVALID";

export class StockError extends Error {
  code: StockErrorCode;
  onHand?: number;
  bin?: string | null;
  constructor(
    code: StockErrorCode,
    message: string,
    extra?: { onHand?: number; bin?: string | null },
  ) {
    super(message);
    this.name = "StockError";
    this.code = code;
    this.onHand = extra?.onHand;
    this.bin = extra?.bin ?? null;
  }
}

// Translate a StockError for display, by code. The messages carried on the
// StockError itself stay English for logs; the UI text comes from the catalog.
// INVALID paths are defensive races (the actions pre-validate), so they collapse
// to one generic message.
export function stockErrorMessage(e: StockError, t: Messages): string {
  if (e.code === "INSUFFICIENT")
    return t.stock.insufficient(e.onHand ?? 0, e.bin ?? null);
  if (e.code === "NOT_FOUND") return t.stock.partGone;
  return t.stock.invalid;
}

type MovementInput = {
  partId: number;
  type: MovementType;
  // receive/issue/reverse: the signed delta (+receive, −issue). adjust: omit and
  // pass `setTo` (the counted on-hand); the delta is computed inside the tx so
  // the "was X now Y" is atomic against concurrent movements.
  delta?: number;
  setTo?: number;
  reason?: string | null;
  note?: string | null;
  workOrderId?: number | null;
  reversesMovementId?: number | null;
  actorId: number;
};

// The transaction type drizzle hands the `db.transaction` callback — so the same
// movement logic can run standalone OR composed with other writes in one tx.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The invariant-#1 core, given a transaction. Callers that need to atomically
// pair a movement with another write (e.g. a work-order part line) run this and
// their own insert inside a single db.transaction.
export async function recordMovementTx(
  tx: Tx,
  input: MovementInput,
): Promise<{ movementId: number; delta: number; balanceAfter: number }> {
  const [part] = await tx
    .select({ onHand: parts.onHand, bin: parts.binLocation })
    .from(parts)
    .where(eq(parts.id, input.partId))
    .limit(1);
  if (!part) throw new StockError("NOT_FOUND", "That part no longer exists.");

  const delta =
    input.setTo !== undefined ? input.setTo - part.onHand : (input.delta ?? 0);

  const balanceAfter = part.onHand + delta;
  if (balanceAfter < 0) {
    throw new StockError(
      "INSUFFICIENT",
      `Recorded stock is ${part.onHand}${part.bin ? `, bin ${part.bin}` : ""}.`,
      { onHand: part.onHand, bin: part.bin },
    );
  }

  // A zero-delta movement (e.g. adjusting to the count already on record) is a
  // no-op — don't clutter the append-only ledger with a quantity-0 row.
  if (delta === 0) {
    return { movementId: 0, delta: 0, balanceAfter: part.onHand };
  }

  const [mv] = await tx
    .insert(stockMovements)
    .values({
      partId: input.partId,
      type: input.type,
      quantity: delta,
      balanceAfter,
      reason: input.reason ?? null,
      note: input.note ?? null,
      workOrderId: input.workOrderId ?? null,
      reversesMovementId: input.reversesMovementId ?? null,
      actorId: input.actorId,
    })
    .returning({ id: stockMovements.id });

  await tx
    .update(parts)
    .set({ onHand: balanceAfter, updatedAt: new Date() })
    .where(eq(parts.id, input.partId));

  return { movementId: mv.id, delta, balanceAfter };
}

export async function recordMovement(
  input: MovementInput,
): Promise<{ movementId: number; delta: number; balanceAfter: number }> {
  return db.transaction((tx) => recordMovementTx(tx, input));
}

// ── Work-order parts (E3-S6) ─────────────────────────────────────────────────

// Throws INVALID if the job is closed — used inside the issue tx so the
// "closed jobs are locked" rule is atomic with the ledger write.
async function assertJobOpenTx(tx: Tx, workOrderId: number): Promise<void> {
  const [wo] = await tx
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);
  if (!wo) throw new StockError("INVALID", "That work order no longer exists.");
  if (wo.status === "done" || wo.status === "cancelled")
    throw new StockError(
      "INVALID",
      "This job is closed — parts can only be logged on an open job.",
    );
}

// Issue a part against a work order: the stock Issue movement AND the
// work_order_parts line are written in ONE transaction, so a job line can never
// exist without its ledger movement (or vice-versa). Throws StockError on
// insufficient stock, rolling the whole thing back.
export async function issuePartToWorkOrder(input: {
  workOrderId: number;
  partId: number;
  quantity: number; // positive count used
  actorId: number;
}): Promise<{ lineId: number; balanceAfter: number }> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new StockError("INVALID", "Quantity must be a whole number of 1 or more.");
  }
  return db.transaction(async (tx) => {
    // Re-check the job status inside the write-locked tx so a job completed
    // between the caller's check and here can't still receive a part line.
    await assertJobOpenTx(tx, input.workOrderId);
    const mv = await recordMovementTx(tx, {
      partId: input.partId,
      type: "issue",
      delta: -input.quantity,
      workOrderId: input.workOrderId,
      note: `WO-${input.workOrderId}`,
      actorId: input.actorId,
    });
    const [line] = await tx
      .insert(workOrderParts)
      .values({
        workOrderId: input.workOrderId,
        partId: input.partId,
        quantity: input.quantity,
        movementId: mv.movementId,
        createdBy: input.actorId,
      })
      .returning({ id: workOrderParts.id });
    return { lineId: line.id, balanceAfter: mv.balanceAfter };
  });
}

// Reverse a job's part line: a reversing movement restores on-hand and the line
// is flagged `reversed` — both movements stay in the ledger (audit), and the
// line drops out of the job's active parts. All in one transaction.
export async function reverseWorkOrderPart(input: {
  line: { id: number; partId: number; quantity: number; movementId: number };
  workOrderId: number;
  actorId: number;
}): Promise<void> {
  await db.transaction(async (tx) => {
    // A job closed concurrently locks its parts — bail rather than credit stock
    // back on a now-done job (checked in the write-locked tx, so it's atomic).
    const [wo] = await tx
      .select({ status: workOrders.status })
      .from(workOrders)
      .where(eq(workOrders.id, input.workOrderId))
      .limit(1);
    if (!wo || wo.status === "done" || wo.status === "cancelled") return;

    // Re-read the line inside the tx (BEGIN IMMEDIATE serializes writers) so two
    // concurrent removes can't each restore stock — the second sees it reversed
    // and bails, no double-credit.
    const [cur] = await tx
      .select({ reversed: workOrderParts.reversed })
      .from(workOrderParts)
      .where(eq(workOrderParts.id, input.line.id))
      .limit(1);
    if (!cur || cur.reversed) return;

    await recordMovementTx(tx, {
      partId: input.line.partId,
      type: "reverse",
      delta: input.line.quantity, // add the used quantity back
      workOrderId: input.workOrderId,
      reversesMovementId: input.line.movementId,
      note: `Reversed on WO-${input.workOrderId}`,
      actorId: input.actorId,
    });
    await tx
      .update(workOrderParts)
      .set({ reversed: true })
      .where(eq(workOrderParts.id, input.line.id));
  });
}
