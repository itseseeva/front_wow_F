import React, { useState, useEffect, useRef, useCallback } from 'react';
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
      preferredPosition: 'right',
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
      preferredPosition: 'right',
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
      targetSelector: '[data-tour="rotation-timings"]',
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
      preferredPosition: 'top',
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
      targetSelector: '[data-tour="schedule-breaks"]',
      titleRu: '3. Перерывы',
      titleEn: '3. Breaks',
      descRu:
        'Внутри игрового времени бот делает короткие перерывы на несколько минут (отойти от компьютера) и длинные раз в 2–3 сессии (поесть, отдохнуть). Можно включить случайные выходные раз в 10 дней.',
      descEn:
        'During play sessions, the bot takes short pauses for a few minutes (stepping away from the keyboard) and long breaks every 2–3 sessions (meals, rest). You can also enable random days off every 10 days.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="schedule-finetune"]',
      titleRu: '4. Мягкий конец',
      titleEn: '4. Soft Exit',
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
      targetSelector: '[data-tour="loot-card"]',
      titleRu: '1. Правило',
      titleEn: '1. Rule',
      descRu:
        'С мобов берётся только то, что стоит дороже порога. Предметы дешевле бот оставляет на трупе — сумка не забивается серыми вещами за пару копеек.',
      descEn:
        'Only items valued above the threshold are looted from corpses. Cheaper trash items are left behind, keeping bags free of low-value junk.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-card"]',
      titleRu: '2. Что берёт всегда',
      titleEn: '2. Always Looted',
      descRu:
        'Травы и руду бот берёт ВСЕГДА, даже если порог высокий: на них он и зарабатывает.',
      descEn:
        'Herbs and mining ores are ALWAYS collected, even with high value thresholds: they are the main source of income.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-auto-toggle"]',
      titleRu: '3. Авто',
      titleEn: '3. Auto',
      descRu:
        'В режиме «Авто» бот сам прикидывает порог по уровню зоны и вашим свободным слотам. Для большинства зон этого достаточно.',
      descEn:
        'In "Auto" mode, the bot dynamically calculates the threshold based on zone level and available bag slots. This is optimal for most zones.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="loot-threshold-inputs"]',
      titleRu: '4. Свой порог',
      titleEn: '4. Custom Threshold',
      descRu:
        'Снимите галочку «Авто» и задайте порог в серебре и золоте руками. Например: 5 серебра — всё, что дешевле 5 серебряных монет, останется на мобе.',
      descEn:
        'Uncheck "Auto" to set the threshold manually in gold and silver. For example, 5 silver: anything worth under 5 silver is left on the corpse.',
      tipRu: 'Начните с «Авто» и посмотрите итог сессии — подправить порог можно всегда.',
      tipEn: 'Start with "Auto" and check your session earnings — you can adjust the threshold at any time.',
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
      targetSelector: '[data-tour="summary-live-cards"]',
      titleRu: '4. Карта прохода',
      titleEn: '4. Farm Map',
      descRu:
        'На карте маршрута видно, где бот подбирал траву и руду, а где дрался с мобами — можно оценить, какая часть круга приносит больше всего.',
      descEn:
        'The route map visually highlights where herbs/ores were gathered and where combat took place — helping identify the most lucrative sections of the loop.',
      tipRu: 'Пишет «нет цен» — проверьте в Настройках, что найдены ключи и выбран аукцион (или «Авто»).',
      tipEn: 'If it displays "no prices", check Settings to ensure auction keys are detected and realm auction is selected (or set to "Auto").',
      preferredPosition: 'bottom',
    },
  ],

  settings: [
    {
      targetSelector: '[data-tour="settings-keybinds"]',
      titleRu: '1. Клавиши игры',
      titleEn: '1. Game Keys',
      descRu:
        '«Взаимодействие с целью» и «Предыдущая цель» настройте в игре на те же клавиши, что указаны тут. Иначе бот не сможет лутать и целиться в моба за спиной.',
      descEn:
        'Configure "Interact With Target" and "Previous Target" in-game to match the keys specified here. Otherwise the bot cannot loot or acquire targets behind it.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-pause"]',
      titleRu: '2. Пауза',
      titleEn: '2. Pause',
      descRu:
        'Клавиша «Пауза» (по умолчанию Pause/Break) мгновенно отпускает управление. Нажали — играете руками; нажали ещё раз — бот продолжил с того же места.',
      descEn:
        'The emergency "Pause" key (default Pause/Break) instantly releases all keys and halts bot actions. Press again to resume seamlessly from the same spot.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-radar"]',
      titleRu: '3. Поиск трав и минералов',
      titleEn: '3. Tracking Herbs & Minerals',
      descRu:
        'Клавиши F9 и F10 аддон настраивает сам, выносить их на панель не нужно. Если играете собирателем — включите оба поиска, бот будет переключать их по очереди.',
      descEn:
        'Keys F9 and F10 are managed automatically by the addon without needing action bar slots. If gathering both professions, enable both tracking options so the bot cycles between them.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="settings-autoroute"]',
      titleRu: '4. Автомаршрут и аукцион',
      titleEn: '4. Auto Route & Auction',
      descRu:
        'Длина автомаршрута задаёт размер сгенерированного круга (30–120 минут). В блоке аукциона выберите сервер или оставьте «Авто», чтобы бот знал цены вашей фракции.',
      descEn:
        'The route slider configures loop generation length (30–120 minutes). In the auction section, select your server or leave on "Auto" so the bot tracks your faction prices.',
      tipRu: 'Поменяли клавиши — сделайте /reload в игре, иначе аддон помнит старые.',
      tipEn: 'Whenever you change keybindings, run /reload in game chat, otherwise the addon continues using previous bindings.',
      preferredPosition: 'top',
    },
  ],
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

export const InteractiveTourGuide: React.FC<InteractiveTourGuideProps> = ({
  activeSection,
  onClose,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number }>({ top: 100, left: 100 });
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Reset step index when activeSection changes
  useEffect(() => {
    setCurrentStepIndex(0);
  }, [activeSection]);

  const steps = activeSection ? TOUR_STEPS[activeSection] || [] : [];
  const currentStep = steps[currentStepIndex] || null;

  // Measure and track target element position
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    let el = document.querySelector(currentStep.targetSelector);
    if (!el) {
      if (currentStep.targetSelector.includes('loot')) {
        el = document.querySelector('[data-tour="loot-auto-toggle"]') || document.querySelector('[data-tour="loot-card"]');
      } else if (currentStep.targetSelector.includes('routes')) {
        el = document.querySelector('[data-tour="routes-list"]');
      } else if (currentStep.targetSelector.includes('summary')) {
        el = document.querySelector('[data-tour="summary-live-cards"]');
      }
    }

    if (!el) {
      setTargetRect(null);
      return;
    }

    // Scroll into view if needed
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });

    const rect = el.getBoundingClientRect();
    const pad = 6;
    const computedRect: TargetRect = {
      top: Math.max(8, rect.top - pad),
      left: Math.max(8, rect.left - pad),
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      right: rect.right + pad,
      bottom: rect.bottom + pad,
    };
    setTargetRect(computedRect);
  }, [currentStep]);

  useEffect(() => {
    updateTargetPosition();
    const timer = setTimeout(updateTargetPosition, 250);
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [updateTargetPosition]);

  // Position the floating tooltip card relative to target element
  useEffect(() => {
    if (!targetRect) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = Math.min(380, vw - 32);
    const cardHeight = 200; // estimated max height

    let top = targetRect.bottom + 24;
    let left = targetRect.left + (targetRect.width - cardWidth) / 2;

    const preferred = currentStep?.preferredPosition || 'bottom';

    if (preferred === 'top' || (preferred === 'bottom' && targetRect.bottom + cardHeight + 40 > vh)) {
      if (targetRect.top - cardHeight - 24 > 10) {
        top = targetRect.top - cardHeight - 24;
      }
    }

    if (preferred === 'right' && targetRect.right + cardWidth + 24 < vw) {
      top = Math.max(20, targetRect.top + (targetRect.height - cardHeight) / 2);
      left = targetRect.right + 24;
    } else if (preferred === 'left' && targetRect.left - cardWidth - 24 > 10) {
      top = Math.max(20, targetRect.top + (targetRect.height - cardHeight) / 2);
      left = targetRect.left - cardWidth - 24;
    }

    // Bound inside viewport
    left = Math.max(16, Math.min(vw - cardWidth - 16, left));
    top = Math.max(16, Math.min(vh - cardHeight - 16, top));

    setCardPosition({ top, left });
  }, [targetRect, currentStep]);

  // Keyboard navigation: Escape closes, Enter/Space/Right moves to next step
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

  // Calculate connection line coordinates
  let lineStart = { x: 0, y: 0 };
  let lineEnd = { x: 0, y: 0 };

  if (targetRect) {
    const cardEl = cardRef.current;
    const cardActualWidth = cardEl ? cardEl.offsetWidth : 360;
    const cardActualHeight = cardEl ? cardEl.offsetHeight : 180;

    const cardCenter = {
      x: cardPosition.left + cardActualWidth / 2,
      y: cardPosition.top + cardActualHeight / 2,
    };

    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };

    // Determine nearest points
    if (cardCenter.y > targetCenter.y) {
      // Card is below target
      lineStart = { x: targetCenter.x, y: targetRect.bottom };
      lineEnd = { x: cardCenter.x, y: cardPosition.top };
    } else {
      // Card is above target
      lineStart = { x: targetCenter.x, y: targetRect.top };
      lineEnd = { x: cardCenter.x, y: cardPosition.top + cardActualHeight };
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fadeIn">
      {/* 1. Backdrop Blur with Sharp Cutout */}
      {/* We use an SVG mask to blur and dim EVERYTHING EXCEPT the targetRect hole! */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <mask id="tour-spotlight-mask">
            {/* White covers all (visible) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cutout creates the transparent hole over target element */}
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

        {/* Backdrop Tint */}
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* Backdrop blur layer (blurred area around the cutout) */}
      <div
        className="absolute inset-0 backdrop-blur-sm pointer-events-none"
        style={{
          maskImage: targetRect
            ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${
                targetRect.top + targetRect.height / 2
              }px, transparent ${Math.max(targetRect.width, targetRect.height) / 2}px, black ${
                Math.max(targetRect.width, targetRect.height) / 2 + 10
              }px)`
            : 'none',
          WebkitMaskImage: targetRect
            ? `radial-gradient(circle at ${targetRect.left + targetRect.width / 2}px ${
                targetRect.top + targetRect.height / 2
              }px, transparent ${Math.max(targetRect.width, targetRect.height) / 2}px, black ${
                Math.max(targetRect.width, targetRect.height) / 2 + 10
              }px)`
            : 'none',
        }}
      />

      {/* Click outside to close (transparent backdrop click catcher) */}
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
          className="absolute pointer-events-none z-20 rounded-xl transition-all duration-300 ease-out"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            border: '1.5px solid rgba(255, 255, 255, 0.55)',
            boxShadow: '0 0 20px rgba(255, 255, 255, 0.18), inset 0 0 12px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Pulsing White Target Indicator Marker */}
          <div
            className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] animate-ping opacity-75"
          />
          <div
            className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]"
          />
        </div>
      )}

      {/* 3. Silver-White Connecting Pointer Line */}
      {targetRect && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-30" xmlns="http://www.w3.org/2000/svg">
          {/* Soft outer glow line */}
          <line
            x1={lineStart.x}
            y1={lineStart.y}
            x2={lineEnd.x}
            y2={lineEnd.y}
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Crisp white inner line */}
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
          {/* Target anchor circle */}
          <circle cx={lineStart.x} cy={lineStart.y} r="3" fill="#ffffff" />
        </svg>
      )}

      {/* 4. Floating Glassmorphic Tooltip Card (Stealth HUD Aesthetic) */}
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-40 w-[340px] sm:w-[380px] max-w-[92vw] rounded-2xl border border-white/15 dark:border-white/15 bg-zinc-950/92 dark:bg-[#09090b]/92 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-4 sm:p-5 flex flex-col gap-3 text-zinc-100 transition-all duration-250 ease-out animate-assemble"
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
            <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/15 flex items-start gap-2 text-zinc-300 text-[11px] leading-relaxed mt-1">
              <Lightbulb className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
              <div>
                <span className="font-mono font-semibold text-white">{isRu ? 'Совет: ' : 'Tip: '}</span>
                <span>{isRu ? currentStep.tipRu : currentStep.tipEn}</span>
              </div>
            </div>
          )}
        </div>

        {/* Card Footer: Back / Next Navigation */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
          {/* Back button */}
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

          {/* Next / Got It button (Stealth HUD Contrast White Button) */}
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
