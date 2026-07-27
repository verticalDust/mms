import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isSetupComplete } from "@/lib/setup";
import { getT } from "@/lib/i18n/server";
import { LangSwitcher } from "@/components/lang-switcher";
import { SetupForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).meta.setup };
}

export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-3 flex justify-end">
        <LangSwitcher mode="cookie" />
      </div>
      <div className="mb-6">
        <div className="font-condensed text-2xl font-semibold text-slate-900">
          {t.setup.title}
        </div>
        <p className="mt-1 text-slate-600">{t.setup.intro}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <SetupForm />
      </div>
    </main>
  );
}
