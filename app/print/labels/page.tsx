import Link from "next/link";
import { and, inArray, isNull } from "drizzle-orm";
import { ArrowLeft, ScanLine } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { machines } from "@/lib/db/schema";
import { qrSvg } from "@/lib/qr";
import { appBaseUrl, machineScanPath } from "@/lib/url";
import { QrImage } from "@/components/qr";
import { EmptyState, Mono, buttonClass } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "QR labels · MMS" };

// A4 label sheet (E1-S5). Print-CSS, not a PDF pipeline. `?ids=` prints a
// selection (from a machine page); no ids prints every active machine. The QR
// encodes /m/{code} — one URL, auth decides staff-page vs public form at scan.
export default async function LabelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  // "?ids=" present → print that selection; absent → print all active. A
  // present-but-empty/garbage ids yields an empty sheet, not the whole fleet.
  // Retired machines are never printed — their QR resolves to a dead link.
  const idsProvided = typeof sp.ids === "string";
  const ids = (idsProvided ? (sp.ids as string) : "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  const cols = { id: machines.id, code: machines.code, name: machines.name };
  let rows: { id: number; code: string; name: string }[] = [];
  if (idsProvided) {
    if (ids.length) {
      rows = await db
        .select(cols)
        .from(machines)
        .where(and(inArray(machines.id, ids), isNull(machines.retiredAt)))
        .orderBy(machines.code);
    }
  } else {
    rows = await db
      .select(cols)
      .from(machines)
      .where(isNull(machines.retiredAt))
      .orderBy(machines.code);
  }

  const base = await appBaseUrl();
  const labels = await Promise.all(
    rows.map(async (m) => ({
      ...m,
      svg: await qrSvg(base + machineScanPath(m.code), { margin: 2 }),
    })),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
      {/* Injected page rules — Tailwind can't express @page. */}
      <style>{`@media print { @page { size: A4; margin: 12mm; } }`}</style>

      {/* Toolbar — screen only */}
      <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/machines"
          className="inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Machines
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-slate-500">
            {labels.length} label{labels.length === 1 ? "" : "s"}
          </span>
          {labels.length > 0 && <PrintButton>Print</PrintButton>}
        </div>
      </div>

      <div className="mb-4 print:hidden">
        <h1 className="font-condensed text-2xl font-semibold text-slate-900">
          QR labels
        </h1>
        <p className="mt-1 text-[14px] text-slate-500">
          Preview mirrors the printed sheet. Mount one on each machine. Any scan
          reaches the right place.
        </p>
      </div>

      {labels.length === 0 ? (
        <EmptyState
          icon={<ScanLine className="h-6 w-6" />}
          title="No machines to print labels for."
          action={
            <Link href="/machines" className={buttonClass("secondary")}>
              Back to machines
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-[4mm]">
          {labels.map((m) => (
            <div
              key={m.id}
              className="flex break-inside-avoid items-center gap-3 rounded-lg border border-slate-300 bg-white p-3 print:rounded-none"
            >
              <QrImage
                svg={m.svg}
                className="h-24 w-24 shrink-0"
                label={`QR code for machine ${m.code}`}
              />
              <div className="flex min-w-0 flex-col">
                <Mono className="text-[15px] font-semibold text-slate-900">
                  {m.code}
                </Mono>
                <span className="line-clamp-2 font-condensed text-[13px] leading-snug text-slate-700">
                  {m.name}
                </span>
                <span className="mt-1.5 text-[10px] leading-tight text-slate-500">
                  Scan to report a fault
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
