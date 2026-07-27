// Bilingual strings for the public report surfaces ONLY (PLAN D9 / SCREENS §7).
// The internal app stays English; this is the one Cyrillic surface in v0, so
// rather than pull in a whole-app i18n framework for ~two dozen strings on one
// no-login flow, the copy lives here and the language is chosen per device by a
// cookie + an instant toggle on the form.
export type Lang = "en" | "bg";

export function pickLang(raw: string | undefined | null): Lang {
  return raw === "bg" ? "bg" : "en";
}

export const OTHER_LANG: Record<Lang, Lang> = { en: "bg", bg: "en" };

// The label shown ON the toggle is the language it switches TO (so an English
// speaker sees "БГ", a Bulgarian speaker sees "EN").
export const LANG_LABEL: Record<Lang, string> = { en: "EN", bg: "БГ" };

export const messages = {
  en: {
    // form
    reportingFor: "You're reporting a fault on",
    heading: "Report a fault",
    descLabel: "What's wrong?",
    descPlaceholder:
      "e.g. Loud grinding from the motor and it's leaking oil under the base.",
    nameLabel: "Your name (optional)",
    namePlaceholder: "e.g. Ivan",
    photoLabel: "Add a photo (optional)",
    photoAdd: "Take or choose a photo",
    photoChange: "Change photo",
    photoRemove: "Remove",
    submit: "Send report",
    submitting: "Sending…",
    descRequired: "Please describe the problem.",
    // confirmation (§7.2)
    thanksHeading: "Reported",
    thanksBody: "The maintenance team can see it now.",
    reportAnother: "Report another fault",
    // status view (§7.3)
    statusHeading: "Your report",
    received: "Received",
    receivedBody: "The maintenance team has your report.",
    working: "Being worked on",
    workingBody: "Someone is on it now.",
    fixed: "Fixed",
    fixedBody: "This machine is running again.",
    reviewed: "Reviewed",
    reviewedBody: "The team reviewed your report.",
    // dead link (§7.4)
    inactiveHeading: "This code isn't active",
    inactiveBody: "Please tell a supervisor so they can check the machine.",
  },
  bg: {
    reportingFor: "Докладвате повреда на",
    heading: "Докладвай повреда",
    descLabel: "Какъв е проблемът?",
    descPlaceholder:
      "напр. Силен стържещ шум от двигателя и тече масло под основата.",
    nameLabel: "Вашето име (по избор)",
    namePlaceholder: "напр. Иван",
    photoLabel: "Добави снимка (по избор)",
    photoAdd: "Направи или избери снимка",
    photoChange: "Смени снимката",
    photoRemove: "Премахни",
    submit: "Изпрати",
    submitting: "Изпраща се…",
    descRequired: "Моля, опишете проблема.",
    thanksHeading: "Изпратено",
    thanksBody: "Екипът по поддръжката вече го вижда.",
    reportAnother: "Докладвай друга повреда",
    statusHeading: "Вашият доклад",
    received: "Получено",
    receivedBody: "Екипът по поддръжката получи доклада ви.",
    working: "В процес на работа",
    workingBody: "Някой се занимава с това.",
    fixed: "Отстранено",
    fixedBody: "Машината отново работи.",
    reviewed: "Прегледано",
    reviewedBody: "Екипът прегледа доклада ви.",
    inactiveHeading: "Този код не е активен",
    inactiveBody: "Моля, съобщете на отговорника, за да провери машината.",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type Messages = (typeof messages)[Lang];
