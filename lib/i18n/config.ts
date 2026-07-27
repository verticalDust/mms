// Universal i18n config — no dependencies, safe to import from client, server,
// route handlers, and proxy.ts alike. Everything locale-shaped that isn't a
// translated string lives here so there's one source of truth for the set of
// locales, the default, and the cookie name.

export const LOCALES = ["bg", "en"] as const;
export type Locale = (typeof LOCALES)[number];

// The factory pilots in Bulgaria, so Bulgarian is the default everywhere —
// including the public QR surface, which used to default to English.
export const DEFAULT_LOCALE: Locale = "bg";

// Per-device language pointer (no login required to carry it). Shared by the
// whole app AND the public report flow, so a scan, a re-scan, and the signed-in
// UI all agree. Written non-httpOnly on purpose: the client toggles set it via
// document.cookie (see lib/i18n/client + the public form).
export const LANG_COOKIE = "mms_lang";

// Anything that isn't an explicit "en" resolves to Bulgarian. This is the one
// place the default flip is encoded.
export function pickLocale(raw: string | null | undefined): Locale {
  return raw === "en" ? "en" : "bg";
}

export const OTHER_LOCALE: Record<Locale, Locale> = { bg: "en", en: "bg" };

// The label shown ON the switcher is the language it switches TO.
export const LOCALE_LABEL: Record<Locale, string> = { bg: "БГ", en: "EN" };

// BCP-47 tags for Intl.* (dates, numbers, durations). Kept apart from the UI
// locale so we never leak "bg"/"en" into a formatter that wants a full tag.
export const INTL_LOCALE: Record<Locale, string> = {
  bg: "bg-BG",
  en: "en-GB",
};
