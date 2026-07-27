// Client-safe aggregation of both catalogs. Importing THIS (not server.ts) is
// what lets a client component hold the function-valued dict without anything
// crossing the RSC boundary — see lib/i18n/client.tsx.
import { bg, type Messages } from "./bg";
import { en } from "./en";
import type { Locale } from "../config";

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { bg, en };

// Pure dict lookup. Used by the client hook, the public form's instant toggle,
// and the digest (which has no request context to call getT()).
export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
