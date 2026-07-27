"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { parts, stockMovements } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import { getT } from "@/lib/i18n/server";
import type { Messages } from "@/lib/i18n/messages";
import {
  recordMovement,
  recordMovementTx,
  StockError,
  stockErrorMessage,
} from "@/lib/stock";

export type FormState = { error?: string };
export type StockFormState = { ok?: boolean; error?: string };

const catalogSchema = (t: Messages) =>
  z.object({
    sku: z.string().trim().min(1, t.parts.errSkuRequired),
    name: z.string().trim().min(1, t.parts.errNameRequired),
    unit: z.string().trim().optional(),
    binLocation: z.string().trim().optional(),
    minLevel: z.coerce.number().int().min(0, t.parts.errMinNegative),
    unitCost: z.coerce.number().min(0).optional(),
  });

function revalidatePart(partId: number) {
  revalidatePath(`/parts/${partId}`);
  revalidatePath("/parts");
  revalidatePath("/dashboard");
}

export async function createPart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "part:manage");
  } catch {
    return { error: t.parts.errOnlyAdminAdd };
  }

  const parsed = catalogSchema(t)
    .extend({ initialQty: z.coerce.number().int().min(0) })
    .safeParse({
      sku: formData.get("sku"),
      name: formData.get("name"),
      unit: formData.get("unit") || undefined,
      binLocation: formData.get("binLocation") || undefined,
      minLevel: formData.get("minLevel") || 0,
      unitCost: formData.get("unitCost") || undefined,
      initialQty: formData.get("initialQty") || 0,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.common.checkForm };
  }
  const d = parsed.data;

  let newId = 0;
  try {
    await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(parts)
        .values({
          sku: d.sku,
          name: d.name,
          unit: d.unit || "pcs",
          binLocation: d.binLocation || null,
          minLevel: d.minLevel,
          unitCost: d.unitCost ?? null,
          onHand: 0,
          createdBy: user.id,
        })
        .returning({ id: parts.id });
      newId = p.id;

      // Opening stock is a real ledger row, so SUM(movements) == onHand from
      // the very first record (invariant #1).
      if (d.initialQty > 0) {
        await tx.insert(stockMovements).values({
          partId: p.id,
          type: "receive",
          quantity: d.initialQty,
          balanceAfter: d.initialQty,
          // STORED token — translated at display via lib/i18n/system-notes.
          reason: "Opening stock",
          actorId: user.id,
        });
        await tx
          .update(parts)
          .set({ onHand: d.initialQty })
          .where(eq(parts.id, p.id));
      }
    });
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: t.parts.errSkuExists(d.sku) };
    }
    throw e;
  }

  revalidatePath("/parts");
  revalidatePath("/dashboard");
  redirect(`/parts/${newId}`);
}

export async function updatePart(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "part:manage");
  } catch {
    return { error: t.parts.errOnlyAdminEdit };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: t.parts.errUnknownPart };

  const parsed = catalogSchema(t).safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
    binLocation: formData.get("binLocation") || undefined,
    minLevel: formData.get("minLevel") || 0,
    unitCost: formData.get("unitCost") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.common.checkForm };
  }
  const d = parsed.data;

  // on_hand is deliberately NOT editable here — stock only changes through the
  // ledger (Receive / Issue / Adjust), never a direct catalog edit.
  try {
    await db
      .update(parts)
      .set({
        sku: d.sku,
        name: d.name,
        unit: d.unit || "pcs",
        binLocation: d.binLocation || null,
        minLevel: d.minLevel,
        unitCost: d.unitCost ?? null,
        updatedAt: new Date(),
      })
      .where(eq(parts.id, id));
  } catch (e) {
    if (String(e).includes("UNIQUE")) {
      return { error: t.parts.errSkuExists(d.sku) };
    }
    throw e;
  }

  revalidatePart(id);
  redirect(`/parts/${id}`);
}

export async function receiveStock(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "stock:receive");
  } catch {
    return { error: t.parts.errCantReceive };
  }

  const partId = Number(formData.get("partId"));
  const qty = Number(formData.get("qty"));
  const note = String(formData.get("note") ?? "").trim();
  const costRaw = formData.get("unitCost");
  if (!Number.isInteger(partId)) return { error: t.parts.errUnknownPart };
  if (!Number.isInteger(qty) || qty <= 0)
    return { error: t.parts.errQtyPositive };

  // Optional new unit cost, applied in the SAME transaction as the receive so
  // the movement and the cost update commit together (never one without the other).
  let newCost: number | null = null;
  if (costRaw != null && String(costRaw).trim() !== "") {
    const c = Number(costRaw);
    if (!Number.isNaN(c) && c >= 0) newCost = c;
  }

  try {
    await db.transaction(async (tx) => {
      await recordMovementTx(tx, {
        partId,
        type: "receive",
        delta: qty,
        note: note || null,
        actorId: user.id,
      });
      if (newCost != null) {
        await tx
          .update(parts)
          .set({ unitCost: newCost, updatedAt: new Date() })
          .where(eq(parts.id, partId));
      }
    });
  } catch (e) {
    if (e instanceof StockError) return { error: stockErrorMessage(e, t) };
    throw e;
  }

  revalidatePart(partId);
  return { ok: true };
}

export async function issueStock(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "stock:issue");
  } catch {
    return { error: t.parts.errCantIssue };
  }

  const partId = Number(formData.get("partId"));
  const qty = Number(formData.get("qty"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(partId)) return { error: t.parts.errUnknownPart };
  if (!Number.isInteger(qty) || qty <= 0)
    return { error: t.parts.errQtyPositive };

  try {
    await recordMovement({
      partId,
      type: "issue",
      delta: -qty,
      reason: reason || null,
      actorId: user.id,
    });
  } catch (e) {
    // Insufficient stock shows the recorded on-hand + bin so the tech can
    // reconcile the shelf (SCREENS §6) rather than a bare rejection.
    if (e instanceof StockError) return { error: stockErrorMessage(e, t) };
    throw e;
  }

  revalidatePart(partId);
  return { ok: true };
}

export async function adjustStock(
  _prev: StockFormState,
  formData: FormData,
): Promise<StockFormState> {
  const user = await getCurrentUser();
  const t = await getT();
  if (!user) return { error: t.common.notSignedIn };
  try {
    authorize(user, "stock:adjust");
  } catch {
    return { error: t.parts.errOnlyAdminAdjust };
  }

  const partId = Number(formData.get("partId"));
  const counted = Number(formData.get("counted"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(partId)) return { error: t.parts.errUnknownPart };
  if (!Number.isInteger(counted) || counted < 0)
    return { error: t.parts.errCountedQty };
  if (!reason) return { error: t.parts.errReasonRequired };

  try {
    await recordMovement({
      partId,
      type: "adjust",
      setTo: counted,
      reason,
      actorId: user.id,
    });
  } catch (e) {
    if (e instanceof StockError) return { error: stockErrorMessage(e, t) };
    throw e;
  }

  revalidatePart(partId);
  return { ok: true };
}
