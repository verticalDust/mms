import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Fira_Sans_Condensed } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";
import { I18nProvider } from "@/lib/i18n/client";

// Type families — self-hosted by next/font at build time (no third-party request
// from the factory floor).
//
// Body + mono are IBM Plex (Sans + Mono), both carrying Cyrillic. The condensed
// display face for headings/nav/chips is Fira Sans Condensed: IBM Plex Sans
// Condensed on Google Fonts ships no basic-Cyrillic subset (only cyrillic-ext),
// so it can't set Bulgarian — the app's default language. Fira Sans Condensed is
// a humanist condensed that pairs cleanly with Plex and carries full Cyrillic,
// so headings stay tight in both languages (DESIGN.md §Typography).
const sans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const condensed = Fira_Sans_Condensed({
  variable: "--font-condensed-face",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = getMessages(await getLocale());
  return { title: "MMS", description: t.meta.description };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${sans.variable} ${condensed.variable} ${mono.variable} h-full`}
    >
      <body className="min-h-full bg-slate-50 text-slate-900 antialiased font-sans">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
