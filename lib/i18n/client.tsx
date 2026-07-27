"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

// The provider carries ONLY the locale string across the RSC boundary. The
// dicts (which contain functions) are imported statically here in client code,
// so useT() resolves them locally — functions never get serialized. Mounted
// once in the root layout, so every client component gets useT()/useLocale()
// for free.

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT(): Messages {
  return getMessages(useContext(LocaleContext));
}
