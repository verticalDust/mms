"use client";

import { getMessages } from "@/lib/i18n/messages";
import { pickLocale } from "@/lib/i18n/config";

// Catastrophic fallback: a root-layout error replaces the whole document, so
// this cannot use the I18nProvider (it's gone) and must render its own <html>.
// Best-effort locale from the cookie; inline styles because globals.css may not
// be attached here.
function readLocale() {
  if (typeof document === "undefined") return pickLocale(null);
  const m = document.cookie.match(/(?:^|;\s*)mms_lang=([^;]+)/);
  return pickLocale(m?.[1]);
}

export default function GlobalError({ reset }: { reset: () => void }) {
  const locale = readLocale();
  const t = getMessages(locale);
  return (
    <html lang={locale}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          color: "#0f172a",
          background: "#f8fafc",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
          {t.errors.errorTitle}
        </h1>
        <p style={{ maxWidth: "24rem", color: "#475569" }}>
          {t.errors.errorBody}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            cursor: "pointer",
            borderRadius: "0.375rem",
            background: "#ea580c",
            color: "#fff",
            padding: "0.5rem 1rem",
            fontWeight: 500,
          }}
        >
          {t.errors.errorRetry}
        </button>
      </body>
    </html>
  );
}
