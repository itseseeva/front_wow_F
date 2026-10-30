import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
} from 'lucide-react';
import { AppSettings } from '../types';
import { Language, Theme } from '../utils/i18n';
import { SpecularCard, SpecularButton } from './ui/Specular';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
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
    <div className="flex flex-col gap-4 w-full select-none text-zinc-900 dark:text-zinc-100 font-sans">
      {/* 1. Subheader: Title & Reset Action (no back button, no emojis) */}
      <div className="flex items-center justify-between pb-3 border-b border-transparent">
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

      {/* 2. Keybinds List: Name on the left, Pulsing Bind Button on the right (no text 'жми', no cross) */}
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

                {/* Right Side: Keycap Button with Live Capture on far right end (pulses without 'жми' text) */}
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

      {/* 3. Sleek Info Notice Capsule */}
      <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-[11px] font-mono text-zinc-500 dark:text-zinc-400 transition-all">
        <span className="leading-snug">
          {isRu
            ? 'Все бинды синхронизируются автоматически в файл конфигурации бота и активны в фоновом режиме.'
            : 'All keybinds automatically synchronize with bot configuration and run active in background.'}
        </span>
      </div>
    </div>
  );
};
