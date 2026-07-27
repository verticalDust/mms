import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.resetPassword };
}

// Stub until E0-S8 (self-serve reset vs admin temp password — decision D6).
export default async function ForgotPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-3 flex justify-end">
        <LangSwitcher mode="cookie" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h1 className="font-condensed text-xl font-semibold text-slate-900">
          {t.auth.resetTitle}
        </h1>
        <p className="mt-2 text-[15px] text-slate-600">{t.auth.resetBody}</p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.auth.backToSignIn}
        </Link>
      </div>
    </main>
  );
}
