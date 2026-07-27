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
    clearFiltersAction: "Изчистете филтрите",
    close: "Затваряне",
    optional: "по избор",
    signIn: "Вход",
    signOut: "Изход",
    switchLanguage: "Смяна на езика",
    notSignedIn: "Не сте влезли.",
    checkForm: "Проверете формуляра.",
    machineGone: "Тази машина вече не съществува.",
    dayShort: "д",
  },

  // Shared due-date words for the queue, dashboard and my-work rows.
  due: {
    over: "закъснение",
    today: "Днес",
    noDate: "Без дата",
    duePrefix: "срок",
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

  // Shared part-picker / stock vocabulary (the job "add part" flow, the machine
  // "add part" flow, and the parts catalog). Grown further in the parts phase.
  parts: {
    bin: "клетка",
    onHand: (n: number, unit: string) => `${n} ${unit} налични`,
    searchSkuName: "Търсене по SKU или име…",
    searchSkuNameBin: "Търсене по SKU, име или клетка…",
    addToCatalog: "Добавете част в каталога",
    noMatchSearch: "Няма части, отговарящи на търсенето.",
    noneInCatalog: "Все още няма части в каталога.",
    headingSearchResults: "Резултати от търсенето",
    headingSuggestedMachine: "Предложени за тази машина",
    headingAll: "Всички части",
    showingFirst: (n: number) =>
      `Показани са първите ${n}. Уточнете търсенето, за да стесните.`,
    // List
    addPart: "Добавете част",
    editPart: "Редактиране на част",
    lowStockChip: "Ниска наличност",
    allParts: "Всички части",
    nothingToReorder: "Няма за поръчване. Всяка част е на или над минимума.",
    emptyNoMatch: "Няма части, отговарящи на филтрите.",
    emptyNone: "Все още няма части.",
    need: (n: number) => `нужни ${n}`,
    // Detail
    ledgerLabel: "Складови движения",
    ledgerEmpty: "Все още няма складови движения. Заприходете, за да започне регистърът.",
    bal: "бал.",
    ledgerTruncated: (n: number) =>
      `Показани са последните ${n} движения. По-старите не са в списъка.`,
    fitsMachines: "Подхожда на машини",
    notLinkedMachine: "Все още не е свързана с машина.",
    min: "мин.",
    photoAlt: (name: string) => `Снимка на ${name}`,
    // Catalog form
    skuField: "SKU",
    skuHint: "Предложено за вас. Заменете с реалния номер на частта.",
    nameField: "Име",
    unitField: "Мярка",
    unitPlaceholder: "бр.",
    binField: "Клетка",
    binPlaceholder: "напр. B-3",
    minLevelField: "Минимално ниво",
    minLevelHint: "Поръчка при или под това.",
    unitCostField: "Единична цена",
    unitCostHint: "По избор.",
    openingQtyField: "Налично количество сега",
    openingQtyHint:
      "По избор — начална наличност, записана като първо складово движение.",
    savePart: "Запазете частта",
    // Stock dialog
    receiveTitle: "Заприходяване на стока",
    issueTitle: "Изписване на стока",
    adjustTitle: "Корекция на бройка",
    receiveVerb: "Заприходете",
    issueVerb: "Изпишете",
    adjustVerb: "Запазете бройката",
    onHandLabel: "Налично",
    countedQty: "Преброено количество",
    countedQtyHint: "Колко реално има на рафта сега.",
    quantityLabel: "Количество",
    reasonField: "Причина",
    reasonIssueHint: "Защо напуска склада.",
    reasonIssuePlaceholder: "напр. използвано на Линия B",
    reasonAdjustPlaceholder: "напр. корекция при инвентаризация",
    stockNotePlaceholder: "напр. номер на поръчка, доставчик",
    // Photo
    replacePhoto: "Сменете снимката",
    addPhoto: "Добавете снимка",
    removePhotoShort: "Премахнете",
    // Errors
    errOnlyAdminAdd: "Само администратор може да добавя части.",
    errOnlyAdminEdit: "Само администратор може да редактира части.",
    errUnknownPart: "Непозната част.",
    errSkuExists: (sku: string) => `Вече съществува част с SKU ${sku}.`,
    errCantReceive: "Нямате право да заприходявате.",
    errCantIssue: "Нямате право да изписвате.",
    errOnlyAdminAdjust: "Само администратор може да коригира бройката.",
    errQtyPositive: "Въведете цяло количество, по-голямо от нула.",
    errCountedQty: "Въведете преброеното количество (нула или повече).",
    errReasonRequired: "Необходима е причина за корекцията.",
    errSkuRequired: "SKU е задължително.",
    errNameRequired: "Името е задължително.",
    errMinNegative: "Минимумът не може да е отрицателен.",
  },

  // Photo upload/delete route errors (surfaced to the client via j.error).
  photos: {
    disabled: "Качването на снимки не е активирано в тази инсталация.",
    noImage: "Не е изпратено изображение.",
    notImage: "Това не е изображение.",
    tooLarge: (mb: number) => `Изображението е твърде голямо (макс. ${mb} MB).`,
    notValid: "Това не е валидно изображение.",
    jobClosed: "Поръчката е приключена. Снимките са заключени.",
    unknownJob: "Непозната поръчка.",
    onlyOwnerRemove:
      "Само този, който я е добавил (или администратор), може да я премахне.",
    onlyAdminPartPhoto: "Само администратор може да променя снимки на части.",
    notFound: "Не е намерено.",
  },

  // Stock ledger error phrasings (thrown from lib/stock, shown on the parts and
  // job screens). onHand/bin come from the StockError.
  stock: {
    partGone: "Тази част вече не съществува.",
    insufficient: (onHand: number, bin: string | null) =>
      `Не достига наличност: ${onHand} налични${
        bin ? `, клетка ${bin}` : ""
      }. Коригирайте бройката, ако складът не съответства.`,
    invalid: "Действието не може да се изпълни. Опитайте отново.",
  },

  workOrders: {
    // Queue
    newWorkOrder: "Нова работна поръчка",
    newShort: "Нова",
    searchPlaceholder: "Търсене на поръчки…",
    filterAnyone: "Всеки",
    unassigned: "Невъзложена",
    filterAnyMachine: "Всяка машина",
    filterAnyPriority: "Всеки приоритет",
    overdueOnly: "Само просрочени",
    emptyNoMatch: "Няма поръчки, отговарящи на филтрите.",
    emptyNone: "Все още няма поръчки.",
    emptyNoActive: "Няма активни поръчки.",
    emptyByStatus: {
      open: "Няма отворени поръчки.",
      in_progress: "Няма поръчки в процес.",
      done: "Няма завършени поръчки.",
      cancelled: "Няма отказани поръчки.",
    },
    truncated: (n: number) =>
      `Показани са първите ${n}. Стеснете филтрите, за да видите повече.`,
    tabs: {
      active: "Активни",
      open: "Отворени",
      in_progress: "В процес",
      done: "Завършени",
      cancelled: "Отказани",
    },
    tabsAria: "Филтриране по статус",
    // Detail
    descriptionLabel: "Описание",
    startWork: "Започнете работа",
    completionNoteLabel: "Бележка при завършване (по избор)",
    completionNotePlaceholder: "Какво направихте?",
    timeSpentLabel: "Отделено време (минути, по избор)",
    timeSpentPlaceholder: "напр. 45",
    markDone: "Завършете",
    completionLabel: "Завършване",
    timeSpentValue: "Отделено време:",
    minUnit: "мин",
    downtimeEnded: (dur: string) =>
      `Престоят на машината приключи. Беше в престой ${dur}.`,
    checklistLabel: "Чеклист",
    partsUsedLabel: "Вложени части",
    addPart: "Добавете част",
    noPartsLogged: "Все още няма вложени части по тази поръчка.",
    partsCost: "Стойност на частите",
    withoutCost: (n: number) => `${n} без посочена цена`,
    removePartLabel: (name: string) => `Премахнете ${name}`,
    removePartConfirm: (qty: number, name: string) =>
      `Да се премахнат ли ${qty} × ${name}? Наличността се връща.`,
    photosLabel: "Снимки",
    activityLabel: "История",
    // Plan row
    assignee: "Изпълнител",
    due: "Срок",
    // Form
    titleField: "Заглавие",
    machineField: "Машина",
    selectMachine: "Изберете машина",
    priorityField: "Приоритет",
    dueDateField: "Срок",
    assigneeField: "Изпълнител",
    descriptionField: "Описание",
    createWorkOrder: "Създайте поръчка",
    fromReportTitle: "Поръчка от сигнал",
    // Add part to job
    chooseDifferent: "Изберете друга част",
    addPartToWo: (id: number) => `Добавяне на част към WO-${id}`,
    quantityUsed: "Използвано количество",
    quantityHint: (n: number, unit: string) =>
      `${n} ${unit} налични. Наличността намалява с записаното.`,
    addToJob: "Добавете към поръчката",
    needAnother: "Нужна ви е друга част? Потърсете в целия каталог по-горе.",
    // Checklist
    ticked: "Отметнато",
    saveFailed: "Неуспешно записване. Опитайте отново.",
    addStepPlaceholder: "Добавете стъпка…",
    newStepAria: "Нова стъпка от чеклиста",
    removeStepLabel: (text: string) => `Премахнете стъпката: ${text}`,
    removeStepConfirm: (text: string) =>
      `Да се премахне ли тази стъпка?\n\n„${text}“`,
    // Downtime prompt
    stillDown: (code: string) => `${code} все още е в престой.`,
    downFor: (dur: string) =>
      `В престой от ${dur}. Работи ли отново, след като поръчката е завършена?`,
    machinePage: "Страница на машината",
    downtimeLeaveNote:
      "Може да остане в престой. Отбележете „работи“ тук или на страницата на машината, когато заработи отново.",
    markRunning: "Да, отбележи като работеща",
    // Job photos
    photosMaxPerJob: (n: number) => `До ${n} снимки на поръчка.`,
    uploadFailed: "Неуспешно качване.",
    removePhotoFailed: "Снимката не можа да се премахне.",
    maxPhotos: (n: number) => `Макс. ${n} снимки`,
    addPhotos: "Добавете снимки",
    photoDialogLabel: "Снимка от поръчката",
    photoAlt: (uploader: string, when: string) =>
      `Снимка от поръчката от ${uploader}, ${when}`,
    removePhoto: "Премахнете снимката",
    imageProcessFailed: "Изображението не можа да се обработи.",
    imageReadFailed: "Изображението не можа да се прочете.",
    // done-anyway warning (shared with my-work)
    doneWarning: (steps: string[]) => {
      const n = steps.length;
      const head =
        n === 1 ? "1 неотметната стъпка:" : `${n} неотметнати стъпки:`;
      const list = steps.map((s) => `• ${s}`).join("\n");
      return `${head}\n\n${list}\n\nДа се завърши ли поръчката въпреки това?`;
    },
    // Server-action errors
    errOnlyAdminCreate: "Само администратор може да създава поръчки.",
    errReportGone: "Този сигнал вече не съществува.",
    errReportHandled: "Този сигнал вече е обработен.",
    errMachineRetiredWork:
      "Тази машина е изведена. Не може да се открива работа по нея.",
    errQueueBusy: "Опашката е заета. Опитайте отново.",
    errOnlyPlannerReassign:
      "Само планиращ може да преназначава или пренасрочва поръчка.",
    errDueInvalid: "Този срок не е валиден.",
    errWorkOrderGone: "Тази поръчка вече не съществува.",
    errJobClosedPlan: "Поръчката е приключена. Планът ѝ не може да се променя.",
    errPickActive: "Изберете активен служител за възлагане.",
    errJobBusy: "Поръчката е заета. Опитайте отново.",
    errStepRequired: "Въведете стъпка.",
    errStepTooLong: "Стъпката трябва да е под 200 знака.",
    errOnlyPlannerChecklist: "Само планиращ може да редактира чеклиста.",
    errJobClosedChecklist: "Поръчката е приключена. Чеклистът ѝ е заключен.",
    errNoPermLogParts: "Нямате право да записвате части.",
    errPickPart: "Изберете част.",
    errQtyMin: "Въведете количество 1 или повече.",
    errJobClosedParts:
      "Поръчката е приключена. Части се записват само по отворена поръчка.",
    errPartGone: "Тази част вече не съществува.",
    errLedgerBusy: "Складовият регистър е зает. Опитайте отново.",
    errTitleRequired: "Заглавието е задължително.",
    errPickMachine: "Изберете машина.",
  },

  myWork: {
    subtitle: "Вашите отворени задачи, най-близките срокове най-отгоре.",
    empty:
      "Няма възложени задачи. Новата работа се появява тук, когато планиращият я възложи.",
    startShort: "Старт",
    doneShort: "Готово",
    startAria: (id: number, title: string) => `Започни WO-${id}: ${title}`,
    completeAria: (id: number, title: string) => `Завърши WO-${id}: ${title}`,
  },

  machines: {
    // List
    printLabels: "Отпечатайте етикети",
    addMachine: "Добавете машина",
    editMachine: "Редактиране на машина",
    saveMachine: "Запазете машината",
    searchPlaceholder: "Търсене по код, име или локация…",
    noPmChip: "Без профилактика",
    allLocations: "Всички локации",
    emptyNoMatch: "Няма машини, отговарящи на филтрите.",
    emptyNone: "Все още няма машини.",
    // Detail
    retiredBanner:
      "Тази машина е изведена. Историята ѝ се запазва и няма да приема нова работа.",
    scanToReport: "Сканирайте за сигнал",
    qrCodeLabel: (code: string) => `QR код към машина ${code}`,
    printLabel: "Отпечатайте етикет",
    markRunning: "Отбележете като работеща",
    markDown: "Отбележете като спряла",
    returnToService: "Върнете в експлоатация",
    returnConfirm: "Да се върне ли машината в експлоатация?",
    retire: "Изведете",
    retireConfirm:
      "Да се изведе ли машината? Излиза от активните списъци и спира да приема нова работа. Историята ѝ се запазва и можете да я върнете по-късно.",
    notesLabel: "Бележки",
    noPartsMachine: "Все още няма записани части за тази машина.",
    qty: "к-во",
    removePartLabel: (sku: string) => `Премахнете ${sku}`,
    removePartConfirm: (sku: string) =>
      `Да се премахне ли ${sku} от тази машина? Премахва се само връзката. Частта и складовата ѝ история остават.`,
    openWork: "Отворени поръчки",
    noOpenWork: "Няма отворени поръчки по тази машина.",
    completedWork: "Завършена работа",
    logged: (dur: string) => `${dur} отчетено`,
    noCompletedWork: "Все още няма завършени поръчки.",
    partsUsed: (n: number) =>
      `${n} ${n === 1 ? "вложена част" : "вложени части"}`,
    addSchedule: "Добавете график",
    noPmScheduled: "Няма планирана профилактика.",
    addPmSchedule: "Добавете график за профилактика",
    everyDays: (n: number) => `На всеки ${n} дни`,
    steps: (n: number) => `${n} ${n === 1 ? "стъпка" : "стъпки"}`,
    paused: "На пауза",
    resumeLabel: (title: string) => `Възобновете ${title}`,
    pauseLabel: (title: string) => `Паузирайте ${title}`,
    editScheduleLabel: (title: string) => `Редактирайте ${title}`,
    deleteScheduleLabel: (title: string) => `Изтрийте ${title}`,
    deleteScheduleConfirm: (title: string) =>
      `Да се изтрие ли графикът „${title}“? Поръчките, които вече е създал, остават като история.`,
    downtimeHistory: "История на престоите",
    noStoppages: "Няма записани престои.",
    fixedBy: "Отстранено от",
    ongoing: "в момента",
    // Form
    nameField: "Име",
    codeField: "Код",
    codeHintEdit:
      "Промяната сменя това, към което сочи QR етикетът. Отпечатайте наново, ако вече е поставен.",
    codeHintNew: "Предложен за вас. Сменете го, ако имате своя схема.",
    locationField: "Локация",
    locationPlaceholder: "напр. Линия B, място 3",
    notesField: "Бележки",
    // Attach part to machine
    addPartToMachine: (name: string) => `Добавяне на част към ${name}`,
    noMatchOrAttached:
      "Няма съвпадащи части или всички съвпадения вече са на тази машина.",
    everyPartAttached: "Всички части вече са добавени или още няма части.",
    quantityField: "Количество",
    quantityHintMachine: "Колко използва тази машина. По избор.",
    noteField: "Бележка",
    noteHint: "напр. позиция. По избор.",
    notePlaceholder: "напр. преден лагер",
    attachPart: "Добавете частта",
    // PM new/edit pages
    newPmScheduleTitle: "Нов график за профилактика",
    editPmScheduleTitle: "Редактиране на график за профилактика",
    forMachine: (code: string, name: string) => `За ${code} · ${name}`,
    retiredNoPm:
      "Тази машина е изведена. Върнете я в експлоатация, преди да планирате профилактика.",
    // Errors
    errNameRequired: "Името е задължително.",
    errCodeRequired: "Кодът е задължителен.",
    errOnlyAdminAdd: "Само администратор може да добавя машини.",
    errOnlyAdminEdit: "Само администратор може да редактира машини.",
    errOnlyAdminAttach: "Само администратор може да добавя части.",
    errCodeExists: (code: string) => `Вече съществува машина с код ${code}.`,
    errRetiredAttach:
      "Тази машина е изведена. Не може да ѝ се добавят части.",
    errPartAlreadyOn: "Тази част вече е на тази машина.",
  },

  pm: {
    next: "Следваща",
    overdue: "просрочена",
    activeSchedules: (n: number) =>
      `${n} ${n === 1 ? "активен график" : "активни графика"}`,
    overdueCount: (n: number) => `${n} просрочени`,
    emptyNone:
      "Все още няма графици за профилактика. Добавете от страницата на всяка машина, за да планирате рутинна поддръжка.",
    nothingDue: "Няма нищо за момента. Всичко е наред.",
    generated: (n: number) =>
      `Създадени са ${n} ${n === 1 ? "поръчка" : "поръчки"}.`,
    generateDue: "Създайте дължимите поръчки",
    titleField: "Заглавие",
    titlePlaceholder: "напр. Смазване",
    everyDaysField: "На всеки (дни)",
    firstDueField: "Първи срок",
    defaultAssignee: "Изпълнител по подразбиране",
    checklistTemplate: "Шаблон за чеклист",
    checklistHint: "По една стъпка на ред. Всяка генерирана поръчка започва с тях.",
    checklistPlaceholder:
      "Проверка на нивото на маслото\nОглед на ремъци\nЗатягане на болтовете",
    saveSchedule: "Запазете графика",
    createSchedule: "Създайте график",
    errTitleRequired: "Заглавието е задължително.",
    errIntervalMin: "Интервалът трябва да е поне 1 ден.",
    errIntervalMax: "Интервалът може да е най-много 3650 дни.",
    errPickDate: "Изберете първи срок.",
    errOnlyPlanner: "Само планиращ може да управлява графиците за профилактика.",
    errMachineRetired:
      "Тази машина е изведена. Не може да планирате профилактика по нея.",
    errFirstDateInvalid: "Първият срок не е валиден.",
    errDateInvalid: "Този срок не е валиден.",
    errScheduleGone: "Този график вече не съществува.",
  },

  reports: {
    title: "Сигнали",
    inboxClear: "Входящите са изчистени",
    waiting: (n: number) => `${n} чакат`,
    reportedFaults: "Подадени сигнали · първо най-старите",
    empty: "Няма чакащи сигнали. На пода е спокойно.",
    reportedFaultAlt: "Подаден сигнал",
    machineRetiredDismiss: "Машината е изведена · само отхвърляне",
    createWorkOrder: "Създайте поръчка",
    dismiss: "Отхвърлете",
    dismissPlaceholder: "Защо се отхвърля?",
    dismissReport: "Отхвърлете сигнала",
    errReasonRequired: "Посочете причина, за да е ясен записът.",
    errReasonTooLong: "Причината трябва да е под 300 знака.",
    errOnlyPlannerTriage: "Само планиращ може да обработва сигнали.",
  },

  dashboard: {
    gaugeOpenJobs: "Отворени поръчки",
    gaugeOverdue: "Просрочени",
    gaugeMachinesDown: "Спрели машини",
    gaugeLowStock: "Ниска наличност",
    gaugeUntriaged: "Необработени сигнали",
    clearNoneOpen: "Няма отворени",
    clearNoneOverdue: "Няма просрочени",
    clearAllRunning: "Всички работят",
    clearStockOk: "Наличността е ок",
    clearInboxClear: "Няма чакащи",
    chipOverdue: "Просрочени",
    chipDown: "Спрели",
    chipLowStock: "Ниска наличност",
    chipToTriage: "За обработка",
    openWorkThisWeek: "Отворена работа · тази седмица",
    noOpenWork: "Няма отворени поръчки.",
    bucketOverdue: "Просрочени",
    bucketToday: "Днес",
    bucketThisWeek: "Тази седмица",
    bucketLater: "По-късно",
    bucketNoneOverdue: "Няма просрочени",
    bucketNothingToday: "Няма за днес",
    bucketNothingThisWeek: "Няма нищо друго тази седмица",
    bucketNothingLater: "Няма планирано по-нататък",
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

  // Daily planner digest email (rendered per-recipient locale).
  digest: {
    overdueJobs: (n: number) => `Просрочени поръчки (${n})`,
    lowStockParts: (n: number) => `Части с ниска наличност (${n})`,
    daysOver: (n: number) => `${n}д закъснение`,
    onHandMin: (onHand: number, min: number) =>
      `налично ${onHand} / мин ${min}`,
    openDashboard: "Отворете таблото",
    dashboardLabel: "Табло:",
    subject: (factory: string, overdue: number, low: number) =>
      `${factory} · ${overdue} просрочени, ${low} с ниска наличност`,
  },

  // QR label sheet. `scanToReport` prints on the physical label in BOTH
  // languages (BG primary) — the artifact can't depend on who printed it.
  print: {
    qrLabels: "QR етикети",
    labelCount: (n: number) => `${n} ${n === 1 ? "етикет" : "етикета"}`,
    print: "Печат",
    intro:
      "Прегледът съответства на отпечатания лист. Поставете по един на всяка машина. Всяко сканиране води до правилното място.",
    empty: "Няма машини за печат на етикети.",
    backToMachines: "Обратно към машините",
    scanToReport: "Сканирайте, за да подадете сигнал за повреда",
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
