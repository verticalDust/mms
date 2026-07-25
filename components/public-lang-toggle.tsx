"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import {
  LANG_LABEL,
  OTHER_LANG,
  type Lang,
} from "@/app/m/[code]/messages";
import { LANG_COOKIE } from "@/lib/reports";

// EN/BG toggle for the STATIC public surfaces (confirmation, re-scan status,
// dead-link). These carry no form input, so flipping the cookie and refreshing
// the server render is fine — the form uses its own instant, in-place toggle so
// a half-typed report is never lost.
export function PublicLangToggle({ lang }: { lang: Lang }) {
  const router = useRouter();
  const next = OTHER_LANG[lang];
  return (
    <button
      type="button"
      aria-label="Switch language"
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 font-condensed text-[13px] font-medium tracking-wide text-slate-600 hover:bg-slate-50 cursor-pointer"
    >
      <Languages className="h-4 w-4" />
      {LANG_LABEL[next]}
    </button>
  );
}
