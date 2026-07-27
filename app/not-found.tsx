import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { buttonClass } from "@/components/ui";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.errors.notFoundTitle}
      </h1>
      <p className="max-w-sm text-[15px] text-slate-600">
        {t.errors.notFoundBody}
      </p>
      <Link href="/dashboard" className={buttonClass("secondary")}>
        {t.errors.notFoundBack}
      </Link>
    </div>
  );
}
