import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react';
import { soundFx } from '../utils/audio';

export type TourSectionId = 'routes' | 'rotation' | 'schedule' | 'summary' | 'settings';

export interface TourStep {
  targetSelector: string;
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  preferredPosition?: 'bottom' | 'top' | 'left' | 'right';
}

export const TOUR_STEPS: Record<TourSectionId, TourStep[]> = {
  schedule: [
    {
      targetSelector: '[data-tour="schedule-days"]',
      titleRu: 'Дни недели и часы активности',
      titleEn: 'Days of the Week & Hours',
      descRu:
        'Здесь отображаются все 7 дней недели. Для каждого дня настраиваются индивидуальные часы фарма, чтобы бот играл по естественному графику реального человека.',
      descEn:
        'Overview of all 7 days of the week. Configure distinct active hours for each day to maintain a human-like schedule.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="schedule-styles"]',
      titleRu: 'Стили поведения бота',
      titleEn: 'Behavior Styles & Presets',
      descRu:
        'Быстрые пресеты фарма: «Обычный» (сбалансированный режим, рекомендуется), «Осторожный» (короткие сессии и частые паузы), «Интенсивный» или «Свой» (ручная настройка таймингов).',
      descEn:
        'Behavior presets: «Casual» (balanced, recommended), «Cautious» (short sessions, frequent pauses), «Intense», or «Custom».',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="schedule-windows"]',
      titleRu: 'Окна времени и ползунок часов',
      titleEn: 'Time Windows & Daily Hours',
      descRu:
        'Задайте интервалы времени (например, утро и вечер), в которые бот имеет право запускаться. Ползунок ниже регулирует суммарное время игры внутри этих окон.',
      descEn:
        'Define active time windows (e.g. morning and evening). The slider controls total farming hours inside these intervals.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="schedule-breaks"]',
      titleRu: 'Перерывы и случайные выходные',
      titleEn: 'Breaks & Random Days Off',
      descRu:
        'Включите длинные перерывы (на еду и отдых) и случайные выходные (1 раз в 10 дней), чтобы бот вёл себя не как машина, а как живой игрок.',
      descEn:
        'Toggle long breaks (for meals/rest) and random days off (once every 10 days) for realistic human player behavior.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="schedule-finetune"]',
      titleRu: 'Тонкая настройка сессий и пауз',
      titleEn: 'Fine-Tuning Sessions & Pauses',
      descRu:
        'Детальное управление длительностью одной сессии (например, 25–60 мин), короткими паузами между кругами и выходом в меню персонажа.',
      descEn:
        'Detailed control over session lengths (e.g. 25–60 mins), short loop pauses, and character menu logout.',
      preferredPosition: 'top',
    },
  ],

  routes: [
    {
      targetSelector: '[data-tour="routes-list"]',
      titleRu: 'Список маршрутов и выбор зоны',
      titleEn: 'Route List & Region',
      descRu:
        'Список доступных маршрутов фарма с указанием типа («Круг» или «Точка-точка»), времени бега и игрового региона. Кликните по маршруту, чтобы сделать его активным.',
      descEn:
        'Available gathering routes showing loop type, duration, and in-game region. Click any route to activate it.',
      preferredPosition: 'right',
    },
    {
      targetSelector: '[data-tour="routes-autoroute"]',
      titleRu: 'Кнопка «Автомаршрут»',
      titleEn: '«Auto Route» Generator',
      descRu:
        'Если готового маршрута нет — нажмите эту кнопку. Бот исследует окружающие ресурсы в радиусе места старта и сам сгенерирует замкнутый круг фарма нужной длины.',
      descEn:
        'No route nearby? Click this button: the bot scans nearby nodes and automatically builds an optimal closed loop.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="routes-record"]',
      titleRu: 'Запись собственного маршрута',
      titleEn: 'Record Custom Route',
      descRu:
        'Нажмите «Записать маршрут» и пробегите нужную траекторию персонажем в игре. Бот в реальном времени запишет все точки пути и сохранит круг.',
      descEn:
        'Click «Record Route» and run your desired path in-game. The bot tracks waypoints in real-time and saves the loop.',
      preferredPosition: 'bottom',
    },
  ],

  rotation: [
    {
      targetSelector: '[data-tour="rotation-sequence"]',
      titleRu: 'Последовательность заклинаний',
      titleEn: 'Spell Sequence Chain',
      descRu:
        'Цепочка боевых способностей. Бот применяет заклинания по порядку слева направо, когда его атакует моб или персонаж вступает в бой.',
      descEn:
        'Spell sequence executed from left to right when attacked by hostile mobs during gathering.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="rotation-keybind"]',
      titleRu: 'Привязка клавиши слота',
      titleEn: 'Action Bar Keybind',
      descRu:
        'Выберите слот и нажмите на кнопку клавиши в нижней панели, чтобы назначить кнопку клавиатуры (поддерживаются 1–9, Q, E, R, F, тильда ` и F1–F12).',
      descEn:
        'Select any slot and click the keybind button in the bottom panel to assign a keyboard key (1–9, letters, backtick `, F1–F12).',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="rotation-timings"]',
      titleRu: 'Время каста и кулдаун',
      titleEn: 'Cast Time & Cooldown',
      descRu:
        'Укажите время каста (секунды произнесения или поддержания) и кулдаун способности, чтобы бот не нажимал заклинание, пока оно перезаряжается.',
      descEn:
        'Set cast duration (seconds) and skill cooldown so the bot never attempts to press an ability before it cools down.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="rotation-water"]',
      titleRu: 'Слот для воды (манареген)',
      titleEn: 'Water Slot (Mana Regen)',
      descRu:
        'Для классов с маной: специальный синий слот. При падении маны ниже заданного % бот выходит из боя, садится и пьёт воду до восстановления.',
      descEn:
        'Special slot for mana users: when mana drops below threshold, the character sits and drinks until fully regenerated.',
      preferredPosition: 'top',
    },
  ],

  summary: [
    {
      targetSelector: '[data-tour="summary-live-cards"]',
      titleRu: 'Живая телеметрия сессии',
      titleEn: 'Live Session Telemetry',
      descRu:
        'Индикаторы реального времени: статус работы бота, время текущей сессии, количество добычи и точный заработок в золоте, серебре и меди.',
      descEn:
        'Real-time metrics: bot running state, current session duration, item count, and market earnings in gold, silver, and copper.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="summary-gold-rate"]',
      titleRu: 'Темп дохода «Золото в час»',
      titleEn: '«Gold per Hour» Metric',
      descRu:
        'Динамический расчёт прибыльности фарма по реальным ценам аукциона вашего сервера. Позволяет сразу оценить эффективность выбранного маршрута.',
      descEn:
        'Live earning speed calculated against realm auction house prices, measuring your route profitability in real-time.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="summary-until-break"]',
      titleRu: 'Таймер «До перерыва»',
      titleEn: '«Until Break» Countdown',
      descRu:
        'Обратный отсчёт до следующей паузы или перекура по расписанию. Вы всегда знаете, когда бот завершит круг и сделает передышку.',
      descEn:
        'Countdown timer to the next scheduled break or rest window, keeping you informed about upcoming bot downtime.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="summary-calendar"]',
      titleRu: 'Месячный календарь и история',
      titleEn: 'Monthly History & Calendar',
      descRu:
        'Календарь сохраняет результаты каждого дня: часы фарма, количество заходов и общую сумму заработанного золота.',
      descEn:
        'Historical calendar recording daily run hours, session passes, and total wealth accumulated across the month.',
      preferredPosition: 'right',
    },
  ],

  settings: [
    {
      targetSelector: '[data-tour="settings-keybinds"]',
      titleRu: 'Глобальные горячие клавиши',
      titleEn: 'Global Game Keybindings',
      descRu:
        '«Предыдущая цель» и «Взаимодействие с целью» должны быть настроены так же, как в клиенте игры. Клавиша F5 запускает и останавливает бота.',
      descEn:
        '«Previous Target» and «Interact With Target» must match your in-game bindings. F5 starts and stops the bot globally.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-pause"]',
      titleRu: 'Клавиша «Пауза»',
      titleEn: 'Emergency Pause Key',
      descRu:
        'Нажатие клавиши паузы мгновенно отпускает управление и замирает, позволяя вмешаться вручную. Повторное нажатие возобновляет работу.',
      descEn:
        'Instant pause hotkey: releases controls and holds the bot, giving you full control. Press again to resume seamlessly.',
      preferredPosition: 'bottom',
    },
    {
      targetSelector: '[data-tour="settings-radar"]',
      titleRu: 'Поиск трав и минералов',
      titleEn: 'Herb & Mineral Tracking',
      descRu:
        'Аддон бота сам привязывает поиск к клавишам F9 и F10 и циклически переключает трекинг, чтобы видеть оба типа ресурсов на миникарте.',
      descEn:
        'The addon binds tracking to F9/F10 and cycles modes to display both herbs and mineral veins on the minimap.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="settings-autoroute"]',
      titleRu: 'Длина автомаршрута',
      titleEn: 'Auto Route Duration',
      descRu:
        'Ползунок задаёт желаемую длину круга (от 30 до 120 минут) при автоматическом построении маршрута вокруг персонажа.',
      descEn:
        'Slider controls loop duration (30 to 120 minutes) when building an auto-route around your current character location.',
      preferredPosition: 'top',
    },
    {
      targetSelector: '[data-tour="settings-auction"]',
      titleRu: 'Выбор аукционного дома',
      titleEn: 'Auction House Selection',
      descRu:
        'Выберите аукцион вашего сервера или оставьте «Авто», чтобы бот точно рассчитывал стоимость собранного лута по рыночным ценам.',
      descEn:
        'Select your realm auction house or leave on «Auto» so loot values are calculated based on live market prices.',
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

    const el = document.querySelector(currentStep.targetSelector);
    if (!el) {
      // Fallback: try finding any element with the section or show centered
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
