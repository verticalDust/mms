// ─────────────────────────────────────────────────────────────────────────────
// Bulgarian message catalog — the SOURCE OF TRUTH for the whole app's copy.
// `en.ts` mirrors this shape exactly (`satisfies Messages`), so adding a key
// here without adding it there fails the build. A native speaker can proofread
// the entire product by reading this one file top to bottom.
//
// Conventions (DESIGN.md §Voice, Bulgarian):
//   • Formal «Вие» for instructions, buttons, and errors ("Запазете", not "Запази").
//   • Page/section titles are verbal nouns ("Добавяне на машина", not "Добави машина").
//   • Interpolated strings are FUNCTIONS, not templates with placeholders, so the
//     compiler enforces matching arguments between bg and en. Bulgarian plurals
//     are CLDR one/other — handled inline with `n === 1 ? … : …`.
//   • No `as const`: leaf strings must widen to `string` so `en satisfies Messages`
//     type-checks with different literal values. Function signatures still infer
//     exactly, which is what forces bg/en interpolation parity.
// ─────────────────────────────────────────────────────────────────────────────

export const bg = {
  // Micro-copy reused everywhere. Add sparingly — page-specific copy belongs in
  // its own area group.
  common: {
    save: "Запазете",
    saveChanges: "Запазете промените",
    cancel: "Отказ",
    edit: "Редактиране",
    remove: "Премахнете",
    back: "Назад",
    search: "Търсене…",
    clearFilters: "Изчистете филтрите",
    add: "Добавете",
    all: "Всички",
    clearSearch: "Изчистете търсенето",
    close: "Затваряне",
    optional: "по избор",
    signIn: "Вход",
    signOut: "Изход",
    switchLanguage: "Смяна на езика",
  },

  // Full sidebar labels.
  nav: {
    dashboard: "Табло",
    myWork: "Моята работа",
    workOrders: "Работни поръчки",
    machines: "Машини",
    reports: "Сигнали",
    pm: "Профилактика",
    parts: "Части",
  },

  // Tight labels for the mobile bottom tab bar (text-[11px], 6 tabs at 375px).
  // MUST stay short — never reuse the full `nav` labels here. `reports` is
  // desktop-only (filtered out of the tab bar); its key exists only so navShort
  // and nav share a shape.
  navShort: {
    dashboard: "Табло",
    myWork: "Мои",
    workOrders: "Поръчки",
    machines: "Машини",
    reports: "Сигнали",
    pm: "Проф.",
    parts: "Части",
  },

  // Browser-tab titles (the "· MMS" suffix is part of the string).
  meta: {
    description: "Система за управление на поддръжката",
    dashboard: "Табло · MMS",
    myWork: "Моята работа · MMS",
    workOrders: "Работни поръчки · MMS",
    newWorkOrder: "Нова работна поръчка · MMS",
    machines: "Машини · MMS",
    addMachine: "Добавяне на машина · MMS",
    editMachine: "Редактиране на машина · MMS",
    newPmSchedule: "Нов график за профилактика · MMS",
    editPmSchedule: "Редактиране на график · MMS",
    addPartToMachine: "Добавяне на част към машина · MMS",
    parts: "Части · MMS",
    addPart: "Добавяне на част · MMS",
    editPart: "Редактиране на част · MMS",
    addPartToJob: "Добавяне на част към поръчка · MMS",
    pm: "Профилактика · MMS",
    reports: "Обработка на сигнали · MMS",
    qrLabels: "QR етикети · MMS",
    signIn: "Вход · MMS",
    resetPassword: "Възстановяване на парола · MMS",
    setup: "Настройка на MMS",
    reportFault: "Подаване на сигнал · MMS",
    reported: "Изпратено · MMS",
  },

  role: {
    admin: "Администратор",
    technician: "Техник",
  },

  // Status chip labels (components/status-chip.tsx becomes the single source).
  status: {
    work: {
      open: "Отворена",
      in_progress: "В процес",
      done: "Завършена",
      cancelled: "Отказана",
    },
    machine: {
      running: "Работи",
      down: "В престой",
      retired: "Изведена",
    },
    stock: {
      out: "Изчерпана",
      low: "Ниска",
      ok: "Налична",
    },
  },

  priority: {
    low: "Нисък",
    medium: "Среден",
    high: "Висок",
    critical: "Критичен",
  },

  // Stock-movement (ledger) types.
  movement: {
    receive: "Доставка",
    issue: "Изписване",
    adjust: "Корекция",
    reverse: "Сторно",
  },

  // Display-time translation of tokens the DB stores in English (never store
  // translated text — see lib/i18n/system-notes.ts). Keys are the exact stored
  // strings; unknown values pass through untouched.
  system: {
    toStatus: {
      open: "Отворена",
      in_progress: "В процес",
      done: "Завършена",
      cancelled: "Отказана",
      reassigned: "Преназначена",
      rescheduled: "Пренасрочена",
      reprioritized: "Сменен приоритет",
    },
    notes: {
      "PM-generated": "Генерирано от профилактика",
      "From report": "От сигнал",
      "Opening stock": "Начална наличност",
      "Closed on machine retirement": "Затворена при извеждане на машината",
      Unassigned: "Невъзложена",
      "No date": "Без дата",
      Low: "Нисък",
      Medium: "Среден",
      High: "Висок",
      Critical: "Критичен",
    },
  },

  // Public QR report surfaces (app/m/[code]/*). Formal «Вие»; a fault report is
  // «сигнал» (matches the internal "Сигнали" nav). Absorbed from the old
  // app/m/[code]/messages.ts; the unused `photoChange` key was dropped.
  public: {
    reportingFor: "Подавате сигнал за повреда на",
    heading: "Сигнал за повреда",
    descLabel: "Какъв е проблемът?",
    descPlaceholder:
      "напр. Силен стържещ шум от двигателя и тече масло под основата.",
    nameLabel: "Вашето име (по избор)",
    namePlaceholder: "напр. Иван",
    photoLabel: "Добавете снимка (по избор)",
    photoAdd: "Направете или изберете снимка",
    photoRemove: "Премахнете",
    submit: "Изпратете сигнала",
    submitting: "Изпраща се…",
    descRequired: "Моля, опишете проблема.",
    thanksHeading: "Изпратено",
    thanksBody: "Екипът по поддръжката вече го вижда.",
    reportAnother: "Подайте нов сигнал",
    statusHeading: "Вашият сигнал",
    received: "Получено",
    receivedBody: "Екипът по поддръжката получи сигнала ви.",
    working: "В процес на работа",
    workingBody: "Някой работи по него.",
    fixed: "Отстранено",
    fixedBody: "Машината отново работи.",
    reviewed: "Прегледано",
    reviewedBody: "Екипът прегледа сигнала ви.",
    inactiveHeading: "Този код не е активен",
    inactiveBody: "Моля, съобщете на отговорника, за да провери машината.",
  },

  // Sign-in + password-reset screens.
  auth: {
    tagline: "Система за управление на поддръжката",
    email: "Имейл",
    emailPlaceholder: "name@company.com",
    password: "Парола",
    forgotPassword: "Забравена парола?",
    incorrect: "Имейлът или паролата са грешни.",
    tooManyAttempts:
      "Твърде много опити. Изчакайте няколко минути и опитайте отново.",
    resetTitle: "Възстановяване на паролата",
    resetBody:
      "Възстановяването на паролата по имейл предстои. Засега помолете администратор да ви зададе временна парола.",
    backToSignIn: "Обратно към входа",
  },

  // First-run setup wizard.
  setup: {
    title: "Настройка на MMS",
    intro:
      "Създайте първия администраторски акаунт и наименувайте фабриката. Отнема само минута.",
    adminSection: "Администраторски акаунт",
    factorySection: "Фабрика",
    name: "Вашето име",
    passwordHint: (n: number) => `Поне ${n} знака.`,
    passwordTooShort: (n: number) => `Паролата трябва да е поне ${n} знака.`,
    factoryName: "Име на фабриката",
    timezone: "Часова зона",
    timezoneHint: "Използва се за всички дати, срокове и планирани задачи.",
    submit: "Създайте акаунт и продължете",
    nameRequired: "Въведете вашето име.",
    emailInvalid: "Въведете валиден имейл.",
    factoryNameRequired: "Въведете името на фабриката.",
    timezoneRequired: "Изберете часова зона.",
    checkForm: "Проверете формуляра.",
  },

  // Root not-found / error boundaries (previously the English framework default,
  // which leaked even onto the Bulgarian public page).
  errors: {
    notFoundTitle: "Страницата не е намерена",
    notFoundBody: "Връзката може да е стара или сгрешена.",
    notFoundBack: "Към таблото",
    errorTitle: "Нещо се обърка",
    errorBody: "Опитайте отново. Ако проблемът продължава, потърсете администратор.",
    errorRetry: "Опитайте отново",
  },
};

export type Messages = typeof bg;
