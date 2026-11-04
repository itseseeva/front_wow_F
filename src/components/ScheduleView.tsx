import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  LogOut,
  Sliders,
  Sun,
  Moon,
  Coffee,
  Swords,
  Copy,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Info,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  VenetianMask,
  X,
} from 'lucide-react';
import {
  ScheduleSettings,
  ScheduleStatus,
  DaySchedule,
  ScheduleStyle,
  ScheduleStyleId,
  DailySpread,
  WeekdayKey,
} from '../types';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { SpecularTimePicker } from './SpecularTimePicker';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  DEFAULT_SCHEDULE_STYLES,
  WEEKDAY_KEYS,
  getGameDayMinutes,
  mockGetScheduleStyles,
} from '../data/mockSchedule';
import { soundFx } from '../utils/audio';
import { getPywebviewApi } from '../utils/pywebviewBridge';

interface ScheduleViewProps {
  scheduleSettings: ScheduleSettings;
  onScheduleSettingsChange: (settings: ScheduleSettings) => void;
  scheduleStatus: ScheduleStatus | null;
  scheduleError: string | null;
  language: 'ru' | 'en';
  onToast?: (msg: string) => void;
}

const DAY_LABELS: Record<WeekdayKey, { shortRu: string; shortEn: string; fullRu: string; fullEn: string }> = {
  mon: { shortRu: 'Пн', shortEn: 'Mon', fullRu: 'Понедельник', fullEn: 'Monday' },
  tue: { shortRu: 'Вт', shortEn: 'Tue', fullRu: 'Вторник', fullEn: 'Tuesday' },
  wed: { shortRu: 'Ср', shortEn: 'Wed', fullRu: 'Среда', fullEn: 'Wednesday' },
  thu: { shortRu: 'Чт', shortEn: 'Thu', fullRu: 'Четверг', fullEn: 'Thursday' },
  fri: { shortRu: 'Пт', shortEn: 'Fri', fullRu: 'Пятница', fullEn: 'Friday' },
  sat: { shortRu: 'Сб', shortEn: 'Sat', fullRu: 'Суббота', fullEn: 'Saturday' },
  sun: { shortRu: 'Вс', shortEn: 'Sun', fullRu: 'Воскресенье', fullEn: 'Sunday' },
};

function getTodayWeekdayKey(): WeekdayKey {
  const day = new Date().getDay(); // 0 is Sun, 1 is Mon...
  const idx = day === 0 ? 6 : day - 1;
  return WEEKDAY_KEYS[idx] || 'mon';
}

function formatMinutesToHours(min: number): string {
  const h = (min / 60).toFixed(1);
  return h.endsWith('.0') ? `${min / 60}` : h;
}

interface HelpCardInfo {
  titleRu: string;
  titleEn: string;
  descRu: string;
  descEn: string;
  icon: React.ComponentType<{ className?: string }>;
}

const HELP_DATA: Record<string, HelpCardInfo> = {
  windows: {
    titleRu: 'Окна рабочих часов',
    titleEn: 'Playtime Windows',
    descRu: 'Задают часы суток, когда боту разрешено заходить в игру. Начало и конец окон каждый день слегка сдвигаются на случайные минуты, чтобы график не был шаблонным.',
    descEn: 'Defines daily hours when the bot can play. Start and end times shift randomly each day so you do not look like a scheduled script.',
    icon: Sun,
  },
  style: {
    titleRu: 'Стиль поведения',
    titleEn: 'Play Style',
    descRu: 'Готовые шаблоны темпа: от осторожного до интенсивного. Определяют, сколько времени бот проводит на споте и как часто делает перерывы.',
    descEn: 'Pacing presets from cautious to intensive. Controls farming pace and break habits.',
    icon: Sparkles,
  },
  target: {
    titleRu: 'Норма игры в день',
    titleEn: 'Daily Target',
    descRu: 'Сколько суммарно часов бот отработает за день. Процент разброса каждый день случайно меняет время (сегодня 5ч, завтра 6.5ч), чтобы сбивать антифрод-детекторы.',
    descEn: 'Target playtime per day. The variance percentage randomizes daily hours to avoid mechanical schedules.',
    icon: Clock,
  },
  dayOff: {
    titleRu: 'Случайный выходной (отгул)',
    titleEn: 'Random Day Off',
    descRu: 'Бот иногда пропускает целый рабочий день, как живой человек с внезапными делами. Постоянная игра каждый день без пауз — главный повод для бана, поэтому отгулы спасают аккаунт.',
    descEn: 'The bot skips a scheduled day like a real player with real life. Daily 100% attendance raises flags; days off protect your account.',
    icon: Shuffle,
  },
  session: {
    titleRu: 'Сессия фарма',
    titleEn: 'Farming Session',
    descRu: 'Сколько минут длится один непрерывный фарм до короткой паузы, и через сколько таких сессий наступает большой перерыв.',
    descEn: 'Continuous farm duration before a quick rest, and how many runs occur before a major break.',
    icon: Swords,
  },
  breaks: {
    titleRu: 'Перерывы и отдых',
    titleEn: 'Breaks & Logout',
    descRu: 'Короткие паузы на споте и длительный отдых. Обязательно оставляйте выход в меню, чтобы персонаж не стоял часами на споте и не привлекал внимание других игроков.',
    descEn: 'Short pauses on spot and long breaks. Keep menu logout enabled so your character never idles suspiciously.',
    icon: Coffee,
  },
};

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleSettings,
  onScheduleSettingsChange,
  scheduleStatus,
  scheduleError,
  language,
}) => {
  const isRu = language === 'ru';
  const todayKey = useMemo(() => getTodayWeekdayKey(), []);

  // Selected Day for editing (defaults to today)
  const [selectedDayKey, setSelectedDayKey] = useState<WeekdayKey>(todayKey);

  // Fine-tuning collapsible accordion state (collapsed by default to keep view clean)
  const [isFineTuneOpen, setIsFineTuneOpen] = useState<boolean>(false);

  // Copy modal / popover state
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [copyTargetDays, setCopyTargetDays] = useState<Record<WeekdayKey, boolean>>({
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false,
    sun: false,
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Available Styles from Backend Bridge
  const [styles, setStyles] = useState<ScheduleStyle[]>(DEFAULT_SCHEDULE_STYLES);

  // Active Help card for frosted glass overlay
  const [activeHelpCard, setActiveHelpCard] = useState<string | null>(null);

  // Render frosted glass help overlay right on top of the container
  const renderGlassOverlay = (cardId: string) => {
    if (activeHelpCard !== cardId) return null;
    const item = HELP_DATA[cardId];
    if (!item) return null;
    const IconComp = item.icon;
    const roundedCls = cardId === 'session' || cardId === 'breaks' || cardId === 'dayOff' ? 'rounded-xl' : 'rounded-2xl';

    return (
      <div
        className={`absolute inset-0 z-30 ${roundedCls} bg-black/95 backdrop-blur-md p-4 sm:p-5 border border-white/20 flex flex-col justify-between text-left animate-fadeIn shadow-2xl`}
        onMouseLeave={() => setActiveHelpCard(null)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0">
              <IconComp className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-mono font-bold text-white tracking-wide">
                {isRu ? item.titleRu : item.titleEn}
              </h4>
              <p className="text-[10px] text-zinc-400 font-mono">
                {isRu ? 'Подсказка по настройке' : 'Setting explanation'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveHelpCard(null)}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-zinc-400 hover:text-white flex items-center justify-center text-xs font-mono transition-all cursor-pointer shrink-0"
            title={isRu ? 'Закрыть' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="my-auto py-3 font-mono text-xs sm:text-sm text-zinc-200 leading-relaxed">
          <p>{isRu ? item.descRu : item.descEn}</p>
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-3 border-t border-white/10">
          <span className="text-zinc-500 text-[10px]">
            {isRu ? 'Уведите мышь или нажмите «Понятно»' : 'Move cursor away or click Got it'}
          </span>
          <button
            type="button"
            onClick={() => setActiveHelpCard(null)}
            className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 font-bold text-xs font-mono cursor-pointer transition-all"
          >
            {isRu ? 'Понятно' : 'Got it'}
          </button>
        </div>
      </div>
    );
  };

  // Exclamation badge button to trigger the overlay
  const renderHelpButton = (cardId: string) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setActiveHelpCard(activeHelpCard === cardId ? null : cardId);
      }}
      onMouseEnter={() => setActiveHelpCard(cardId)}
      title={isRu ? 'Справка: как это работает' : 'Help: how it works'}
      className="w-5 h-5 rounded-full border border-white/25 bg-black hover:bg-white hover:text-black hover:border-white text-zinc-400 flex items-center justify-center text-[11px] font-mono font-bold transition-all cursor-pointer shadow-sm shrink-0 ml-1.5"
    >
      !
    </button>
  );

  // Fetch styles on mount
  useEffect(() => {
    let cancelled = false;
    const loadStyles = async () => {
      try {
        const api = await getPywebviewApi();
        if (api?.get_schedule_styles) {
          const res = await api.get_schedule_styles();
          if (!cancelled && res && res.ok && Array.isArray(res.styles) && res.styles.length > 0) {
            setStyles(res.styles);
            return;
          }
        }
        const mockRes = await mockGetScheduleStyles();
        if (!cancelled && mockRes.ok) {
          setStyles(mockRes.styles);
        }
      } catch (err) {
        console.warn('get_schedule_styles error:', err);
      }
    };
    loadStyles();
    return () => {
      cancelled = true;
    };
  }, []);

  // Current day schedule object
  const currentDay = scheduleSettings.days[selectedDayKey] || scheduleSettings.days.mon;

  // Day Updater helper
  const updateCurrentDay = (patch: Partial<DaySchedule>) => {
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: {
        ...scheduleSettings.days,
        [selectedDayKey]: {
          ...currentDay,
          ...patch,
        },
      },
    });
  };

  // Toggle single day enabled
  const toggleDayEnabled = (dayKey: WeekdayKey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundFx.playClick();
    const day = scheduleSettings.days[dayKey];
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: {
        ...scheduleSettings.days,
        [dayKey]: {
          ...day,
          enabled: !day.enabled,
        },
      },
    });
  };

  // Add time window to current day
  const handleAddWindow = () => {
    if (currentDay.windows.length >= 4) return;
    soundFx.playClick();
    const windows = [...currentDay.windows];
    const lastWindow = windows[windows.length - 1];

    let newStart = '14:00';
    let newEnd = '18:00';

    if (lastWindow) {
      const lastEndMin = getGameDayMinutes(lastWindow.end, true);
      if (lastEndMin <= 780) {
        newStart = '14:00';
        newEnd = '18:00';
      } else if (lastEndMin <= 1080) {
        newStart = '19:00';
        newEnd = '23:00';
      } else {
        newStart = '09:00';
        newEnd = '12:00';
      }
    }

    windows.push({ start: newStart, end: newEnd });
    updateCurrentDay({ windows });
  };

  // Remove time window
  const handleRemoveWindow = (index: number) => {
    if (currentDay.windows.length <= 1) return;
    soundFx.playClick();
    const windows = currentDay.windows.filter((_, idx) => idx !== index);
    updateCurrentDay({ windows });
  };

  // Update window start or end
  const handleUpdateWindow = (index: number, field: 'start' | 'end', val: string) => {
    const windows = currentDay.windows.map((w, idx) => {
      if (idx !== index) return w;
      return { ...w, [field]: val };
    });
    updateCurrentDay({ windows });
  };

  // Apply Style
  const handleSelectStyle = (styleId: ScheduleStyleId) => {
    soundFx.playClick();
    if (styleId === 'custom') {
      updateCurrentDay({ style: 'custom' });
      return;
    }
    const stylePreset = styles.find((s) => s.id === styleId);
    if (!stylePreset) return;

    updateCurrentDay({
      style: styleId,
      sessionMinutes: [...stylePreset.sessionMinutes],
      shortBreakMinutes: [...stylePreset.shortBreakMinutes],
      longBreakMinutes: [...stylePreset.longBreakMinutes],
      longBreakEvery: [...stylePreset.longBreakEvery],
    });
  };

  // Handle fine-tune changes (automatically sets style = 'custom')
  const handleFineTuneChange = <K extends keyof DaySchedule>(key: K, val: DaySchedule[K]) => {
    const patch: Partial<DaySchedule> = {
      [key]: val,
      style: 'custom',
    };

    // Constraint: shortBreakMinutes[1] <= longBreakMinutes[0]
    if (key === 'shortBreakMinutes') {
      const sb = val as [number, number];
      if (sb[1] > currentDay.longBreakMinutes[0]) {
        patch.longBreakMinutes = [sb[1], Math.max(sb[1], currentDay.longBreakMinutes[1])];
      }
    } else if (key === 'longBreakMinutes') {
      const lb = val as [number, number];
      if (lb[0] < currentDay.shortBreakMinutes[1]) {
        patch.shortBreakMinutes = [Math.min(currentDay.shortBreakMinutes[0], lb[0]), lb[0]];
      }
    }

    updateCurrentDay(patch);
  };

  // Copy Day Settings to other days
  const handleOpenCopyModal = () => {
    soundFx.playClick();
    const initialTargets: Record<WeekdayKey, boolean> = {
      mon: false,
      tue: false,
      wed: false,
      thu: false,
      fri: false,
      sat: false,
      sun: false,
    };
    // Default select all other days
    for (const k of WEEKDAY_KEYS) {
      if (k !== selectedDayKey) initialTargets[k] = true;
    }
    setCopyTargetDays(initialTargets);
    setIsCopyModalOpen(true);
  };

  const handleApplyCopy = () => {
    soundFx.playClick();
    const newDays = { ...scheduleSettings.days };
    let count = 0;
    for (const k of WEEKDAY_KEYS) {
      if (k !== selectedDayKey && copyTargetDays[k]) {
        newDays[k] = JSON.parse(JSON.stringify(currentDay));
        count++;
      }
    }
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: newDays,
    });
    setIsCopyModalOpen(false);
    setCopyFeedback(
      isRu
        ? `Настройки скопированы на ${count} ${count === 1 ? 'день' : count < 5 ? 'дня' : 'дней'}`
        : `Settings copied to ${count} days`
    );
    setTimeout(() => setCopyFeedback(null), 3000);
  };

  // Reset all to default
  const handleResetDefaults = () => {
    soundFx.playClick();
    onScheduleSettingsChange({ ...DEFAULT_SCHEDULE_SETTINGS });
  };

  // Display timezone string
  const timezoneStr = scheduleStatus?.timezone || 'UTC+03:00';

  return (
    <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-16 flex flex-col justify-start overflow-y-auto animate-assemble text-zinc-900 dark:text-zinc-100 font-sans select-none">
      <div className="w-full max-w-5xl 2xl:max-w-7xl mx-auto flex flex-col gap-5">
        {/* =========================================================================
            HEADER
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-black/10 dark:border-white/[0.08] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              <h1 className="text-base sm:text-lg font-mono font-semibold text-zinc-950 dark:text-white tracking-wide flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                <span>{isRu ? 'Расписание фарма' : 'Farm Schedule'}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-mono">
              <span>{isRu ? 'Настройка недельного графика по дням' : 'Weekly farm schedule by days'}</span>
              <span>•</span>
              <span className="text-zinc-400 dark:text-zinc-500">
                {isRu ? `время компьютера · ${timezoneStr}` : `local time · ${timezoneStr}`}
              </span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            WEEK SELECTOR STRIP (All 7 Days)
            ========================================================================= */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
              {isRu ? 'Дни недели' : 'Days of the Week'}
            </span>

            {/* Copy Day Settings Button */}
            <SpecularButton
              onClick={handleOpenCopyModal}
              className="px-2.5 py-1 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-500" />
              <span>{isRu ? 'Скопировать день' : 'Copy day'}</span>
            </SpecularButton>
          </div>

          {/* 7 Days Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {WEEKDAY_KEYS.map((dayKey) => {
              const day = scheduleSettings.days[dayKey];
              const isSelected = selectedDayKey === dayKey;
              const isToday = todayKey === dayKey;
              const isEnabled = day?.enabled ?? true;

              return (
                <SpecularCard
                  key={dayKey}
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedDayKey(dayKey);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between gap-2 text-left ${
                    isSelected
                      ? 'border-zinc-950 dark:border-white bg-zinc-950/10 dark:bg-white/15 ring-2 ring-zinc-950/70 dark:ring-white/70 shadow-[0_0_16px_rgba(0,0,0,0.18)] dark:shadow-[0_0_20px_rgba(255,255,255,0.35)] animate-pulse'
                      : 'border-black/10 dark:border-white/[0.08] hover:border-black/25 dark:hover:border-white/20 bg-white/30 dark:bg-zinc-900/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] animate-ping" />
                      )}
                      <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white">
                        {isRu ? DAY_LABELS[dayKey].shortRu : DAY_LABELS[dayKey].shortEn}
                      </span>
                      {isToday && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-mono font-medium">
                          {isRu ? 'сегодня' : 'today'}
                        </span>
                      )}
                    </div>

                    {/* Day Power Toggle Switch */}
                    <button
                      type="button"
                      onClick={(e) => toggleDayEnabled(dayKey, e)}
                      title={isEnabled ? (isRu ? 'Сделать выходным' : 'Disable day') : (isRu ? 'Включить день' : 'Enable day')}
                      className={`w-7 h-4 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        isEnabled ? 'bg-zinc-950 dark:bg-white' : 'bg-black/15 dark:bg-white/15'
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full bg-white dark:bg-zinc-950 transform transition-transform ${
                          isEnabled ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Day Info Status */}
                  <div className="flex flex-col gap-0.5 text-[11px] font-mono">
                    {isEnabled ? (
                      <>
                        <span className="text-zinc-950 dark:text-zinc-200 font-semibold truncate">
                          {day.windows.length === 1
                            ? `${day.windows[0].start}–${day.windows[0].end}`
                            : `${day.windows.length} ${isRu ? 'окна' : 'windows'}`}
                        </span>
                        <div className="flex items-center justify-between text-zinc-500 text-[10px]">
                          <span>~{day.dailyHours} ч</span>
                          <span className="capitalize">{day.style === 'normal' ? (isRu ? 'Обычный' : 'Normal') : day.style}</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600 font-mono italic">
                        {isRu ? 'Выходной' : 'Day off'}
                      </span>
                    )}
                  </div>
                </SpecularCard>
              );
            })}
          </div>
        </div>

        {/* Copy Modal Dialog */}
        {isCopyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl border border-black/15 dark:border-white/15 bg-white dark:bg-zinc-900 p-5 shadow-2xl flex flex-col gap-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                <span className="font-semibold text-sm text-zinc-950 dark:text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-zinc-500" />
                  <span>
                    {isRu
                      ? `Скопировать настройки: ${DAY_LABELS[selectedDayKey].fullRu}`
                      : `Copy settings: ${DAY_LABELS[selectedDayKey].fullEn}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-zinc-500 text-[11px]">
                {isRu
                  ? 'Выберите дни, в которые нужно скопировать окна часов, стиль и нормы текущего дня:'
                  : 'Select target days to duplicate current day hours and settings:'}
              </p>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<WeekdayKey, boolean> = {
                      mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
                    };
                    all[selectedDayKey] = false;
                    setCopyTargetDays(all);
                  }}
                  className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 cursor-pointer"
                >
                  {isRu ? 'Вся неделя' : 'All week'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetDays({
                      mon: selectedDayKey !== 'mon',
                      tue: selectedDayKey !== 'tue',
                      wed: selectedDayKey !== 'wed',
                      thu: selectedDayKey !== 'thu',
                      fri: selectedDayKey !== 'fri',
                      sat: false,
                      sun: false,
                    });
                  }}
                  className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 cursor-pointer"
                >
                  {isRu ? 'Будни (Пн–Пт)' : 'Weekdays'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetDays({
                      mon: false,
                      tue: false,
                      wed: false,
                      thu: false,
                      fri: false,
                      sat: selectedDayKey !== 'sat',
                      sun: selectedDayKey !== 'sun',
                    });
                  }}
                  className="px-2 py-1 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 cursor-pointer"
                >
                  {isRu ? 'Выходные (Сб–Вс)' : 'Weekends'}
                </button>
              </div>

              {/* Day Checkboxes */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                {WEEKDAY_KEYS.map((k) => {
                  if (k === selectedDayKey) return null;
                  const isChecked = copyTargetDays[k];
                  return (
                    <label
                      key={k}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setCopyTargetDays((prev) => ({
                            ...prev,
                            [k]: e.target.checked,
                          }))
                        }
                        className="accent-zinc-950 dark:accent-white"
                      />
                      <span>{isRu ? DAY_LABELS[k].fullRu : DAY_LABELS[k].fullEn}</span>
                    </label>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10 dark:border-white/10">
                <SpecularButton
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </SpecularButton>
                <SpecularButton
                  onClick={handleApplyCopy}
                  className="px-4 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold shadow-sm"
                >
                  {isRu ? 'Применить' : 'Apply'}
                </SpecularButton>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SELECTED DAY CONFIGURATION PANEL
            ========================================================================= */}
        <div className="flex flex-col gap-4">
          {/* Day Header & State Toggle */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-mono font-bold text-zinc-950 dark:text-white">
                {isRu ? DAY_LABELS[selectedDayKey].fullRu : DAY_LABELS[selectedDayKey].fullEn}
              </h2>
              {todayKey === selectedDayKey && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-mono">
                  {isRu ? 'Сегодня' : 'Today'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleDayEnabled(selectedDayKey)}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-colors ${
                currentDay.enabled
                  ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white'
                  : 'border-black/15 dark:border-white/15 bg-transparent text-zinc-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  currentDay.enabled ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-400'
                }`}
              />
              <span>{currentDay.enabled ? (isRu ? 'День активен' : 'Day enabled') : (isRu ? 'Выходной день' : 'Day off')}</span>
            </button>
          </div>

          {!currentDay.enabled ? (
            /* Day Disabled Notice */
            <SpecularCard className="p-8 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent text-center flex flex-col items-center justify-center gap-3">
              <Moon className="w-8 h-8 text-zinc-400" strokeWidth={1.5} />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm font-semibold text-zinc-950 dark:text-white">
                  {isRu ? 'В этот день бот будет отдыхать' : 'The bot will rest on this day'}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {isRu
                    ? 'День выключен в расписании. Сессии фарма запускаться не будут.'
                    : 'This day is disabled. No farming sessions will be scheduled.'}
                </span>
              </div>
              <SpecularButton
                onClick={() => toggleDayEnabled(selectedDayKey)}
                className="mt-2 px-4 py-1.5 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 font-mono text-xs font-semibold"
              >
                {isRu ? 'Включить этот день' : 'Enable this day'}
              </SpecularButton>
            </SpecularCard>
          ) : (
            <>
              {/* 1. Time Windows Card (1–4 windows, crossing midnight up to 05:00) */}
              <SpecularCard className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs sm:text-sm font-mono font-semibold text-white flex items-center gap-2">
                      <Sun className="w-4 h-4 text-zinc-400" />
                      <span>{isRu ? 'Окна рабочих часов' : 'Playtime Windows'}</span>
                      <span className="text-[11px] font-normal text-zinc-400 font-mono">
                        ({currentDay.windows.length} {isRu ? 'из 4' : 'of 4'})
                      </span>
                      {renderHelpButton('windows')}
                    </h3>
                    <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                      {isRu
                        ? 'Начало и конец окон каждый день слегка сдвигаются случайным образом для естественности.'
                        : 'Windows float slightly each day for natural human-like variation.'}
                    </p>
                  </div>

                  {currentDay.windows.length < 4 && (
                    <SpecularButton
                      onClick={handleAddWindow}
                      className="px-3.5 py-1.5 rounded-xl bg-black text-white hover:bg-zinc-900 border border-white/20 hover:border-white/40 font-mono text-xs font-bold flex items-center gap-2 cursor-pointer self-start sm:self-auto shadow-sm active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
                      <span>{isRu ? 'Добавить окно' : 'Add window'}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 font-bold border border-white/10">
                        {currentDay.windows.length}/4
                      </span>
                    </SpecularButton>
                  )}
                </div>

                {/* Multiple Windows Summary strip if > 1 */}
                {currentDay.windows.length > 1 && (
                  <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-black/30 border border-white/10 text-xs font-mono">
                    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
                      {isRu ? 'Всего окон:' : 'All windows:'}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {currentDay.windows.map((w, i) => {
                        const sMin = getGameDayMinutes(w.start, false);
                        const eMin = getGameDayMinutes(w.end, true);
                        const dur = eMin > sMin ? ((eMin - sMin) / 60).toFixed(1) : '—';
                        return (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-zinc-200 text-xs flex items-center gap-1.5 font-bold"
                          >
                            <span className="text-zinc-400">#{i + 1}</span>
                            <span>{w.start}–{w.end}</span>
                            <span className="text-zinc-400 font-normal">({dur}ч)</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* List of Time Windows */}
                <div className="flex flex-col gap-3">
                  {currentDay.windows.map((win, idx) => {
                    const sMin = getGameDayMinutes(win.start, false);
                    const eMin = getGameDayMinutes(win.end, true);
                    const durHours = eMin > sMin ? ((eMin - sMin) / 60).toFixed(1) : '—';

                    return (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-3.5 p-3.5 sm:p-4 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 shadow-sm transition-all"
                      >
                        <div className="flex flex-wrap items-center gap-3.5">
                          <span className="px-2.5 py-1 rounded-lg bg-black text-white border border-white/20 flex items-center justify-center font-mono text-xs font-bold shadow-sm">
                            #{idx + 1}
                          </span>

                          <div className="flex items-center gap-2.5 font-mono text-xs">
                            <span className="text-zinc-400 font-medium">{isRu ? 'с' : 'from'}</span>
                            <SpecularTimePicker
                              value={win.start}
                              onChange={(val) => handleUpdateWindow(idx, 'start', val)}
                              ariaLabel={isRu ? `Окно #${idx + 1}: Начало` : `Window #${idx + 1} start`}
                            />
                            <span className="text-zinc-400 font-medium">{isRu ? 'до' : 'to'}</span>
                            <SpecularTimePicker
                              value={win.end}
                              onChange={(val) => handleUpdateWindow(idx, 'end', val)}
                              ariaLabel={isRu ? `Окно #${idx + 1}: Конец` : `Window #${idx + 1} end`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-white px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 shadow-sm">
                            <Clock className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{durHours} {isRu ? 'ч длительность' : 'hrs duration'}</span>
                          </span>

                          {currentDay.windows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWindow(idx)}
                              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 transition-all cursor-pointer"
                              title={isRu ? 'Удалить это окно' : 'Remove this window'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {renderGlassOverlay('windows')}
              </SpecularCard>

              {/* 2. Style & Daily Hours Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Style Selector */}
                <SpecularCard className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs sm:text-sm font-mono font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-zinc-400" />
                      <span>{isRu ? 'Стиль поведения' : 'Play Style'}</span>
                      {renderHelpButton('style')}
                    </span>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-black text-white border border-white/15 uppercase">
                      {currentDay.style}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {styles.map((s) => {
                      const isSelected = currentDay.style === s.id;
                      const isRecommended = s.id === 'normal';

                      return (
                        <SpecularCard
                          key={s.id}
                          onClick={() => handleSelectStyle(s.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-white bg-black ring-1 ring-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                              : 'border-white/10 hover:border-white/25 bg-black text-zinc-400 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-1">
                            <span className="font-mono text-xs font-bold text-white">
                              {s.title}
                            </span>
                            {isRecommended && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-black font-mono font-bold">
                                {isRu ? 'рекомендуем' : 'recommended'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 font-mono line-clamp-2">
                            {s.description}
                          </p>
                        </SpecularCard>
                      );
                    })}

                    {/* Custom Style Card */}
                    <SpecularCard
                      onClick={() => handleSelectStyle('custom')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        currentDay.style === 'custom'
                          ? 'border-white bg-black ring-1 ring-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                          : 'border-white/10 hover:border-white/25 bg-black text-zinc-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-1">
                        <span className="font-mono text-xs font-bold text-white">
                          {isRu ? 'Свой' : 'Custom'}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 font-mono line-clamp-2">
                        {isRu ? 'Индивидуальные настройки сессий и перерывов' : 'Custom duration & frequency parameters'}
                      </p>
                    </SpecularCard>
                  </div>
                  {renderGlassOverlay('style')}
                </SpecularCard>

                {/* Daily Hours Budget Card */}
                <SpecularCard className="relative overflow-hidden p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col justify-between gap-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-mono font-semibold text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-zinc-400" />
                        <span>{isRu ? `Норма в день: около ${currentDay.dailyHours} ч` : `Daily Target: ~${currentDay.dailyHours} hrs`}</span>
                        {renderHelpButton('target')}
                      </span>
                      <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-black text-white border border-white/15">
                        {isRu ? `около ${currentDay.dailyHours} ч` : `~${currentDay.dailyHours} hrs`}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                      {isRu ? 'Сколько суммарно часов бот будет играть сегодня' : 'Target total playing time budget for this day'}
                    </p>
                  </div>

                  {/* Clean Slider for dailyHours */}
                  <div className="flex flex-col gap-2 font-mono text-xs pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-400 font-medium shrink-0">0.5 ч</span>

                      <div className="relative flex-1 flex items-center h-6">
                        {/* Sleek single background track */}
                        <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-800">
                          {/* Active fill up to current value */}
                          <div
                            className="h-full bg-white rounded-full pointer-events-none"
                            style={{
                              width: `${Math.max(0, Math.min(100, ((currentDay.dailyHours - 0.5) / 11.5) * 100))}%`,
                            }}
                          />
                        </div>

                        {/* Interactive Range Slider */}
                        <input
                          type="range"
                          min={0.5}
                          max={12}
                          step={0.5}
                          value={currentDay.dailyHours}
                          onChange={(e) =>
                            updateCurrentDay({
                              dailyHours: Number(e.target.value),
                            })
                          }
                          className="relative w-full accent-white cursor-pointer z-10 h-6 opacity-0"
                        />

                        {/* Glowing white thumb positioned at value */}
                        <div
                          className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] border border-zinc-200 pointer-events-none -ml-2 transition-all duration-75"
                          style={{
                            left: `${Math.max(0, Math.min(100, ((currentDay.dailyHours - 0.5) / 11.5) * 100))}%`,
                          }}
                        />
                      </div>

                      <span className="text-[11px] text-zinc-400 font-medium shrink-0">12 ч</span>
                    </div>

                    {/* Clean range info computed synchronously */}
                    {(() => {
                      const spreadPct = (currentDay.dailySpread || 'mid') === 'low' ? 0.15 : (currentDay.dailySpread || 'mid') === 'high' ? 0.40 : 0.25;
                      const minH = Math.max(0.5, Math.round(currentDay.dailyHours * (1 - spreadPct) * 10) / 10);
                      const maxH = Math.min(12, Math.round(currentDay.dailyHours * (1 + spreadPct) * 10) / 10);

                      return (
                        <>
                          <div className="flex items-center justify-between text-[11px] text-zinc-400 px-0.5">
                            <span>{isRu ? 'Ожидаемое время с разбросом:' : 'Expected time with variation:'}</span>
                            <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded border border-white/10">
                              {minH} – {maxH} {isRu ? 'ч' : 'hrs'}
                            </span>
                          </div>

                          {/* Daily Spread Selector: ±15% / ±25% / ±40% */}
                          <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                              <span className="text-xs font-mono font-medium text-zinc-300">
                                {isRu ? 'Разброс времени (античит):' : 'Daily variation (stealth):'}
                              </span>
                              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                                {[
                                  { id: 'low' as DailySpread, pct: '±15%' },
                                  { id: 'mid' as DailySpread, pct: '±25%' },
                                  { id: 'high' as DailySpread, pct: '±40%' },
                                ].map((sp) => {
                                  const isSelected = (currentDay.dailySpread || 'mid') === sp.id;
                                  return (
                                    <button
                                      key={sp.id}
                                      type="button"
                                      onClick={() => {
                                        soundFx.playClick();
                                        updateCurrentDay({ dailySpread: sp.id });
                                      }}
                                      className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer font-bold ${
                                        isSelected
                                          ? 'border-white bg-black text-white shadow-sm ring-1 ring-white/20'
                                          : 'border-white/10 hover:border-white/25 bg-black/40 text-zinc-400 hover:text-white'
                                      }`}
                                    >
                                      {sp.pct}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Explanatory text */}
                            <div className="flex flex-col gap-0.5 text-[11px] font-mono text-zinc-400 pt-0.5">
                              <span className="text-white font-medium">
                                {isRu
                                  ? `Бот играет от ${minH} до ${maxH} ч (случайное отклонение ${
                                      currentDay.dailySpread === 'low' ? '±15%' : currentDay.dailySpread === 'high' ? '±40%' : '±25%'
                                    } от нормы).`
                                  : `Bot plays from ${minH} to ${maxH} hrs (${
                                      currentDay.dailySpread === 'low' ? '±15%' : currentDay.dailySpread === 'high' ? '±40%' : '±25%'
                                    } variation from base).`}
                              </span>
                              <span className="text-zinc-500 text-[10px]">
                                {isRu
                                  ? 'Каждый день бот играет разное время, имитируя живого человека.'
                                  : 'Daily playtime fluctuates randomly each day to prevent bot detection.'}
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  {renderGlassOverlay('target')}
                </SpecularCard>
              </div>

              {/* 3. Fine-Tuning Collapsible Section (Accordion) */}
              <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setIsFineTuneOpen(!isFineTuneOpen)}
                  className="w-full flex items-center justify-between text-left cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-zinc-400" />
                    <div>
                      <span className="text-xs sm:text-sm font-mono font-semibold text-white">
                        {isRu ? 'Тонкая настройка сессий и перерывов' : 'Fine-Tuning Sessions & Breaks'}
                      </span>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {isRu
                          ? `Сессия ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}м · Пауза ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}м · Длинный ${currentDay.longBreakMinutes[0]}–${currentDay.longBreakMinutes[1]}м`
                          : `Session ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}m · Short ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}m · Long ${currentDay.longBreakMinutes[0]}–${currentDay.longBreakMinutes[1]}m`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="text-[10px] font-mono">
                      {isFineTuneOpen ? (isRu ? 'Скрыть' : 'Collapse') : (isRu ? 'Настроить' : 'Expand')}
                    </span>
                    {isFineTuneOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isFineTuneOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10 animate-fadeIn">
                    {/* Random Day Off Selection Containers (No slider/bar) */}
                    <div className="relative overflow-hidden md:col-span-2 flex flex-col gap-3.5 p-3.5 sm:p-4 rounded-xl bg-black border border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-black border border-white/20 flex items-center justify-center shrink-0">
                            <Shuffle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-white">
                                {isRu ? 'Случайный выходной (отгул)' : 'Random Day Off Chance'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white text-black font-mono">
                                {scheduleSettings.offDayPercent}%
                              </span>
                              {renderHelpButton('dayOff')}
                            </div>
                            <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                              {isRu
                                ? 'Защита от бана: бот иногда берет внеплановый отгул в активный день, как реальный человек.'
                                : 'Human imitation: bot randomly takes a day off to break robotic farm patterns.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 4 Selectable Option Containers with unique icons */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                        {[
                          {
                            val: 0,
                            percent: '0%',
                            titleRu: 'Отключено',
                            titleEn: 'Off',
                            badgeRu: 'Строго',
                            badgeEn: 'Strict',
                            subRu: 'Без пропусков',
                            subEn: 'No days off',
                            descRu: 'Фарм строго каждый день без сбоев',
                            descEn: 'Farms every active day strictly',
                            icon: ShieldOff,
                          },
                          {
                            val: 10,
                            percent: '10%',
                            titleRu: 'Редко',
                            titleEn: 'Rare',
                            badgeRu: 'Базовый',
                            badgeEn: 'Basic',
                            subRu: '~1 день в 10–14 дней',
                            subEn: '~1 day in 2 weeks',
                            descRu: 'Минимальный пропуск, максимум фарма',
                            descEn: 'Minimal skips, maximum farm',
                            icon: Shield,
                          },
                          {
                            val: 20,
                            percent: '20%',
                            titleRu: 'Рекомендуем',
                            titleEn: 'Optimal',
                            badgeRu: 'Баланс',
                            badgeEn: 'Best',
                            subRu: '~1–2 дня в неделю',
                            subEn: '~1–2 days/week',
                            descRu: 'Человечный профиль, лучшая защита',
                            descEn: 'Human profile, best defense',
                            icon: ShieldCheck,
                          },
                          {
                            val: 35,
                            percent: '35%',
                            titleRu: 'Часто (Скрытность)',
                            titleEn: 'High Stealth',
                            badgeRu: 'Скрытный',
                            badgeEn: 'Stealth',
                            subRu: '~2–3 дня в неделю',
                            subEn: '~2–3 days/week',
                            descRu: 'Максимум скрытности для ценных чаров',
                            descEn: 'Maximum stealth for main chars',
                            icon: VenetianMask,
                          },
                        ].map((opt) => {
                          const isSelected = scheduleSettings.offDayPercent === opt.val;
                          const OptIcon = opt.icon;
                          return (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                onScheduleSettingsChange({
                                  ...scheduleSettings,
                                  offDayPercent: opt.val,
                                });
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                                isSelected
                                  ? 'border-white bg-black shadow-[0_0_15px_rgba(255,255,255,0.08)] ring-1 ring-white/30 text-white'
                                  : 'border-white/10 hover:border-white/25 bg-black text-zinc-400 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-1.5">
                                  <OptIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-zinc-400'}`} />
                                  <span
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                      isSelected
                                        ? 'bg-white text-black'
                                        : 'bg-black text-zinc-400 border border-white/10'
                                    }`}
                                  >
                                    {opt.percent}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold">
                                  {isRu ? opt.badgeRu : opt.badgeEn}
                                </span>
                              </div>

                              <div>
                                <span className="block text-xs font-mono font-bold text-white">
                                  {isRu ? opt.titleRu : opt.titleEn}
                                </span>
                                <span className="block text-[11px] font-mono text-zinc-400 font-medium mt-0.5">
                                  {isRu ? opt.subRu : opt.subEn}
                                </span>
                              </div>

                              <p className="text-[10px] font-mono text-zinc-400 leading-tight border-t border-white/10 pt-1.5">
                                {isRu ? opt.descRu : opt.descEn}
                              </p>
                            </button>
                          );
                        })}
                      </div>

                      {/* Dynamic Beginner Explanation Box */}
                      <div className="p-3 rounded-xl bg-black border border-white/10 text-xs font-mono flex items-start gap-2.5">
                        {scheduleSettings.offDayPercent === 0 ? (
                          <ShieldOff className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        ) : scheduleSettings.offDayPercent <= 15 ? (
                          <Shield className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
                        ) : scheduleSettings.offDayPercent <= 25 ? (
                          <ShieldCheck className="w-4 h-4 text-white shrink-0 mt-0.5" />
                        ) : (
                          <VenetianMask className="w-4 h-4 text-white shrink-0 mt-0.5" />
                        )}
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-white">
                            {scheduleSettings.offDayPercent === 0
                              ? (isRu ? 'Строгий режим (0% отгулов)' : 'Strict Mode (0% skips)')
                              : scheduleSettings.offDayPercent <= 15
                              ? (isRu ? 'Редкие отгулы (10%)' : 'Rare Days Off (10%)')
                              : scheduleSettings.offDayPercent <= 25
                              ? (isRu ? 'Рекомендуемый режим (20%) — баланс безопасности' : 'Recommended Mode (20%) — Best Balance')
                              : (isRu ? 'Высокая скрытность (35%) — режим маскировки' : 'High Stealth Mode (35%)')}
                          </span>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {scheduleSettings.offDayPercent === 0
                              ? (isRu
                                  ? 'Бот будет заходить каждый назначенный день недели без единого пропуска. Дает 100% времени фарма, но монотонный график без пауз легче вычисляется античитом. Новичкам рекомендуем 20%.'
                                  : 'Bot farms strictly every enabled day. Maximizes farm hours, but uninterrupted patterns are easier to detect. We recommend 20% for beginners.')
                              : scheduleSettings.offDayPercent <= 15
                              ? (isRu
                                  ? 'Бот изредка пропускает рабочий день (~раз в 10-14 дней), имитируя внезапные дела игрока. Доход практически не падает, а шаблон роботизированности сбивается.'
                                  : 'Bot occasionally takes a day off (~once every 10-14 days), simulating personal errands while retaining nearly full profit.')
                              : scheduleSettings.offDayPercent <= 25
                              ? (isRu
                                  ? 'Бот берет 1–2 спонтанных выходных в неделю. Это самый естественный профиль обычного игрока. Антифрод-системы видят живого человека, у которого есть работа, отдых и личная жизнь.'
                                  : 'Bot takes 1-2 spontaneous days off per week. This mimics a real player schedule with work and leisure, providing optimal ban prevention.')
                              : (isRu
                                  ? 'Бот часто делает паузы на целый день (2–3 выходных в неделю). Максимальная маскировка для дорогих персонажей или на серверах со строгим ручным контролем.'
                                  : 'Bot frequently skips farm days. Maximum stealth for valuable characters or during strict moderation periods.')}
                          </p>
                        </div>
                      </div>
                      {renderGlassOverlay('dayOff')}
                    </div>

                    {/* Card 1: Session (Длина сессии и частота длинного перерыва) */}
                    <div className="relative overflow-hidden flex flex-col gap-4 p-4 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                          <Swords className="w-4 h-4 text-zinc-400" />
                          <span>{isRu ? 'Сессия' : 'Session'}</span>
                          {renderHelpButton('session')}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-zinc-400 border border-white/10">
                          {isRu ? 'Непрерывная игра' : 'Continuous Play'}
                        </span>
                      </div>

                      {/* Session duration */}
                      <div className="flex flex-col gap-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span>{isRu ? 'Длина сессии:' : 'Session duration:'}</span>
                          </span>
                          <span className="font-bold text-white">
                            {currentDay.sessionMinutes[0]} – {currentDay.sessionMinutes[1]} {isRu ? 'мин' : 'min'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={10}
                            max={currentDay.sessionMinutes[1]}
                            step={5}
                            value={currentDay.sessionMinutes[0]}
                            onChange={(e) =>
                              handleFineTuneChange('sessionMinutes', [Number(e.target.value), currentDay.sessionMinutes[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.sessionMinutes[0]}м</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.sessionMinutes[0]}
                            max={180}
                            step={5}
                            value={currentDay.sessionMinutes[1]}
                            onChange={(e) =>
                              handleFineTuneChange('sessionMinutes', [currentDay.sessionMinutes[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.sessionMinutes[1]}м</span>
                        </div>
                      </div>

                      {/* Long break frequency */}
                      <div className="flex flex-col gap-1.5 font-mono text-xs pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{isRu ? 'Частота длинного перерыва:' : 'Long break frequency:'}</span>
                          </span>
                          <span className="font-bold text-white">
                            {currentDay.longBreakEvery[0]} – {currentDay.longBreakEvery[1]} {isRu ? 'сессий' : 'sessions'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={1}
                            max={currentDay.longBreakEvery[1]}
                            step={1}
                            value={currentDay.longBreakEvery[0]}
                            onChange={(e) =>
                              handleFineTuneChange('longBreakEvery', [Number(e.target.value), currentDay.longBreakEvery[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.longBreakEvery[0]} с.</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.longBreakEvery[0]}
                            max={10}
                            step={1}
                            value={currentDay.longBreakEvery[1]}
                            onChange={(e) =>
                              handleFineTuneChange('longBreakEvery', [currentDay.longBreakEvery[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.longBreakEvery[1]} с.</span>
                        </div>
                      </div>
                      {renderGlassOverlay('session')}
                    </div>

                    {/* Card 2: Breaks (Короткий, длинный и выход в меню) */}
                    <div className="relative overflow-hidden flex flex-col gap-4 p-4 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-zinc-400" />
                          <span>{isRu ? 'Перерывы' : 'Breaks'}</span>
                          {renderHelpButton('breaks')}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-zinc-400 border border-white/10">
                          {isRu ? 'Паузы и логаут' : 'Pauses & Logout'}
                        </span>
                      </div>

                      {/* Short break duration */}
                      <div className="flex flex-col gap-1.5 font-mono text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <span>{isRu ? 'Короткий перерыв:' : 'Short break:'}</span>
                          </span>
                          <span className="font-bold text-white">
                            {currentDay.shortBreakMinutes[0]} – {currentDay.shortBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={1}
                            max={currentDay.shortBreakMinutes[1]}
                            step={1}
                            value={currentDay.shortBreakMinutes[0]}
                            onChange={(e) =>
                              handleFineTuneChange('shortBreakMinutes', [Number(e.target.value), currentDay.shortBreakMinutes[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.shortBreakMinutes[0]}м</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.shortBreakMinutes[0]}
                            max={Math.min(60, currentDay.longBreakMinutes[0])}
                            step={1}
                            value={currentDay.shortBreakMinutes[1]}
                            onChange={(e) =>
                              handleFineTuneChange('shortBreakMinutes', [currentDay.shortBreakMinutes[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.shortBreakMinutes[1]}м</span>
                        </div>
                      </div>

                      {/* Long break duration */}
                      <div className="flex flex-col gap-1.5 font-mono text-xs pt-3 border-t border-white/10">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 flex items-center gap-1.5">
                            <Moon className="w-3.5 h-3.5 text-zinc-400" />
                            <span>{isRu ? 'Длинный перерыв:' : 'Long break:'}</span>
                          </span>
                          <span className="font-bold text-white">
                            {currentDay.longBreakMinutes[0]} – {currentDay.longBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={10}
                            max={currentDay.longBreakMinutes[1]}
                            step={5}
                            value={currentDay.longBreakMinutes[0]}
                            onChange={(e) =>
                              handleFineTuneChange('longBreakMinutes', [Number(e.target.value), currentDay.longBreakMinutes[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.longBreakMinutes[0]}м</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400 text-[11px]">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.longBreakMinutes[0]}
                            max={240}
                            step={5}
                            value={currentDay.longBreakMinutes[1]}
                            onChange={(e) =>
                              handleFineTuneChange('longBreakMinutes', [currentDay.longBreakMinutes[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-12 text-right text-white font-mono">{currentDay.longBreakMinutes[1]}м</span>
                        </div>
                      </div>

                      {/* Character Menu Logout Toggle */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-xs font-mono text-zinc-300 font-medium">
                            {isRu ? 'Выход в меню на длинный перерыв' : 'Menu logout on long break'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFineTuneChange('longBreakLogout', !currentDay.longBreakLogout)}
                          className={`w-8 h-4 flex items-center rounded-full p-0.5 cursor-pointer transition-colors border ${
                            currentDay.longBreakLogout ? 'bg-white border-white' : 'bg-black border-white/20'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-full transform transition-transform ${
                              currentDay.longBreakLogout ? 'translate-x-3.5 bg-black' : 'translate-x-0 bg-white'
                            }`}
                          />
                        </button>
                      </div>
                      {renderGlassOverlay('breaks')}
                    </div>
                  </div>
                )}
              </SpecularCard>

              {/* 4. Day Preview Section (Generated solely via preview_schedule_day) */}
              <SpecularCard className="relative p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-zinc-400" />
                    <h3 className="text-xs sm:text-sm font-mono font-semibold text-white flex items-center gap-2">
                      <span>{isRu ? 'Пример дня (симуляция)' : 'Day Simulation Preview'}</span>
                      {renderHelpButton('simulation')}
                    </h3>
                  </div>

                  {preview && preview.ok && !preview.off && (
                    <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-zinc-500">
                      <span className="flex items-center gap-1 text-zinc-900 dark:text-zinc-100 font-bold">
                        <Swords className="w-3.5 h-3.5 text-zinc-400" />
                        <span>~{formatMinutesToHours(preview.farm_s / 60)} ч фарма</span>
                      </span>
                      <span>•</span>
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {preview.sessions} {preview.sessions === 1 ? 'сессия' : preview.sessions < 5 ? 'сессии' : 'сессий'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-zinc-500">
                        <Coffee className="w-3.5 h-3.5 text-zinc-400" />
                        <span>
                          ~{formatMinutesToHours(
                            preview.segments.reduce(
                              (acc, s) => (s.kind === 'short_break' || s.kind === 'long_break' ? acc + s.minutes : acc),
                              0
                            )
                          )}{' '}
                          ч пауз
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {preview && !preview.ok && (
                  <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                    <span>{preview.error || (isRu ? 'Ошибка генерации примера' : 'Preview error')}</span>
                  </div>
                )}

                {preview && preview.ok && preview.off && (
                  <div className="py-8 text-center text-xs font-mono text-zinc-400 flex flex-col items-center gap-2">
                    <Moon className="w-6 h-6 text-zinc-400" />
                    <span>{isRu ? 'Выходной день — фарм не запланирован' : 'Day off — no sessions planned'}</span>
                  </div>
                )}

                {preview && preview.ok && !preview.off && preview.segments.length > 0 && (() => {
                  const activeSegment = activeSegmentIdx !== null ? preview.segments[activeSegmentIdx] : null;
                  const firstTime = preview.start_ms ? formatMsToTime(preview.start_ms) : formatMsToTime(preview.segments[0]?.start_ms);
                  const lastTime = preview.end_ms ? formatMsToTime(preview.end_ms) : formatMsToTime(preview.segments[preview.segments.length - 1]?.end_ms);

                  return (
                    <div className="flex flex-col gap-2.5 pt-1">
                      {/* Segmented Timeline Bar (Minimalist, Slim & Sleek) */}
                      <div className="relative w-full flex h-3.5 rounded-full overflow-hidden border border-white/15 p-0.5 gap-0.5 bg-zinc-900 shadow-inner">
                        {preview.segments.map((seg, idx) => {
                          const isFarm = seg.kind === 'farm';
                          const isLong = seg.kind === 'long_break';
                          const isShort = seg.kind === 'short_break';
                          const isWait = seg.kind === 'wait_window';
                          const isSelected = activeSegmentIdx === idx;

                          let bgClass = 'bg-zinc-500';
                          if (isFarm) {
                            bgClass = 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]';
                          } else if (isShort) {
                            bgClass = 'bg-zinc-400';
                          } else if (isLong) {
                            bgClass = 'bg-zinc-700';
                          } else if (isWait) {
                            bgClass = 'bg-zinc-950 border border-dashed border-zinc-700';
                          }

                          return (
                            <div
                              key={idx}
                              style={{ flexGrow: Math.max(1, seg.minutes) }}
                              onClick={() => {
                                soundFx.playClick();
                                setActiveSegmentIdx(isSelected ? null : idx);
                              }}
                              onMouseEnter={() => setActiveSegmentIdx(idx)}
                              title={`${isFarm ? 'Фарм' : isLong ? 'Длинный перерыв (меню)' : isShort ? 'Короткая пауза' : 'Окно закрыто'}: ${formatMsToTime(seg.start_ms)} – ${formatMsToTime(seg.end_ms)} (${seg.minutes}м)`}
                              className={`relative h-full rounded-sm transition-all cursor-pointer select-none ${bgClass} ${
                                isSelected ? 'ring-2 ring-white scale-y-125 z-10 brightness-125' : 'hover:brightness-125'
                              }`}
                            />
                          );
                        })}
                      </div>

                      {/* Time Axis Ruler */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 px-1 -mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-white">
                          <span>{firstTime}</span>
                          <span className="text-[9px] text-zinc-500 uppercase">(старт)</span>
                        </span>
                        <div className="flex-1 mx-3 border-t border-dashed border-white/10 relative flex justify-center">
                          <span className="px-2 text-[10px] text-zinc-500">
                            {preview.segments.length} интервалов дня
                          </span>
                        </div>
                        <span className="flex items-center gap-1 font-semibold text-white">
                          <span>{lastTime}</span>
                          <span className="text-[9px] text-zinc-500 uppercase">(финиш)</span>
                        </span>
                      </div>

                      {/* Interactive Segment Inspector Card */}
                      {activeSegment && (
                        <div className="p-3 rounded-xl bg-black/60 border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs animate-fadeIn shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black border border-white/20 flex items-center justify-center shrink-0">
                              {activeSegment.kind === 'farm' && <Swords className="w-4 h-4 text-white" />}
                              {activeSegment.kind === 'short_break' && <Coffee className="w-4 h-4 text-zinc-300" />}
                              {activeSegment.kind === 'long_break' && <Moon className="w-4 h-4 text-zinc-300" />}
                              {activeSegment.kind === 'wait_window' && <Clock className="w-4 h-4 text-zinc-500" />}
                            </div>

                            <div className="flex flex-col">
                              <span className="font-bold text-white flex items-center gap-2">
                                <span>
                                  {activeSegment.kind === 'farm' && (isRu ? 'Сессия фарма' : 'Farm Session')}
                                  {activeSegment.kind === 'short_break' && (isRu ? 'Короткая пауза (на месте)' : 'Short Pause')}
                                  {activeSegment.kind === 'long_break' && (isRu ? 'Длинный перерыв (в меню)' : 'Long Break (Menu)')}
                                  {activeSegment.kind === 'wait_window' && (isRu ? 'Промежуток между окнами' : 'Between Windows')}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400">
                                  #{activeSegmentIdx! + 1}
                                </span>
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                {activeSegment.kind === 'farm' && (isRu ? 'Бот в игре: перемещается по маршруту и фармит ресурсы.' : 'Active farming and navigation.')}
                                {activeSegment.kind === 'short_break' && (isRu ? 'Персонаж стоит на месте, осматривается — имитация секундного отвлечения.' : 'Character stands still, simulating a quick distraction.')}
                                {activeSegment.kind === 'long_break' && (isRu ? 'Глубокий отдых (обед / перерыв): бот выходит в меню персонажей.' : 'Long break: logout to character select for stealth.')}
                                {activeSegment.kind === 'wait_window' && (isRu ? 'Бот не запущен — ожидание наступления следующего рабочего окна.' : 'Bot idle: awaiting the next scheduled window.')}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto font-mono">
                            <span className="px-2.5 py-1 rounded-lg bg-black text-white border border-white/20 font-bold text-xs shadow-sm">
                              {formatMsToTime(activeSegment.start_ms)} – {formatMsToTime(activeSegment.end_ms)}
                            </span>
                            <span className="text-zinc-400 text-xs font-semibold">({activeSegment.minutes} мин)</span>
                          </div>
                        </div>
                      )}

                      {/* Detailed Explanatory Cards with Icons and Clear Descriptions */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-white/10 font-mono text-xs">
                        {/* 1. Farm Session */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 flex items-start gap-2.5 transition-all">
                          <div className="w-7 h-7 rounded-lg bg-white text-zinc-950 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Swords className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white text-xs">
                              {isRu ? 'Фарм (белый)' : 'Farming (White)'}
                            </span>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {isRu
                                ? 'Активный фарм: перемещение по маршруту и сбор ресурсов.'
                                : 'Active route execution and resource gathering.'}
                            </p>
                          </div>
                        </div>

                        {/* 2. Short Break */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 flex items-start gap-2.5 transition-all">
                          <div className="w-7 h-7 rounded-lg bg-zinc-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Coffee className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-zinc-200 text-xs">
                              {isRu ? 'Короткая пауза' : 'Short Pause'}
                            </span>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {isRu
                                ? '2–6 мин: чар стоит на месте, имитируя отвлечение игрока.'
                                : '2–6 mins: idle on spot simulating human distraction.'}
                            </p>
                          </div>
                        </div>

                        {/* 3. Long Break */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 flex items-start gap-2.5 transition-all">
                          <div className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-200 border border-white/10 flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Moon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-zinc-300 text-xs">
                              {isRu ? 'Длинный перерыв' : 'Long Break'}
                            </span>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {isRu
                                ? '20–60 мин: выход в меню персонажей на обед или дела.'
                                : '20–60 mins: logout to menu for lunch or personal break.'}
                            </p>
                          </div>
                        </div>

                        {/* 4. Between Windows */}
                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/25 flex items-start gap-2.5 transition-all">
                          <div className="w-7 h-7 rounded-lg bg-black border border-dashed border-zinc-600 text-zinc-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-zinc-400 text-xs">
                              {isRu ? 'Между окнами' : 'Between Windows'}
                            </span>
                            <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">
                              {isRu
                                ? 'Окно закрыто: бот выключен до начала следующего периода.'
                                : 'Window closed: bot idle until next scheduled playtime.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {renderGlassOverlay('simulation')}
              </SpecularCard>
            </>
          )}
        </div>
      </div>

      {/* =========================================================================
          FLOATING TOAST NOTIFICATIONS (ZERO LAYOUT SHIFT, ZERO RESIZING)
          ========================================================================= */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none flex flex-col gap-2 max-w-sm">
        {copyFeedback && (
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl bg-black border border-emerald-500/40 text-white shadow-[0_12px_36px_rgba(0,0,0,0.8)] backdrop-blur-xl font-mono text-xs animate-slideInRight">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-emerald-200">{copyFeedback}</span>
          </div>
        )}

        {scheduleError && (
          <div className="pointer-events-auto flex items-center gap-3 p-3.5 rounded-2xl border border-red-500/40 bg-black text-red-300 font-mono text-xs shadow-[0_12px_36px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-slideInRight">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="leading-snug">{scheduleError}</span>
          </div>
        )}
      </div>
    </div>
  );
};
