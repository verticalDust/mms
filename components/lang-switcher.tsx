"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocale, useT } from "@/lib/i18n/client";
import {
  LANG_COOKIE,
  LOCALE_LABEL,
  OTHER_LOCALE,
} from "@/lib/i18n/config";
import { switchLocale } from "@/lib/i18n/actions";

// One toggle, two modes:
//   • "persist"  — signed-in: posts to the switchLocale server action, which
//     saves users.locale AND the cookie, then revalidates the whole tree.
//   • "cookie"   — pre-auth (login/forgot/setup): no account to update, so it
//     just writes the cookie and refreshes the server render.
// The button always shows the language it switches TO (БГ ↔ EN).
export function LangSwitcher({
  mode,
  compact = false,
}: {
  mode: "persist" | "cookie";
  compact?: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useT();
  const next = OTHER_LOCALE[locale];

  const className = cn(
    "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white font-condensed text-[13px] font-medium tracking-wide text-slate-600 hover:bg-slate-50 cursor-pointer",
    compact ? "h-11 w-11 justify-center" : "h-9 px-2.5",
  );

  if (mode === "cookie") {
    return (
      <button
        type="button"
        aria-label={t.common.switchLanguage}
        onClick={() => {
          document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }}
        className={className}
      >
        <Languages className="h-4 w-4 shrink-0" />
        {!compact && LOCALE_LABEL[next]}
      </button>
    );
  }

  return (
    <form action={switchLocale}>
      <input type="hidden" name="locale" value={next} />
      <button
        type="submit"
        aria-label={t.common.switchLanguage}
        className={className}
      >
        <Languages className="h-4 w-4 shrink-0" />
        {!compact && LOCALE_LABEL[next]}
      </button>
    </form>
  );
}
