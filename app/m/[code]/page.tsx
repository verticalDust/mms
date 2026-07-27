import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  Factory,
  TriangleAlert,
  Inbox,
  Wrench,
  CircleCheck,
  Check,
  RotateCcw,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getMachineByCode, getReport } from "@/lib/queries";
import { photosEnabled } from "@/lib/uploads";
import {
  coarseStatus,
  recentReportCookie,
  type CoarseStatus,
} from "@/lib/reports";
import { LANG_COOKIE, pickLocale, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Mono } from "@/components/ui";
import { LangSwitcher } from "@/components/lang-switcher";
import { ReportForm } from "./report-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.reportFault };
}

// The QR-label target. One URL, auth decides the view (PLAN §1.5):
//   • signed-in staff  → the internal machine page
//   • anonymous + live → the public fault-report form (E5-S1); or, if this device
//                        already filed a report, the coarse status of it (E5-S3)
//   • dead / retired   → a friendly no-blame page (E5-S1 §7.4)
// Public and anonymous by design (see proxy PUBLIC_PREFIXES); never leaks any
// internal data beyond the code + name already printed on the physical label.
export default async function ScanPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  // Next already percent-decodes route params — do NOT decode again, or a code
  // containing '%' throws URIError and the scan 500s at the machine.
  const { code } = await params;
  const { new: forceNew } = await searchParams;

  const machine = await getMachineByCode(code);

  // Staff who scan get the full machine page (including retired history).
  const user = await getCurrentUser();
  if (machine && user) redirect(`/machines/${machine.id}`);

  const jar = await cookies();
  const locale = pickLocale(jar.get(LANG_COOKIE)?.value);
  const t = getMessages(locale).public;

  // Dead / retired / mangled → friendly page (§7.4), no internal data.
  if (!machine || machine.retiredAt) {
    return (
      <PublicShell>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <TriangleAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-condensed text-2xl font-semibold text-slate-900">
          {t.inactiveHeading}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
          {t.inactiveBody}
        </p>
      </PublicShell>
    );
  }

  // Re-scan after reporting → coarse status of this device's last report (§7.3),
  // unless the operator asked to file another (?new).
  const recentId = Number(jar.get(recentReportCookie(machine.id))?.value);
  if (!forceNew && Number.isInteger(recentId) && recentId > 0) {
    const report = await getReport(recentId);
    if (report && report.machineId === machine.id) {
      return (
        <StatusView
          locale={locale}
          code={code}
          machineName={machine.name}
          machineCode={machine.code}
          status={coarseStatus(report.status, report.workOrderStatus)}
        />
      );
    }
  }

  // Otherwise: the report form.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <ReportForm
        code={code}
        machineCode={machine.code}
        machineName={machine.name}
        defaultLocale={locale}
        photosEnabled={photosEnabled()}
      />
      <Wordmark />
    </main>
  );
}

const STATUS_STYLE: Record<
  CoarseStatus,
  { tone: string; icon: React.ComponentType<{ className?: string }> }
> = {
  received: { tone: "bg-slate-100 text-slate-600", icon: Inbox },
  working: { tone: "bg-amber-50 text-amber-700", icon: Wrench },
  fixed: { tone: "bg-green-50 text-green-700", icon: CircleCheck },
  reviewed: { tone: "bg-slate-100 text-slate-600", icon: Check },
};

function StatusView({
  locale,
  code,
  machineName,
  machineCode,
  status,
}: {
  locale: Locale;
  code: string;
  machineName: string;
  machineCode: string;
  status: CoarseStatus;
}) {
  const t = getMessages(locale).public;
  const label = {
    received: t.received,
    working: t.working,
    fixed: t.fixed,
    reviewed: t.reviewed,
  }[status];
  const body = {
    received: t.receivedBody,
    working: t.workingBody,
    fixed: t.fixedBody,
    reviewed: t.reviewedBody,
  }[status];
  const s = STATUS_STYLE[status];
  const Icon = s.icon;
  return (
    <PublicShell>
      <div className="text-[13px] text-slate-500">{t.statusHeading}</div>
      <Mono className="mt-1 block text-[13px] font-medium text-slate-500">
        {machineCode}
      </Mono>
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {machineName}
      </h1>
      <div className="mt-5 flex flex-col items-center gap-2">
        <span
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1 font-condensed text-[15px] font-medium tracking-wide ${s.tone}`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </span>
        <p className="text-[15px] leading-relaxed text-slate-600">{body}</p>
      </div>
      <Link
        href={`/m/${encodeURIComponent(code)}?new=1`}
        className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-orange-600 hover:text-orange-500"
      >
        <RotateCcw className="h-4 w-4" />
        {t.reportAnother}
      </Link>
    </PublicShell>
  );
}

// Shared centered card for the static public surfaces (status + dead-link), with
// the language toggle and the MMS wordmark. The form supplies its own shell so
// its instant toggle can live inline without a reload.
function PublicShell({ children }: { children: React.ReactNode }) {
  // The switcher reads the locale from the root I18nProvider (resolved from the
  // same cookie this page read), so it always agrees with what rendered.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex justify-end">
          <LangSwitcher mode="cookie" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          {children}
        </div>
      </div>
      <Wordmark />
    </main>
  );
}

function Wordmark() {
  return (
    <div className="mt-6 flex items-center gap-1.5 text-[12px] text-slate-500">
      <Factory className="h-3.5 w-3.5" />
      <span className="font-condensed tracking-wide">MMS</span>
    </div>
  );
}
