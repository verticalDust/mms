import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, MapPin, Pencil, Package, Ban } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { parts, stockMovements, users } from "@/lib/db/schema";
import { stockLevel, listPartMachines } from "@/lib/queries";
import { buttonClass, Mono, SectionLabel, EmptyState } from "@/components/ui";
import { StockStatusChip, StatusChip } from "@/components/status-chip";
import { photosEnabled } from "@/lib/uploads";
import { StockDialog } from "../stock-dialog";
import { PhotoUpload } from "./photo-upload";
import { PartThumb } from "./part-thumb";
import { formatDate, formatTime } from "@/lib/format";
import { getLocale, getT } from "@/lib/i18n/server";
import { translateSystemNote } from "@/lib/i18n/system-notes";
import { cn } from "@/lib/cn";

export default async function PartDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getT();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [part] = await db.select().from(parts).where(eq(parts.id, id)).limit(1);
  if (!part) notFound();

  const isAdmin = user.role === "admin";
  const level = stockLevel(part.onHand, part.minLevel);

  const movements = await db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      balanceAfter: stockMovements.balanceAfter,
      reason: stockMovements.reason,
      note: stockMovements.note,
      workOrderId: stockMovements.workOrderId,
      createdAt: stockMovements.createdAt,
      actorName: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(stockMovements.actorId, users.id))
    .where(eq(stockMovements.partId, id))
    .orderBy(desc(stockMovements.createdAt), desc(stockMovements.id))
    .limit(201);

  // Fetch one extra to know whether the ledger is longer than we're showing, so
  // the truncation is signalled rather than silent (the ledger is the audit trail).
  const LEDGER_CAP = 200;
  const truncated = movements.length > LEDGER_CAP;
  const shown = truncated ? movements.slice(0, LEDGER_CAP) : movements;

  const fitsMachines = await listPartMachines(id);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/parts"
        className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {t.nav.parts}
      </Link>

      {/* Nameplate header */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            {part.photoPath && (
              <PartThumb
                src={`/parts/${part.id}/photo?v=${part.updatedAt.getTime()}`}
                alt={t.parts.photoAlt(part.name)}
              />
            )}
            <div className="min-w-0">
              <Mono className="text-[13px] font-medium text-slate-500">
                {part.sku}
              </Mono>
              <h1 className="font-condensed text-2xl font-semibold text-slate-900">
                {part.name}
              </h1>
              {part.binLocation && (
                <div className="mt-1 flex items-center gap-1.5 text-[14px] text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {t.parts.bin} <Mono>{part.binLocation}</Mono>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StockStatusChip level={level} />
            <div className="text-right">
              <Mono className="text-2xl font-semibold text-slate-900">
                {part.onHand}
              </Mono>
              <span className="text-[13px] text-slate-500"> {part.unit}</span>
              <div className="text-[12px] text-slate-500">
                {t.parts.min} <Mono>{part.minLevel}</Mono>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <StockDialog
            mode="receive"
            partId={part.id}
            onHand={part.onHand}
            unit={part.unit}
            bin={part.binLocation}
          />
          <StockDialog
            mode="issue"
            partId={part.id}
            onHand={part.onHand}
            unit={part.unit}
            bin={part.binLocation}
          />
          {isAdmin && (
            <StockDialog
              mode="adjust"
              partId={part.id}
              onHand={part.onHand}
              unit={part.unit}
              bin={part.binLocation}
            />
          )}
          {isAdmin && photosEnabled() && (
            <PhotoUpload partId={part.id} hasPhoto={Boolean(part.photoPath)} />
          )}
          {isAdmin && (
            <Link
              href={`/parts/${part.id}/edit`}
              className={cn(buttonClass("secondary"), "sm:ml-auto")}
            >
              <Pencil className="h-4 w-4" />
              {t.common.edit}
            </Link>
          )}
        </div>
      </div>

      {/* Movement ledger — the running balance sums exactly to on-hand (inv #1) */}
      <div className="flex flex-col gap-3">
        <SectionLabel>{t.parts.ledgerLabel}</SectionLabel>
        {shown.length === 0 ? (
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title={t.parts.ledgerEmpty}
          />
        ) : (
          <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {shown.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
              >
                <span className="w-16 shrink-0 font-condensed text-[13px] font-medium tracking-wide text-slate-600">
                  {t.movement[m.type as keyof typeof t.movement] ?? m.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-slate-700">
                    {m.type === "adjust" ? (
                      <>
                        <Mono className="text-slate-600">
                          {m.balanceAfter - m.quantity}
                        </Mono>
                        {" → "}
                        <Mono className="text-slate-600">{m.balanceAfter}</Mono>
                        {(m.reason || m.note) && (
                          <> · {translateSystemNote(m.reason || m.note!, t, locale)}</>
                        )}
                      </>
                    ) : (
                      (m.reason || m.note
                        ? translateSystemNote(m.reason || m.note!, t, locale)
                        : "—")
                    )}
                    {m.workOrderId && (
                      <Link
                        href={`/work-orders/${m.workOrderId}`}
                        className="ml-2 text-slate-500 hover:text-slate-700"
                      >
                        <Mono>WO-{m.workOrderId}</Mono>
                      </Link>
                    )}
                  </div>
                  <div className="truncate text-[12px] text-slate-500">
                    {m.actorName ?? "—"} · {formatDate(m.createdAt, locale)}{" "}
                    {formatTime(m.createdAt, locale)}
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right">
                  <Mono
                    className={cn(
                      "text-[15px] font-medium",
                      m.quantity > 0
                        ? "text-green-700"
                        : m.quantity < 0
                          ? "text-red-600"
                          : "text-slate-500",
                    )}
                  >
                    {m.quantity > 0 ? "+" : ""}
                    {m.quantity}
                  </Mono>
                  <div className="text-[12px] text-slate-500">
                    {t.parts.bal}{" "}
                    <Mono className="text-slate-600">{m.balanceAfter}</Mono>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {truncated && (
            <p className="mt-1 text-[13px] text-slate-500">
              {t.parts.ledgerTruncated(LEDGER_CAP)}
            </p>
          )}
          </>
        )}
      </div>

      {/* Fits machines — the reverse of the machine Parts section (E2-S10) */}
      <div className="flex flex-col gap-3">
        <SectionLabel>{t.parts.fitsMachines}</SectionLabel>
        {fitsMachines.length === 0 ? (
          <EmptyState title={t.parts.notLinkedMachine} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {fitsMachines.map((m) => (
              <Link
                key={m.machineId}
                href={`/machines/${m.machineId}`}
                className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50"
              >
                <Mono className="w-20 shrink-0 text-[13px] text-slate-500">
                  {m.code}
                </Mono>
                <div className="min-w-0 flex-1 truncate text-[15px] text-slate-900">
                  {m.name}
                </div>
                {m.retired && (
                  <StatusChip tone="slate" icon={Ban}>
                    {t.status.machine.retired}
                  </StatusChip>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
