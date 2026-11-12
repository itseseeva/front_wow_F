import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Sparkles, Lightbulb } from 'lucide-react';
import { soundFx } from '../utils/audio';

export type TourSectionId = 'routes' | 'rotation' | 'schedule' | 'loot' | 'summary' | 'settings';

export interface TourStep {
  targetSelector: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  tipRu?: string;
  tipEn?: string;
  preferredPosition?: 'bottom' | 'top' | 'left' | 'right';
}

export const TOUR_STEPS: Record<TourSectionId, TourStep[]> = {
  routes: [
    {
      targetSelector: '[data-tour="routes-list"]',
      titleRu: '1. Карта местности',
      titleEn: '1. Terrain Map',
      descRu:
        'Первый раз в новой зоне карта собирается 2–3 минуты — бот в это время стоит. Дальше берётся с диска за пару секунд. Крутые склоны, стены и предметы внутри зданий он обходит, глубокую воду переплывает.',
      descEn:
        'The first time in a new zone, the map compiles in 2–3 minutes — the bot idles meanwhile. Afterwards it loads from disk in seconds. Steep slopes, walls, and interior obstacles are bypassed, deep water is swum across.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="routes-record"]',
      titleRu: '2. Свой маршрут',
      titleEn: '2. Custom Route',
      descRu:
        'Нажмите «Записать», пробегите круг сами и сохраните. Бот пойдёт по нему кусками с небольшими случайностями, а в узких местах и у поворотов — точно по вашему следу.',
      descEn:
        'Click "Record", run the loop yourself, and save. The bot follows it in segments with minor randomized variations, and in tight spots and turns — exactly on your trail.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="routes-autoroute"]',
      titleRu: '3. Автомаршрут',
      titleEn: '3. Auto Route',
      descRu:
        'Если рядом нет маршрута, бот сам строит круг от места запуска через места появления трав и руды — только тех, что умеет собирать ваш персонаж. Расчёт около минуты, длина — в настройках (30–120 мин). Круг сохраняется как «Автомаршрут» и берётся в следующий раз.',
      descEn:
        'If no route is nearby, the bot builds a loop from starting location through herb and ore spawn points matching your character skills. Calculation takes ~1 min, length in Settings (30–120 min). Loop is saved as "Auto Route".',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="routes-list"]',
      titleRu: '4. Сбор по пути',
      titleEn: '4. Gathering on the Run',
      descRu:
        'Руду и траву бот видит на миникарте и сворачивает к ней, если крюк недолгий (до ~20 с бега). Поиск трав и руды переключает сам, заранее — по тому, что впереди. Застрял — шаг назад и обход; застрял 3 раза за минуту — останавливается.',
      descEn:
        'The bot spots ore and herbs on the minimap and diverts toward them if the detour is brief (up to ~20s run). Cycles tracking modes automatically. If stuck, takes a step back and paths around; stops if stuck 3 times in a minute.',
      tipRu: 'Записывайте маршрут там, где сами любите фармить: бот бежит по вашему следу и выглядит как вы.',
      tipEn: 'Record routes where you like to farm: the bot follows your footsteps and looks just like you.',
      preferredPosition: 'top',
    },
  ],

  rotation: [
    {
      targetSelector: '[data-tour="rotation-sequence"]',
      titleRu: '1. Цепочка умений',
      titleEn: '1. Skill Chain',
      descRu:
        'Умения идут слева направо, на кулдауне — пропускаются. «Как только готово» — жмётся вне очереди. Конец каста бот видит по игре. Между кастами иногда делает шаг вперёд или назад, как человек.',
      descEn:
        'Skills fire left-to-right, skipping abilities on cooldown. "ASAP" triggers out of order. Cast completion is tracked directly from game memory. Between casts, it occasionally steps forward or backward like a human.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="rotation-keybind"]',
      titleRu: '2. Клавиши',
      titleEn: '2. Keybinds',
      descRu:
        'Подходят цифры, «-», «=» и буквы. Нельзя: W, A, S, D, пробел, Tab и клавиши из настроек (взаимодействие, предыдущая цель, поиск) — бот ими ходит и целится. F1–F12 не подходят.',
      descEn:
        'Numbers, "-", "=", and letters are supported. Prohibited: W, A, S, D, Space, Tab, and control keys from Settings (Interact, Last Target, Tracking) — used for navigation and aiming. F1–F12 are not allowed.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="rotation-healing"]',
      titleRu: '3. Лечение («HP ниже»)',
      titleEn: '3. Healing ("HP below")',
      descRu:
        'Шаг с порогом HP — это хил. В бою бот лечится, только если иначе проиграет гонку: сравнивает, кто кого убьёт быстрее. Вне боя долечивается до 80–98%.',
      descEn:
        'A step with an HP threshold acts as a heal. In combat, the bot only heals if it would lose the DPS race otherwise, comparing time-to-kill. Out of combat, it heals up to 80–98%.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="rotation-water"]',
      titleRu: '4. Вода',
      titleEn: '4. Water',
      descRu:
        'Только вне боя: мана ниже порога — пьёт до 90–100% (не дольше 35 с). Если на хил не хватает маны — пьёт сразу. Напали — дерётся.',
      descEn:
        'Out of combat only: if mana drops below threshold, it drinks up to 90–100% (max 35s). If there isn’t enough mana to heal, it drinks immediately. If attacked, it engages in combat.',
      tipRu: 'Поставьте хил на «HP ниже 50%» — бот не будет тратить ману, когда моб и так умрёт первым.',
      tipEn: 'Set heals to "HP below 50%" — the bot won’t waste mana when the mob is going to die first anyway.',
      preferredPosition: 'bottom',
    },
  ],

  schedule: [
    {
      targetSelector: '[data-tour="schedule-days"]',
      titleRu: '1. Неделя',
      titleEn: '1. Week',
      descRu:
        'Каждый день недели можно настроить отдельно: сколько часов фармить и в какое время. Дни можно выключать совсем (например, выходные). Нажмите «Скопировать день», чтобы быстро размножить настройку на всю неделю.',
      descEn:
        'Each day of the week is configured individually: active hours and start times. Days can be turned off completely (e.g. weekends). Click "Copy day" to quickly duplicate your configuration across the entire week.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="schedule-styles"]',
      titleRu: '2. Стили',
      titleEn: '2. Styles',
      descRu:
        'Четыре профиля на выбор: Осторожный (короткие сессии, длинные паузы), Обычный (рекомендуется), Интенсивный (больше фарма, меньше пауз) и Свой (ваши секунды и минуты).',
      descEn:
        'Choose from four behavior profiles: Cautious (short sessions, long breaks), Normal (recommended), Intensive (more farming, fewer pauses), and Custom (fine-tuned timings).',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="schedule-windows"]',
      titleRu: '3. Когда и сколько играть',
      titleEn: '3. Playtime & Schedule',
      descRu:
        'Задайте временные окна, в которые бот может запускаться, и добавьте до 4 интервалов на день. Бот сам слегка сдвигает старт и конец каждого окна, чтобы расписание выглядело естественно.',
      descEn:
        'Set active playtime windows for the day and add up to 4 intervals. The bot slightly varies start and end times so your schedule looks natural.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="schedule-breaks"]',
      titleRu: '4. Перерывы',
      titleEn: '4. Breaks',
      descRu:
        'Внутри игрового времени бот делает короткие перерывы на несколько минут (отойти от компьютера) и длинные раз в 2–3 сессии (поесть, отдохнуть). Можно включить случайные выходные раз в 10 дней.',
      descEn:
        'During play sessions, the bot takes short pauses for a few minutes (stepping away from the keyboard) and long breaks every 2–3 sessions (meals, rest). You can also enable random days off every 10 days.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="schedule-finetune"]',
      titleRu: '5. Мягкий конец',
      titleEn: '5. Soft Exit',
      descRu:
        'Когда время сессии вышло, бот не выдёргивает провод: он добивает моба, собирает руду или траву, добегает до безопасного места и только потом выходит.',
      descEn:
        'When session time expires, the bot never pulls the plug: it finishes off the current mob, gathers nearby nodes, runs to a safe location, and only then logs out.',
      tipRu: 'Не ставьте все дни одинаково — одинаковые дни и выдают бота.',
      tipEn: 'Avoid configuring every day identically — uniform schedules are the easiest way to give away a bot.',
      preferredPosition: 'top',
    },
  ],

  loot: [
    {
      targetSelector: '[data-tour="loot-auto-toggle"]',
      titleRu: '1. Цена ячейки',
      titleEn: '1. Slot Value',
      descRu:
        'Бот прикидывает, чем заполнится сумка за ближайшие часы: сначала травы и руда, потом лучшее с мобов. Что не влезает — остаётся на трупе.',
      descEn:
        'The bot estimates what will fill your bags over the next hours: herbs and ore first, then the best mob drops. Anything that will not fit stays on the corpse.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-threshold-inputs"]',
      titleRu: '2. Не брать дешевле',
      titleEn: '2. Never Loot Below',
      descRu:
        'Ваша граница: дешевле неё бот не возьмёт никогда, даже если место есть.',
      descEn:
        'Your hard minimum floor: the bot will never pick up items cheaper than this, even with free bag space.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-now"]',
      titleRu: '3. Пока опыта мало',
      titleEn: '3. Early Learning',
      descRu:
        'Первые 20 убийств вида моба бот судит по ценам того, что вы собираете.',
      descEn:
        'For the first 20 kills of a mob type, the bot estimates thresholds from the value of what you gather.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-memory"]',
      titleRu: '4. Память дропа',
      titleEn: '4. Drop Memory',
      descRu:
        'Бот запоминает каждого убитого моба и что с него упало. Память копится от сессии к сессии — это настоящий дроп Forever в ваших местах фарма.',
      descEn:
        'The bot records every mob killed and what dropped from it. Memory accumulates across sessions—real Forever drop rates in your farming spots.',
      tipRu: 'Загляните в «Память дропа» после пары часов в одной зоне — там видно, что реально падает и почём.',
      tipEn: 'Check «Drop memory» after a couple hours in one zone to see what actually drops and its auction value.',
      preferredPosition: 'top',
    },
  ],

  summary: [
    {
      targetSelector: '[data-tour="summary-live-cards"]',
      titleRu: '1. Сессия сейчас',
      titleEn: '1. Current Session',
      descRu:
        'В карточках в реальном времени: сколько бот работает, сколько золота заработал, темп «в час» и сколько осталось до ближайшего перерыва.',
      descEn:
        'Real-time telemetry cards: bot uptime, total gold earned, "per hour" rate, and countdown to the next scheduled break.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="summary-gold-rate"]',
      titleRu: '2. Цены',
      titleEn: '2. Prices',
      descRu:
        'Цены на руду, траву и предметы бот берёт с аукциона вашего сервера (настраивается в Настройках). Если сервер не найден — считает по базовой цене торговца.',
      descEn:
        'Ore, herb, and drop prices are pulled from your server auction data (configured in Settings). If realm data is unavailable, vendor prices are used.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="summary-calendar"]',
      titleRu: '3. История',
      titleEn: '3. History',
      descRu:
        'Календарь слева помнит все прошлые сессии по дням: сколько нафармлено, сколько чистого золота вышло, сколько времени бот был активен.',
      descEn:
        'The sidebar calendar preserves past sessions by date: total farmed value, net gold earned, and total bot uptime.',
      preferredPosition: 'right',
    },
    {
      targetSelector: '[data-tour="summary-heatmap"]',
      titleRu: '4. Карта прохода',
      titleEn: '4. Farm Map',
      descRu:
        'На карте маршрута видно, где бот подбирал траву и руду, а где дрался с мобами — можно оценить, какая часть круга приносит больше всего.',
      descEn:
        'The route map visually highlights where herbs/ores were gathered and where combat took place — helping identify the most lucrative sections of the loop.',
      tipRu: 'Пишет «нет цен» — проверьте в Настройках, что найдены ключи и выбран аукцион (или «Авто»).',
      tipEn: 'If it displays "no prices", check Settings to ensure auction keys are detected and realm auction is selected (or set to "Auto").',
      preferredPosition: 'top',
    },
  ],

  settings: [
    {
      targetSelector: '[data-tour="settings-schedule"]',
      titleRu: '1. Расписание фарма',
      titleEn: '1. Farm Schedule',
      descRu:
        'Включает автоматические сессии по вашему графику, перерывы и шанс случайного выходного. Подробное расписание по дням и часам настраивается во вкладке «Расписание».',
      descEn:
        'Enables automatic farming sessions by schedule, realistic breaks, and random days off. Fine-tune daily hours and windows in the Schedule tab.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-autoroute"]',
      titleRu: '2. Автоматический маршрут',
      titleEn: '2. Auto Route',
      descRu:
        'Длина автомаршрута задаёт размер сгенерированного круга (30–120 минут). Если рядом нет записанного маршрута, бот сам строит петлю по местам руды и трав.',
      descEn:
        'Sets the generated loop duration (30–120 minutes). If no recorded route is nearby, the bot automatically builds a loop along ore and herb spots.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-auction"]',
      titleRu: '3. Цены аукциона',
      titleEn: '3. Auction Prices',
      descRu:
        'Выберите сервер или оставьте «Авто» — бот будет подтягивать цены вашего аукциона, чтобы точно считать стоимость добычи и доход в час.',
      descEn:
        'Select your server or keep "Auto" so the bot pulls faction auction prices to calculate loot value and gold per hour.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-keybinds"]',
      titleRu: '4. Клавиши игры',
      titleEn: '4. Game Keys',
      descRu:
        '«Взаимодействие с целью» и «Предыдущая цель» настройте в игре на те же клавиши, что указаны тут. Иначе бот не сможет лутать и целиться в моба за спиной.',
      descEn:
        'Configure "Interact With Target" and "Previous Target" in-game to match the keys specified here. Otherwise the bot cannot loot or acquire targets behind it.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="settings-pause"]',
      titleRu: '5. Пауза',
      titleEn: '5. Pause',
      descRu:
        'Клавиша «Пауза» (по умолчанию Pause/Break) мгновенно отпускает управление. Нажали — играете руками; нажали ещё раз — бот продолжил с того же места.',
      descEn:
        'The emergency "Pause" key (default Pause/Break) instantly releases all keys and halts bot actions. Press again to resume seamlessly from the same spot.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="settings-radar"]',
      titleRu: '6. Поиск трав и минералов',
      titleEn: '6. Tracking Herbs & Minerals',
      descRu:
        'Клавиши F9 и F10 аддон настраивает сам, выносить их на панель не нужно. Если играете собирателем — включите оба поиска, бот будет переключать их по очереди.',
      descEn:
        'Keys F9 and F10 are managed automatically by the addon without needing action bar slots. If gathering both professions, enable both tracking options so the bot cycles between them.',
      tipRu: 'Поменяли клавиши — сделайте /reload в игре, иначе аддон помнит старые.',
      tipEn: 'Whenever you change keybindings, run /reload in game chat, otherwise the addon continues using previous bindings.',
      preferredPosition: 'top',
    },
  ],
};

const FALLBACK_SELECTORS: Record<string, string[]> = {
  '[data-tour="rotation-healing"]': ['[data-tour="rotation-keybind"]', '[data-tour="rotation-editor"]', '[data-tour="rotation-sequence"]'],
  '[data-tour="rotation-keybind"]': ['[data-tour="rotation-editor"]', '[data-tour="rotation-sequence"]'],
  '[data-tour="rotation-timings"]': ['[data-tour="rotation-editor"]', '[data-tour="rotation-sequence"]'],
  '[data-tour="rotation-water"]': ['[data-tour="rotation-sequence"]'],
  '[data-tour="loot-threshold-inputs"]': ['[data-tour="loot-auto-toggle"]', '[data-tour="loot-card"]'],
  '[data-tour="loot-auto-toggle"]': ['[data-tour="loot-card"]'],
  '[data-tour="loot-now"]': ['[data-tour="loot-card"]'],
  '[data-tour="loot-memory"]': ['[data-tour="loot-now"]', '[data-tour="loot-card"]'],
  '[data-tour="schedule-windows"]': ['[data-tour="schedule-day-config"]', '[data-tour="schedule-styles"]', '[data-tour="schedule-days"]'],
  '[data-tour="schedule-breaks"]': ['[data-tour="schedule-day-config"]', '[data-tour="schedule-styles"]', '[data-tour="schedule-days"]'],
  '[data-tour="schedule-finetune"]': ['[data-tour="schedule-day-config"]', '[data-tour="schedule-styles"]', '[data-tour="schedule-days"]'],
  '[data-tour="summary-heatmap"]': ['[data-tour="summary-live-cards"]', '[data-tour="summary-overview"]'],
  '[data-tour="summary-gold-rate"]': ['[data-tour="summary-live-cards"]', '[data-tour="summary-overview"]'],
  '[data-tour="summary-live-cards"]': ['[data-tour="summary-overview"]'],
  '[data-tour="summary-calendar"]': ['[data-tour="summary-overview"]'],
  '[data-tour="settings-schedule"]': ['[data-tour="settings-autoroute"]', '[data-tour="settings-keybinds"]'],
  '[data-tour="settings-autoroute"]': ['[data-tour="settings-schedule"]', '[data-tour="settings-keybinds"]'],
  '[data-tour="settings-auction"]': ['[data-tour="settings-autoroute"]', '[data-tour="settings-schedule"]'],
  '[data-tour="settings-pause"]': ['[data-tour="settings-keybinds"]', '[data-tour="settings-autoroute"]'],
  '[data-tour="settings-radar"]': ['[data-tour="settings-keybinds"]', '[data-tour="settings-autoroute"]'],
  '[data-tour="settings-keybinds"]': ['[data-tour="settings-autoroute"]', '[data-tour="settings-schedule"]'],
  '[data-tour="routes-record"]': ['[data-tour="routes-list"]'],
  '[data-tour="routes-autoroute"]': ['[data-tour="routes-list"]'],
};

interface InteractiveTourGuideProps {
  activeSection: TourSectionId | null;
  onClose: () => void;
  language?: 'ru' | 'en';
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

type Side = 'top' | 'bottom' | 'left' | 'right';

const GAP = 18;
const MARGIN = 16;
const TARGET_BUFFER = 6;

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

const getIntersectionArea = (
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number }
) => {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
};

const isVisibleElement = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

const resolveTargetElement = (selector: string): HTMLElement | null => {
  const primary = document.querySelector(selector);
  if (isVisibleElement(primary)) return primary;

  const fallbacks = FALLBACK_SELECTORS[selector] || [];
  for (const fb of fallbacks) {
    const el = document.querySelector(fb);
    if (isVisibleElement(el)) return el;
  }
  return null;
};

const findScrollContainer = (el: HTMLElement): HTMLElement | null => {
  let parent = el.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      parent.scrollHeight > parent.clientHeight + 2
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
};

const OPPOSITE_SIDE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

const computeCardPlacement = (
  targetRect: TargetRect,
  cardWidth: number,
  cardHeight: number,
  vw: number,
  vh: number,
  preferred: Side
): { top: number; left: number; hasOverlap: boolean } => {
  const maxLeft = Math.max(MARGIN, vw - cardWidth - MARGIN);
  const maxTop = Math.max(MARGIN, vh - cardHeight - MARGIN);

  const bufferedTarget = {
    left: targetRect.left - TARGET_BUFFER,
    top: targetRect.top - TARGET_BUFFER,
    right: targetRect.right + TARGET_BUFFER,
    bottom: targetRect.bottom + TARGET_BUFFER,
  };

  const allSides: Side[] = ['bottom', 'top', 'right', 'left'];
  const orderedSides: Side[] = [
    preferred,
    OPPOSITE_SIDE[preferred],
    ...allSides.filter((s) => s !== preferred && s !== OPPOSITE_SIDE[preferred]),
  ];

  const makeSideCandidate = (side: Side) => {
    let rawTop = 0;
    let rawLeft = 0;
    if (side === 'bottom') {
      rawTop = targetRect.bottom + GAP;
      rawLeft = targetRect.left + (targetRect.width - cardWidth) / 2;
    } else if (side === 'top') {
      rawTop = targetRect.top - GAP - cardHeight;
      rawLeft = targetRect.left + (targetRect.width - cardWidth) / 2;
    } else if (side === 'right') {
      rawLeft = targetRect.right + GAP;
      rawTop = targetRect.top + (targetRect.height - cardHeight) / 2;
    } else {
      rawLeft = targetRect.left - GAP - cardWidth;
      rawTop = targetRect.top + (targetRect.height - cardHeight) / 2;
    }
    const left = clamp(rawLeft, MARGIN, maxLeft);
    const top = clamp(rawTop, MARGIN, maxTop);
    const rect = { left, top, right: left + cardWidth, bottom: top + cardHeight };
    const overlap = getIntersectionArea(rect, bufferedTarget);
    const exactOverlap = getIntersectionArea(rect, targetRect);
    return { left, top, overlap, exactOverlap };
  };

  let bestCandidate: { left: number; top: number; overlap: number; exactOverlap: number } | null = null;

  for (const side of orderedSides) {
    const cand = makeSideCandidate(side);
    if (cand.overlap === 0) {
      return { top: cand.top, left: cand.left, hasOverlap: false };
    }
    if (!bestCandidate || cand.overlap < bestCandidate.overlap) {
      bestCandidate = cand;
    }
  }

  // Fallback corners if target is very tall/wide and all 4 direct sides intersect
  const corners = [
    { left: maxLeft, top: maxTop },
    { left: maxLeft, top: MARGIN },
    { left: MARGIN, top: maxTop },
    { left: MARGIN, top: MARGIN },
  ];

  for (const corner of corners) {
    const rect = {
      left: corner.left,
      top: corner.top,
      right: corner.left + cardWidth,
      bottom: corner.top + cardHeight,
    };
    const overlap = getIntersectionArea(rect, bufferedTarget);
    const exactOverlap = getIntersectionArea(rect, targetRect);
    if (overlap === 0) {
      return { top: corner.top, left: corner.left, hasOverlap: false };
    }
    if (!bestCandidate || overlap < bestCandidate.overlap) {
      bestCandidate = { ...corner, overlap, exactOverlap };
    }
  }

  return {
    top: bestCandidate?.top ?? maxTop,
    left: bestCandidate?.left ?? maxLeft,
    hasOverlap: (bestCandidate?.exactOverlap ?? 0) > 0,
  };
};

export const InteractiveTourGuide: React.FC<InteractiveTourGuideProps> = ({
  activeSection,
  onClose,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [cardSize, setCardSize] = useState<{ width: number; height: number }>({ width: 360, height: 240 });
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const [hasOverlap, setHasOverlap] = useState<boolean>(false);
  const [isPositioned, setIsPositioned] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const observedTargetRef = useRef<HTMLElement | null>(null);

  // Reset step index and positioning flag when activeSection changes
  useEffect(() => {
    setCurrentStepIndex(0);
    setIsPositioned(false);
  }, [activeSection]);

  const steps = activeSection ? TOUR_STEPS[activeSection] || [] : [];
  const currentStep = steps[currentStepIndex] || null;

  // Measure tooltip card dimensions accurately with ResizeObserver
  useLayoutEffect(() => {
    const cardEl = cardRef.current;
    if (!cardEl || !activeSection || !currentStep) return;

    const measure = () => {
      const w = cardEl.offsetWidth;
      const h = cardEl.offsetHeight;
      if (w > 0 && h > 0) {
        setCardSize((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(cardEl);
    return () => ro.disconnect();
  }, [activeSection, currentStep, currentStepIndex, language]);

  // Measure target element position relative to viewport
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const el = resolveTargetElement(currentStep.targetSelector);
    observedTargetRef.current = el;

    if (!el) {
      setTargetRect(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 6;

    const left = Math.max(8, rect.left - pad);
    const top = Math.max(8, rect.top - pad);
    const right = Math.min(vw - 8, rect.right + pad);
    const bottom = Math.min(vh - 8, rect.bottom + pad);

    setTargetRect({
      top,
      left,
      right,
      bottom,
      width: Math.max(16, right - left),
      height: Math.max(16, bottom - top),
    });
  }, [currentStep]);

  // Smart scroll when step opens/changes so there is room for both target and card
  useEffect(() => {
    if (!activeSection || !currentStep) return;

    const performSmartScroll = () => {
      const el = resolveTargetElement(currentStep.targetSelector);
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const estimatedCardH = cardRef.current?.offsetHeight || cardSize.height || 260;
      const neededRoom = estimatedCardH + GAP + MARGIN + 8;
      const preferred = currentStep.preferredPosition || 'bottom';
      const scrollContainer = findScrollContainer(el);

      const hasRoomBelow = vh - rect.bottom >= neededRoom;
      const hasRoomAbove = rect.top >= neededRoom;
      const isComfortablyInView = rect.top >= 24 && rect.bottom <= vh - 24;

      if (isComfortablyInView && (hasRoomBelow || hasRoomAbove)) {
        return;
      }

      if (scrollContainer) {
        let desiredTop = rect.top;
        if (rect.height > vh - 120) {
          desiredTop = 32;
        } else if (preferred === 'bottom') {
          desiredTop = Math.max(32, vh - rect.height - neededRoom);
        } else if (preferred === 'top') {
          desiredTop = Math.min(vh - rect.height - 32, neededRoom);
        } else {
          desiredTop = Math.max(32, (vh - rect.height) / 2);
        }

        const delta = rect.top - desiredTop;
        if (Math.abs(delta) > 8) {
          scrollContainer.scrollBy({ top: delta, behavior: 'smooth' });
        }
      } else {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
    };

    // Wait one frame for any newly switched tab layout before scrolling
    const rafId = requestAnimationFrame(performSmartScroll);
    return () => cancelAnimationFrame(rafId);
  }, [activeSection, currentStep, currentStepIndex]);

  // Track target position across animations, scroll, resize, and DOM mutations
  useEffect(() => {
    if (!activeSection || !currentStep) return;

    updateTargetPosition();

    // Re-measure through tab-switch CSS animations (assembleIn = 320ms) and smooth scrolls
    const timers = [50, 160, 340, 520].map((ms) => setTimeout(updateTargetPosition, ms));

    let ro: ResizeObserver | null = null;
    if (observedTargetRef.current) {
      ro = new ResizeObserver(updateTargetPosition);
      ro.observe(observedTargetRef.current);
    }

    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      timers.forEach(clearTimeout);
      ro?.disconnect();
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [activeSection, currentStep, updateTargetPosition]);

  // Position the floating tooltip card without overlapping targetRect
  useLayoutEffect(() => {
    if (!activeSection || !currentStep) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = cardSize.width || Math.min(380, vw - 32);
    const cardHeight = cardSize.height || 240;

    if (!targetRect) {
      setCardPosition({
        top: Math.max(MARGIN, (vh - cardHeight) / 2),
        left: Math.max(MARGIN, (vw - cardWidth) / 2),
      });
      setHasOverlap(false);
      setIsPositioned(true);
      return;
    }

    const preferred = currentStep.preferredPosition || 'bottom';
    const placement = computeCardPlacement(targetRect, cardWidth, cardHeight, vw, vh, preferred);

    setCardPosition({ top: placement.top, left: placement.left });
    setHasOverlap(placement.hasOverlap);
    setIsPositioned(true);
  }, [activeSection, targetRect, currentStep, cardSize]);

  // Keyboard navigation: Escape closes, ArrowRight/Enter advances, ArrowLeft goes back
  useEffect(() => {
    if (!activeSection) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (currentStepIndex < steps.length - 1) {
          soundFx.playClick();
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          soundFx.playClick();
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          soundFx.playClick();
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSection, currentStepIndex, steps.length, onClose]);

  if (!activeSection || !currentStep) return null;

  const isLastStep = currentStepIndex >= steps.length - 1;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;

  // Calculate crisp rectangular clip-path cutout for the backdrop blur layer
  const blurClipPath = targetRect
    ? `polygon(evenodd, 0px 0px, ${vw}px 0px, ${vw}px ${vh}px, 0px ${vh}px, 0px 0px, ${
        targetRect.left + 2
      }px ${targetRect.top + 2}px, ${targetRect.left + 2}px ${targetRect.bottom - 2}px, ${
        targetRect.right - 2
      }px ${targetRect.bottom - 2}px, ${targetRect.right - 2}px ${targetRect.top + 2}px, ${
        targetRect.left + 2
      }px ${targetRect.top + 2}px)`
    : undefined;

  // Calculate 4-edge connecting pointer line between targetRect and card
  let lineStart = { x: 0, y: 0 };
  let lineEnd = { x: 0, y: 0 };
  const showPointerLine = Boolean(targetRect && isPositioned && !hasOverlap);

  if (targetRect && showPointerLine) {
    const cardRight = cardPosition.left + cardSize.width;
    const cardBottom = cardPosition.top + cardSize.height;
    const cardCenterX = cardPosition.left + cardSize.width / 2;
    const cardCenterY = cardPosition.top + cardSize.height / 2;

    if (cardPosition.top >= targetRect.bottom) {
      // Card is below target
      lineStart = {
        x: clamp(cardCenterX, targetRect.left + 14, targetRect.right - 14),
        y: targetRect.bottom,
      };
      lineEnd = { x: cardCenterX, y: cardPosition.top };
    } else if (cardBottom <= targetRect.top) {
      // Card is above target
      lineStart = {
        x: clamp(cardCenterX, targetRect.left + 14, targetRect.right - 14),
        y: targetRect.top,
      };
      lineEnd = { x: cardCenterX, y: cardBottom };
    } else if (cardPosition.left >= targetRect.right) {
      // Card is right of target
      lineStart = {
        x: targetRect.right,
        y: clamp(cardCenterY, targetRect.top + 14, targetRect.bottom - 14),
      };
      lineEnd = { x: cardPosition.left, y: cardCenterY };
    } else {
      // Card is left of target
      lineStart = {
        x: targetRect.left,
        y: clamp(cardCenterY, targetRect.top + 14, targetRect.bottom - 14),
      };
      lineEnd = { x: cardRight, y: cardCenterY };
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fadeIn">
      {/* 1. Backdrop Dim with Sharp Rectangular Cutout */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx={12}
                ry={12}
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Backdrop blur layer (matches targetRect rectangle cleanly) */}
      <div
        className="absolute inset-0 backdrop-blur-sm pointer-events-none"
        style={blurClipPath ? { clipPath: blurClipPath, WebkitClipPath: blurClipPath } : undefined}
      />

      {/* Click outside to close */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={() => {
          soundFx.playClick();
          onClose();
        }}
      />

      {/* 2. Sharp Target Highlight Frame (Stealth HUD Specular Border) */}
      {targetRect && (
        <div
          className="absolute pointer-events-none z-20 rounded-xl transition-all duration-200 ease-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            border: '1.5px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 0 22px rgba(255, 255, 255, 0.2), inset 0 0 12px rgba(255, 255, 255, 0.06)',
          }}
        >
          <div
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] animate-ping opacity-75"
          />
          <div
            className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
          />
        </div>
      )}

      {/* 3. Silver-White Connecting Pointer Line */}
      {showPointerLine && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" xmlns="http://www.w3.org/2000/svg">
          <line
            x1={lineStart.x}
            y1={lineStart.y}
            x2={lineEnd.x}
            y2={lineEnd.y}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            x1={lineStart.x}
            y1={lineStart.y}
            x2={lineEnd.x}
            y2={lineEnd.y}
            stroke="rgba(255, 255, 255, 0.85)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
          <circle cx={lineStart.x} cy={lineStart.y} r="3" fill="#ffffff" />
        </svg>
      )}

      {/* 4. Floating Glassmorphic Tooltip Card (Stealth HUD Aesthetic) */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className={`absolute z-40 w-[340px] sm:w-[380px] max-w-[92vw] rounded-2xl border border-white/15 bg-zinc-950/94 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-4 flex flex-col gap-2.5 text-zinc-100 ${
          isPositioned ? 'opacity-100 transition-[top,left,opacity] duration-200 ease-out' : 'opacity-0 pointer-events-none'
        }`}
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
        }}
      >
        {/* Top 1px Specular Border Sheen */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

        {/* Card Header: Step Pill & Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-zinc-300 border border-white/10">
              {isRu ? `ШАГ ${currentStepIndex + 1} ИЗ ${steps.length}` : `STEP ${currentStepIndex + 1} OF ${steps.length}`}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={isRu ? 'Закрыть обучение (Esc)' : 'Close tour (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-1.5">
          <h3 className="font-mono font-bold text-sm text-white tracking-wide flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
            <span>{isRu ? currentStep.titleRu : currentStep.titleEn}</span>
          </h3>
          <p className="font-sans text-xs text-zinc-300 leading-relaxed">
            {isRu ? currentStep.descRu : currentStep.descEn}
          </p>
          {currentStep.tipRu && (
            <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/15 flex items-start gap-2 text-zinc-300 text-[11px] leading-relaxed mt-0.5">
              <Lightbulb className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
              <div>
                <span className="font-mono font-semibold text-white">{isRu ? 'Совет: ' : 'Tip: '}</span>
                <span>{isRu ? currentStep.tipRu : currentStep.tipEn}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Back / Next Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-0.5">
          <button
            type="button"
            disabled={currentStepIndex === 0}
            onClick={() => {
              soundFx.playClick();
              setCurrentStepIndex((prev) => Math.max(0, prev - 1));
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono text-zinc-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{isRu ? 'Назад' : 'Back'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              if (isLastStep) {
                onClose();
              } else {
                setCurrentStepIndex((prev) => prev + 1);
              }
            }}
            className="h-8 px-4 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 font-mono font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-[0_0_12px_rgba(255,255,255,0.2)]"
          >
            <span>{isLastStep ? (isRu ? 'Понятно' : 'Got it') : isRu ? 'Далее' : 'Next'}</span>
            {isLastStep ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
