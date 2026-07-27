import Link from "next/link";
import { cookies } from "next/headers";
import { CircleCheck, Factory, RotateCcw } from "lucide-react";
import { getMachineByCode } from "@/lib/queries";
import { LANG_COOKIE, pickLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { LangSwitcher } from "@/components/lang-switcher";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.reported };
}

// Report confirmation (§7.2) — one calm screen that closes the loop. No account
// nudge, no internal data; just reassurance and a way to report another fault.
export default async function ThanksPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const machine = await getMachineByCode(code);
  const jar = await cookies();
  const locale = pickLocale(jar.get(LANG_COOKIE)?.value);
  const t = getMessages(locale).public;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex justify-end">
          <LangSwitcher mode="cookie" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CircleCheck className="h-6 w-6" />
          </div>
          <h1 className="mt-5 font-condensed text-2xl font-semibold text-slate-900">
            {t.thanksHeading}
          </h1>
          {machine && (
            <div className="mt-1 font-condensed text-[15px] text-slate-500">
              {machine.name}
            </div>
          )}
          <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
            {t.thanksBody}
          </p>
          <Link
            href={`/m/${encodeURIComponent(code)}?new=1`}
            className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-orange-600 hover:text-orange-500"
          >
            <RotateCcw className="h-4 w-4" />
            {t.reportAnother}
          </Link>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-1.5 text-[12px] text-slate-500">
        <Factory className="h-3.5 w-3.5" />
        <span className="font-condensed tracking-wide">MMS</span>
      </div>
    </main>
  );
}
