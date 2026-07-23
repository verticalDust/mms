"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { parts, stockMovements } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { authorize } from "@/lib/auth/rbac";
import {
  recordMovement,
  recordMovementTx,
  StockError,
  insufficientMessage,
} from "@/lib/stock";

export type FormState = { error?: string };
export type StockFormState = { ok?: boolean; error?: string };

const catalogSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required."),
  name: z.string().trim().min(1, "Name is required."),
  unit: z.string().trim().optional(),
  binLocation: z.string().trim().optional(),
  minLevel: z.coerce.number().int().min(0, "Minimum can't be negative."),
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
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "part:manage");
  } catch {
    return { error: "Only an admin can add parts." };
  }

  const parsed = catalogSchema
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
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
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
      return { error: `A part with SKU ${d.sku} already exists.` };
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
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "part:manage");
  } catch {
    return { error: "Only an admin can edit parts." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { error: "Unknown part." };

  const parsed = catalogSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
    binLocation: formData.get("binLocation") || undefined,
    minLevel: formData.get("minLevel") || 0,
    unitCost: formData.get("unitCost") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the form." };
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
      return { error: `A part with SKU ${d.sku} already exists.` };
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
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "stock:receive");
  } catch {
    return { error: "You can't receive stock." };
  }

  const partId = Number(formData.get("partId"));
  const qty = Number(formData.get("qty"));
  const note = String(formData.get("note") ?? "").trim();
  const costRaw = formData.get("unitCost");
  if (!Number.isInteger(partId)) return { error: "Unknown part." };
  if (!Number.isInteger(qty) || qty <= 0)
    return { error: "Enter a whole quantity greater than zero." };

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
    if (e instanceof StockError) return { error: e.message };
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
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "stock:issue");
  } catch {
    return { error: "You can't issue stock." };
  }

  const partId = Number(formData.get("partId"));
  const qty = Number(formData.get("qty"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(partId)) return { error: "Unknown part." };
  if (!Number.isInteger(qty) || qty <= 0)
    return { error: "Enter a whole quantity greater than zero." };

  try {
    await recordMovement({
      partId,
      type: "issue",
      delta: -qty,
      reason: reason || null,
      actorId: user.id,
    });
  } catch (e) {
    if (e instanceof StockError) {
      // Insufficient stock shows the recorded on-hand + bin so the tech can
      // reconcile the shelf (SCREENS §6) rather than a bare rejection.
      return {
        error: e.code === "INSUFFICIENT" ? insufficientMessage(e) : e.message,
      };
    }
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
  if (!user) return { error: "Not signed in." };
  try {
    authorize(user, "stock:adjust");
  } catch {
    return { error: "Only an admin can adjust the count." };
  }

  const partId = Number(formData.get("partId"));
  const counted = Number(formData.get("counted"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(partId)) return { error: "Unknown part." };
  if (!Number.isInteger(counted) || counted < 0)
    return { error: "Enter the counted quantity (zero or more)." };
  if (!reason) return { error: "A reason is required to adjust the count." };

  try {
    await recordMovement({
      partId,
      type: "adjust",
      setTo: counted,
      reason,
      actorId: user.id,
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }

  revalidatePart(partId);
  return { ok: true };
}
