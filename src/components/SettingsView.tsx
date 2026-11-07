import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Clock,
  AlertTriangle,
  CalendarClock,
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
  onNavigateToSchedule?: () => void;
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

  if (e.key === 'PageUp' || e.code === 'PageUp') return 'PAGEUP';
  if (e.key === 'PageDown' || e.code === 'PageDown') return 'PAGEDOWN';
  if (e.key === 'Home' || e.code === 'Home') return 'HOME';
  if (e.key === 'End' || e.code === 'End') return 'END';
  if (e.key === 'Insert' || e.code === 'Insert') return 'INSERT';

  if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') return '-';
  if (e.key === '=' || e.code === 'Equal') return '=';

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

  return keyStr.slice(0, 8);
};

// Search key validator: A–Z, 0–9, '-', '=', F1–F12, PAGEUP, PAGEDOWN, HOME, END, INSERT, DELETE
export const isValidSearchKey = (key: string): boolean => {
  if (!key) return true;
  if (/^[A-Z]$/.test(key)) return true;
  if (/^[0-9]$/.test(key)) return true;
  if (key === '-' || key === '=') return true;
  if (/^F([1-9]|1[0-2])$/.test(key)) return true;
  if (['PAGEUP', 'PAGEDOWN', 'HOME', 'END', 'INSERT', 'DELETE'].includes(key)) return true;
  return false;
};

interface KeybindItem {
  id: keyof AppSettings;
  nameRu: string;
  nameEn: string;
  hintRu: string;
  hintEn: string;
  defaultVal: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsChange,
  scheduleSettings,
  onScheduleSettingsChange,
  scheduleError,
  onNavigateToSchedule,
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

      const isSearchBind = capturingId === 'herbSearchKey' || capturingId === 'oreSearchKey';

      // Backspace or Delete clears the bind (value '')
      if (e.key === 'Backspace' || e.key === 'Delete') {
        onSettingsChange({
          ...settings,
          [capturingId]: '',
        });
        setCapturingId(null);
        if (onToast) {
          onToast('[—]');
        }
        return;
      }

      if (e.key === 'Escape') {
        setCapturingId(null);
        return;
      }

      const keyName = getPhysicalKeyFromEvent(e);
      if (keyName === null) {
        setCapturingId(null);
        return;
      }

      // Requirement 5: search keys only accept A–Z, 0–9, '-', '=', F1–F12, PAGEUP, PAGEDOWN, HOME, END, INSERT, DELETE
      if (isSearchBind && !isValidSearchKey(keyName)) {
        setCapturingId(null);
        if (onToast) {
          onToast(isRu ? 'Эту клавишу бот нажать не может' : 'The bot cannot press this key');
        }
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
  }, [capturingId, settings, onSettingsChange, onToast, isRu]);

  const handleResetDefaults = () => {
    onSettingsChange({
      ...settings,
      previousTargetKey: 'H',
      startStopKey: 'F5',
      interactKey: 'G',
      clearTargetKey: 'ESC',
      pauseKey: 'PAUSE',
      herbSearchKey: 'F9',
      oreSearchKey: 'F10',
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
      hintRu: 'В игре: Параметры → Управление → Выбор цели → «Предыдущая цель»',
      hintEn: 'In game: Options → Controls → Targeting → Target Last Target',
      defaultVal: 'H',
    },
    {
      id: 'startStopKey',
      nameRu: 'Старт / пауза бота',
      nameEn: 'Start / Pause Bot',
      hintRu: 'Клавиша самого бота — в игре настраивать не нужно',
      hintEn: 'Bot hotkey — nothing to set in game',
      defaultVal: 'F5',
    },
    {
      id: 'interactKey',
      nameRu: 'Взаимодействие с целью',
      nameEn: 'Interact With Target',
      hintRu: 'В игре: Параметры → Управление → Выбор цели → «Взаимодействие с целью»',
      hintEn: 'In game: Options → Controls → Targeting → Interact With Target',
      defaultVal: 'G',
    },
    {
      id: 'clearTargetKey',
      nameRu: 'Сброс цели',
      nameEn: 'Clear Target',
      hintRu: 'В игре Esc снимает цель сам — настраивать не нужно',
      hintEn: 'Esc clears the target in game — nothing to set',
      defaultVal: 'ESC',
    },
    {
      id: 'pauseKey',
      nameRu: 'Экстренная пауза',
      nameEn: 'Emergency Pause',
      hintRu: 'Клавиша самого бота — в игре настраивать не нужно',
      hintEn: 'Bot hotkey — nothing to set in game',
      defaultVal: 'PAUSE',
    },
    {
      id: 'herbSearchKey',
      nameRu: 'Поиск трав',
      nameEn: 'Find Herbs',
      hintRu: 'Любая свободная клавиша, лучше F9–F12. Аддон сам привяжет к ней «Поиск трав» — класть заклинание на панель команд не нужно. Поменял клавишу — набери /reload в игре. Нет травничества — аддон клавишу не тронет.',
      hintEn: 'Any free key, F9–F12 recommended. The addon will bind Find Herbs to it automatically — no need to place it on an action bar. Changed the key? Type /reload in game. No herbalism — the addon leaves the key untouched.',
      defaultVal: 'F9',
    },
    {
      id: 'oreSearchKey',
      nameRu: 'Поиск минералов',
      nameEn: 'Find Minerals',
      hintRu: 'Любая свободная клавиша, лучше F9–F12. Аддон сам привяжет к ней «Поиск минералов» — класть заклинание на панель команд не нужно. Поменял клавишу — набери /reload в игре. Нет горного дела — аддон клавишу не тронет.',
      hintEn: 'Any free key, F9–F12 recommended. The addon will bind Find Minerals to it automatically — no need to place it on an action bar. Changed the key? Type /reload in game. No mining — the addon leaves the key untouched.',
      defaultVal: 'F10',
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
            {/* 1.2 Off Day Chance (offDayPercent: 0..50) */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Шанс случайного выходного' : 'Random day off chance'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Вероятность дополнительного дня отдыха (0–50%)' : 'Probability of an additional day off (0–50%)'}
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

            {/* 1.3 Link to full Week Schedule View */}
            <SpecularCard className="p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-zinc-500" />
                    <span>{isRu ? 'Недельное расписание по дням' : 'Weekly schedule by days'}</span>
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu
                      ? 'Окна часов (с–до), стили игры и тонкая настройка для каждого дня недели'
                      : 'Playtime windows, styles, and fine-tuning for each day of the week'}
                  </p>
                </div>

                {onNavigateToSchedule && (
                  <SpecularButton
                    onClick={onNavigateToSchedule}
                    className="px-3 py-1.5 rounded-lg border border-transparent hover:border-black/15 dark:hover:border-white/[0.15] bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-mono font-semibold cursor-pointer transition-all"
                  >
                    <span>{isRu ? 'Открыть расписание' : 'Open Schedule'}</span>
                  </SpecularButton>
                )}
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

        {/* Keybinds List with In-game hints */}
        <div className="flex flex-col gap-1.5 sm:gap-2">
          {bindList.map((item) => {
            const rawVal = settings[item.id];
            const currentKey = rawVal !== undefined ? rawVal : item.defaultVal;
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
                  {/* Left Side: Name and Hint */}
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white tracking-wide">
                      {isRu ? item.nameRu : item.nameEn}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono leading-snug mt-0.5 break-words">
                      {isRu ? item.hintRu : item.hintEn}
                    </span>
                  </div>

                  {/* Right Side: Keycap Button with Live Capture */}
                  <div className="relative shrink-0 ml-auto flex items-center">
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
