import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Clock,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { AppSettings, ScheduleSettings } from '../types';
import { Language, Theme } from '../utils/i18n';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { DEFAULT_SCHEDULE_SETTINGS } from '../data/mockSchedule';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  scheduleSettings: ScheduleSettings;
  onScheduleSettingsChange: (schedule: ScheduleSettings) => void;
  scheduleError?: string | null;
  onBack?: () => void;
  onNavigateToRoutes?: () => void;
  onExportJson?: () => void;
  language?: Language;
  onLanguageChange?: (lang: Language) => void;
  theme?: Theme;
  onThemeChange?: (theme: Theme) => void;
  onToast?: (msg: string) => void;
}

// Convert keyboard event to clean physical game key format
const getPhysicalKeyFromEvent = (e: KeyboardEvent): string | null => {
  if (e.key === 'Escape') return 'ESC';
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  if (e.key === 'Backspace' || e.key === 'Delete') return '';

  if (e.key === 'Tab') return 'TAB';
  if (/^F([1-9]|1[0-2])$/i.test(e.key)) {
    return e.key.toUpperCase();
  }

  let keyStr = e.key.toUpperCase();
  if (e.code.startsWith('Key')) {
    keyStr = e.code.replace('Key', '');
  } else if (e.code.startsWith('Digit')) {
    keyStr = e.code.replace('Digit', '');
  } else if (e.code.startsWith('Numpad')) {
    keyStr = 'NUM' + e.code.replace('Numpad', '');
  } else if (e.key === ' ' || e.code === 'Space') {
    keyStr = 'SPACE';
  } else if (e.key === 'ArrowUp') keyStr = 'UP';
  else if (e.key === 'ArrowDown') keyStr = 'DOWN';
  else if (e.key === 'ArrowLeft') keyStr = 'LEFT';
  else if (e.key === 'ArrowRight') keyStr = 'RIGHT';

  return keyStr.slice(0, 7);
};

interface KeybindItem {
  id: keyof AppSettings;
  nameRu: string;
  nameEn: string;
  defaultVal: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsChange,
  scheduleSettings,
  onScheduleSettingsChange,
  scheduleError,
  language = 'ru',
  onToast,
}) => {
  const isRu = language === 'ru';
  const [capturingId, setCapturingId] = useState<keyof AppSettings | null>(null);

  // Global listener for capturing keypress
  useEffect(() => {
    if (!capturingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const keyName = getPhysicalKeyFromEvent(e);
      if (keyName === null) {
        setCapturingId(null);
        return;
      }

      onSettingsChange({
        ...settings,
        [capturingId]: keyName,
      });

      setCapturingId(null);
      if (onToast) {
        onToast(`[${keyName || '—'}]`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [capturingId, settings, onSettingsChange, onToast]);

  const handleResetDefaults = () => {
    onSettingsChange({
      ...settings,
      previousTargetKey: 'H',
      startStopKey: 'F5',
      interactKey: 'F',
      clearTargetKey: 'ESC',
      pauseKey: 'PAUSE',
    });
    if (onToast) {
      onToast(isRu ? 'Настройки сброшены' : 'Defaults restored');
    }
  };

  const handleResetSchedule = () => {
    onScheduleSettingsChange({ ...DEFAULT_SCHEDULE_SETTINGS });
    if (onToast) {
      onToast(isRu ? 'Расписание сброшено по умолчанию' : 'Schedule restored to defaults');
    }
  };

  const bindList: KeybindItem[] = [
    {
      id: 'previousTargetKey',
      nameRu: 'Предыдущая цель',
      nameEn: 'Previous Target',
      defaultVal: 'H',
    },
    {
      id: 'startStopKey',
      nameRu: 'Старт / пауза бота',
      nameEn: 'Start / Pause Bot',
      defaultVal: 'F5',
    },
    {
      id: 'interactKey',
      nameRu: 'Клавиша взаимодействия',
      nameEn: 'Interact Key',
      defaultVal: 'F',
    },
    {
      id: 'clearTargetKey',
      nameRu: 'Сброс цели',
      nameEn: 'Clear Target',
      defaultVal: 'ESC',
    },
    {
      id: 'pauseKey',
      nameRu: 'Экстренная пауза',
      nameEn: 'Emergency Pause',
      defaultVal: 'PAUSE',
    },
  ];

  return (
    <div className="flex flex-col gap-6 w-full select-none text-zinc-900 dark:text-zinc-100 font-sans pb-12">
      {/* =========================================================================
          SECTION 1: РАСПИСАНИЕ ФАРМА (Schedule Settings)
          ========================================================================= */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
            <h2 className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
              {isRu ? 'Расписание фарма' : 'Farm schedule'}
            </h2>
          </div>

          <SpecularButton
            onClick={handleResetSchedule}
            className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            title={isRu ? 'Сбросить параметры расписания' : 'Reset schedule to default'}
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
            <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
          </SpecularButton>
        </div>

        {/* Schedule Validation Error Banner */}
        {scheduleError && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs flex items-center gap-2.5 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="leading-snug">{scheduleError}</span>
          </div>
        )}

        {/* 1.1 Enable Toggle */}
        <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
          <div className="flex items-center justify-between w-full">
            <div>
              <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white tracking-wide">
                {isRu ? 'Включить расписание фарма' : 'Enable farm schedule'}
              </span>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                {isRu
                  ? 'Автоматические сессии, перерывы и суточный бюджет времени'
                  : 'Automatic sessions, realistic breaks, and daily time budget'}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                onScheduleSettingsChange({
                  ...scheduleSettings,
                  enabled: !scheduleSettings.enabled,
                })
              }
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                scheduleSettings.enabled ? 'bg-zinc-950 dark:bg-white' : 'bg-black/15 dark:bg-white/15'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 shadow-sm transform transition-transform duration-200 ease-in-out ${
                  scheduleSettings.enabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </SpecularCard>

        {scheduleSettings.enabled && (
          <div className="flex flex-col gap-2">
            {/* 1.2 Session Duration (sessionMinutes: [min, max] 10..240) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Длина сессии' : 'Session duration'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Случайная длительность непрерывного фарма (10–240 мин)' : 'Random continuous farm duration (10–240 min)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'от' : 'min'}</span>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={scheduleSettings.sessionMinutes[0]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        sessionMinutes: [Math.max(10, Math.min(240, Number(e.target.value) || 10)), scheduleSettings.sessionMinutes[1]],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'до' : 'max'}</span>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={scheduleSettings.sessionMinutes[1]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        sessionMinutes: [scheduleSettings.sessionMinutes[0], Math.max(10, Math.min(240, Number(e.target.value) || 10))],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'мин' : 'min'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.3 Short Break (shortBreakMinutes: [min, max] 1..60) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Короткий перерыв' : 'Short break'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'короткий перерыв — персонаж стоит на месте (1–60 мин)' : 'short break — character stays in place (1–60 min)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'от' : 'min'}</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={scheduleSettings.shortBreakMinutes[0]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        shortBreakMinutes: [Math.max(1, Math.min(60, Number(e.target.value) || 1)), scheduleSettings.shortBreakMinutes[1]],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'до' : 'max'}</span>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={scheduleSettings.shortBreakMinutes[1]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        shortBreakMinutes: [scheduleSettings.shortBreakMinutes[0], Math.max(1, Math.min(60, Number(e.target.value) || 1))],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'мин' : 'min'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.4 Long Break (longBreakMinutes: [min, max] 10..240) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Длинный перерыв' : 'Long break'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Длительность большого отдыха (10–240 мин)' : 'Duration of large rest break (10–240 min)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'от' : 'min'}</span>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={scheduleSettings.longBreakMinutes[0]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        longBreakMinutes: [Math.max(10, Math.min(240, Number(e.target.value) || 10)), scheduleSettings.longBreakMinutes[1]],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'до' : 'max'}</span>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={scheduleSettings.longBreakMinutes[1]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        longBreakMinutes: [scheduleSettings.longBreakMinutes[0], Math.max(10, Math.min(240, Number(e.target.value) || 10))],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'мин' : 'min'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.5 Long Break Frequency (longBreakEvery: [min, max] 1..10) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Частота длинного перерыва' : 'Long break frequency'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'После каждых N сессий (целые 1–10)' : 'Trigger after every N sessions (1–10)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'каждые' : 'every'}</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={scheduleSettings.longBreakEvery[0]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        longBreakEvery: [Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1))), scheduleSettings.longBreakEvery[1]],
                      })
                    }
                    className="w-14 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">–</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={scheduleSettings.longBreakEvery[1]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        longBreakEvery: [scheduleSettings.longBreakEvery[0], Math.max(1, Math.min(10, Math.round(Number(e.target.value) || 1)))],
                      })
                    }
                    className="w-14 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'сессий' : 'sessions'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.6 Daily Hours Budget (dailyHours: [min, max] 0.5..12) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Норма в день' : 'Daily hours limit'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Суммарное игровое время за день (0.5–12 часов)' : 'Total daily playtime budget (0.5–12 hours)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'от' : 'min'}</span>
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={scheduleSettings.dailyHours[0]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        dailyHours: [Math.max(0.5, Math.min(12, Number(e.target.value) || 0.5)), scheduleSettings.dailyHours[1]],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'до' : 'max'}</span>
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={scheduleSettings.dailyHours[1]}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        dailyHours: [scheduleSettings.dailyHours[0], Math.max(0.5, Math.min(12, Number(e.target.value) || 0.5))],
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'ч' : 'hrs'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.7 Off Day Chance (offDayPercent: 0..50) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Шанс выходного' : 'Day off chance'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Вероятность полного дня отдыха (0–50%)' : 'Probability of taking a day off completely (0–50%)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={scheduleSettings.offDayPercent}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        offDayPercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">%</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.8 Window Start & End ("HH:MM") */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Окно игровых часов' : 'Time window'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Игровой день 05:00–05:00 (конец может быть после полуночи)' : 'Game day 05:00–05:00 (end can be after midnight)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500">{isRu ? 'с' : 'from'}</span>
                  <input
                    type="time"
                    value={scheduleSettings.windowStart}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        windowStart: e.target.value || '10:00',
                      })
                    }
                    className="h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'до' : 'to'}</span>
                  <input
                    type="time"
                    value={scheduleSettings.windowEnd}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        windowEnd: e.target.value || '02:00',
                      })
                    }
                    className="h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                </div>
              </div>
            </SpecularCard>

            {/* 1.9 Window Jitter (startJitterMinutes: 0..120) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Случайный сдвиг окна' : 'Window start/end jitter'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Начало и конец окна каждый день сдвигаются внутрь случайно (0–120 мин)' : 'Daily random start and end window inward jitter (0–120 min)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={scheduleSettings.startJitterMinutes}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        startJitterMinutes: Math.max(0, Math.min(120, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">{isRu ? 'мин' : 'min'}</span>
                </div>
              </div>
            </SpecularCard>

            {/* 1.10 Logout on Long Break & Hints */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between w-full">
                  <div>
                    <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                      {isRu ? 'Выход в меню персонажей на длинный перерыв' : 'Logout to character menu on long break'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        longBreakLogout: !scheduleSettings.longBreakLogout,
                      })
                    }
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                      scheduleSettings.longBreakLogout
                        ? 'border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                        : 'border-black/20 dark:border-white/20 bg-transparent text-transparent hover:border-black/40 dark:hover:border-white/40'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </button>
                </div>

                {/* Hints under fields (RU/EN, as required) */}
                <div className="flex flex-col gap-1 text-[11px] font-mono text-zinc-500 dark:text-zinc-400 border-t border-black/5 dark:border-white/[0.05] pt-2 mt-1">
                  <p>• {isRu ? 'короткий перерыв — персонаж стоит на месте' : 'short break — character stays in place'}</p>
                  <p>• {isRu ? 'длинный перерыв и конец дня — выход в меню персонажей; в мир бот входит сам (Enter)' : 'long break and day end — logout to character select; bot enters world automatically (Enter)'}</p>
                  <p>• {isRu ? 'для выхода в меню нужна английская раскладка в игре' : 'English keyboard layout is required in game to logout'}</p>
                </div>
              </div>
            </SpecularCard>
          </div>
        )}
      </div>

      {/* =========================================================================
          SECTION 2: GLOBAL HOTKEYS & KEYBINDS
          ========================================================================= */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/[0.08]">
          <h2 className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
            {isRu ? 'Глобальные горячие клавиши' : 'Global hotkeys configuration'}
          </h2>

          <SpecularButton
            onClick={handleResetDefaults}
            className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            title={isRu ? 'Сбросить все бинды по умолчанию' : 'Reset all hotkeys to default'}
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
            <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
          </SpecularButton>
        </div>

        {/* Keybinds List */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {bindList.map((item) => {
            const rawVal = settings[item.id];
            const currentKey = typeof rawVal === 'string' && rawVal !== '' ? rawVal : item.defaultVal;
            const isCapturing = capturingId === item.id;

            return (
              <SpecularCard
                key={item.id}
                className={`p-3 sm:p-3.5 rounded-xl border transition-all duration-150 ${
                  isCapturing
                    ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white'
                    : 'border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-4">
                  {/* Left Side: Name only */}
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white tracking-wide">
                    {isRu ? item.nameRu : item.nameEn}
                  </span>

                  {/* Right Side: Keycap Button with Live Capture */}
                  <div className="relative shrink-0 ml-auto">
                    <button
                      type="button"
                      onClick={() => setCapturingId(item.id)}
                      className={`min-w-[70px] h-8 px-3 rounded-lg border font-mono font-bold text-xs uppercase flex items-center justify-center transition-all cursor-pointer select-none outline-none ${
                        isCapturing
                          ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white animate-pulse bg-black/5 dark:bg-white/10'
                          : currentKey
                          ? 'border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/40 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white bg-transparent'
                          : 'border-dashed border-black/15 dark:border-white/10 text-zinc-400 dark:text-zinc-600 hover:border-zinc-400 dark:hover:border-white/30'
                      }`}
                      title={isRu ? 'Нажмите для привязки клавиши' : 'Click to rebind key'}
                    >
                      <span className="tracking-widest">[{currentKey || '—'}]</span>
                    </button>
                  </div>
                </div>
              </SpecularCard>
            );
          })}
        </div>
      </div>

      {/* Sleek Info Notice Capsule */}
      <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-[11px] font-mono text-zinc-500 dark:text-zinc-400 transition-all">
        <span className="leading-snug">
          {isRu
            ? 'Все настройки и расписание синхронизируются автоматически в файл конфигурации бота и активны в фоновом режиме.'
            : 'All settings and schedule automatically synchronize with bot configuration and run active in background.'}
        </span>
      </div>
    </div>
  );
};
