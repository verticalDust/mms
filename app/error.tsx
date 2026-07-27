"use client";

import { useT } from "@/lib/i18n/client";
import { buttonClass } from "@/components/ui";

// Segment error boundary. The I18nProvider sits above this in the root layout,
// so useT() resolves even when a page throws.
export default function Error({ reset }: { reset: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-condensed text-2xl font-semibold text-slate-900">
        {t.errors.errorTitle}
      </h1>
      <p className="max-w-sm text-[15px] text-slate-600">{t.errors.errorBody}</p>
      <button type="button" onClick={reset} className={buttonClass("secondary")}>
        {t.errors.errorRetry}
      </button>
    </div>
  );
}
