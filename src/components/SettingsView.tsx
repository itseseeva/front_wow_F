import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Zap,
  Target,
  Hand,
  XCircle,
  Pause,
  RotateCcw,
  Sparkles,
  X,
  Keyboard,
  Info,
} from 'lucide-react';
import { AppSettings } from '../types';
import { Language, Theme } from '../utils/i18n';
import { SpecularCard, SpecularButton } from './ui/Specular';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onBack: () => void;
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
  badgeRu: string;
  badgeEn: string;
  descRu: string;
  descEn: string;
  defaultVal: string;
  icon: React.ReactNode;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsChange,
  onBack,
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

  const handleClearKey = (bindId: keyof AppSettings, e: React.MouseEvent) => {
    e.stopPropagation();
    onSettingsChange({
      ...settings,
      [bindId]: '',
    });
  };

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
      badgeRu: 'Таргет',
      badgeEn: 'Target',
      descRu: 'Выбор предыдущего моба или ресурса перед атакой',
      descEn: 'Select previous mob or node before engagement',
      defaultVal: 'H',
      icon: <Target className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />,
    },
    {
      id: 'startStopKey',
      nameRu: 'Старт / пауза бота',
      nameEn: 'Start / Pause Bot',
      badgeRu: 'Управление',
      badgeEn: 'Control',
      descRu: 'Быстрое переключение активности бота по горячей клавише',
      descEn: 'Toggle bot execution on / off via global hotkey',
      defaultVal: 'F5',
      icon: <Zap className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />,
    },
    {
      id: 'interactKey',
      nameRu: 'Клавиша взаимодействия',
      nameEn: 'Interact Key',
      badgeRu: 'Действие',
      badgeEn: 'Action',
      descRu: 'Сбор руды, лутание и использование игровых объектов',
      descEn: 'Mining, gathering herbs, and interacting with game objects',
      defaultVal: 'F',
      icon: <Hand className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />,
    },
    {
      id: 'clearTargetKey',
      nameRu: 'Сброс цели',
      nameEn: 'Clear Target',
      badgeRu: 'Отмена',
      badgeEn: 'Cancel',
      descRu: 'Снятие текущего таргета при выходе из боя или смене ноды',
      descEn: 'Drop current target when combat ends or moving to next node',
      defaultVal: 'ESC',
      icon: <XCircle className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />,
    },
    {
      id: 'pauseKey',
      nameRu: 'Экстренная пауза',
      nameEn: 'Emergency Pause',
      badgeRu: 'Защита',
      badgeEn: 'Safety',
      descRu: 'Мгновенное прерывание выполнения при появлении игрока',
      descEn: 'Instant freeze of movement & rotation if player appears',
      defaultVal: 'PAUSE',
      icon: <Pause className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4 w-full select-none text-zinc-100 font-sans">
      {/* 1. Subheader: Back & Reset Actions */}
      <div className="flex items-center justify-between pb-3 border-b border-transparent">
        <div className="flex items-center gap-2.5">
          <SpecularButton
            onClick={onBack}
            className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-white/[0.08] bg-transparent text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium active:scale-95"
            title={isRu ? 'Назад' : 'Back'}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-zinc-400" strokeWidth={1.5} />
            <span>{isRu ? 'Назад' : 'Back'}</span>
          </SpecularButton>

          <div className="flex items-center gap-2 pl-1">
            <Keyboard className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
            <h2 className="text-xs font-mono font-medium text-white">
              {isRu ? 'Глобальные горячие клавиши' : 'Global hotkeys configuration'}
            </h2>
          </div>
        </div>

        <SpecularButton
          onClick={handleResetDefaults}
          className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
          title={isRu ? 'Сбросить все бинды по умолчанию' : 'Reset all hotkeys to default'}
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
          <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
        </SpecularButton>
      </div>

      {/* 2. Keybinds List in Ghost Style */}
      <div className="flex flex-col gap-1.5">
        {bindList.map((item) => {
          const rawVal = settings[item.id];
          const currentKey = typeof rawVal === 'string' && rawVal !== '' ? rawVal : item.defaultVal;
          const isCapturing = capturingId === item.id;

          return (
            <SpecularCard
              key={item.id}
              className={`p-3 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                isCapturing
                  ? 'border-white text-white'
                  : 'border-transparent hover:border-white/[0.08] bg-transparent'
              }`}
            >
              {/* Left Side: Icon + Name + Description */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-transparent border border-transparent flex items-center justify-center shrink-0">
                  {item.icon}
                </div>

                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-medium text-white tracking-wide">
                      {isRu ? item.nameRu : item.nameEn}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {isRu ? item.badgeRu : item.badgeEn}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                    {isRu ? item.descRu : item.descEn}
                  </span>
                </div>
              </div>

              {/* Right Side: Keycap Button with Live Capture */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCapturingId(item.id)}
                  className={`min-w-[70px] h-8 px-3 rounded-lg border font-mono font-bold text-xs uppercase flex items-center justify-center transition-all cursor-pointer select-none outline-none ${
                    isCapturing
                      ? 'border-white text-white animate-pulse'
                      : currentKey
                      ? 'border-transparent hover:border-white/[0.12] text-zinc-300 hover:text-white bg-transparent'
                      : 'border-dashed border-white/10 text-zinc-600 hover:border-white/30'
                  }`}
                  title={isRu ? 'Нажмите для привязки клавиши' : 'Click to rebind key'}
                >
                  {isCapturing ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-white font-bold">
                      <Sparkles className="w-3 h-3 animate-spin shrink-0" />
                      <span>{isRu ? 'ЖМИ...' : 'PRESS...'}</span>
                    </div>
                  ) : (
                    <span className="tracking-widest">[{currentKey || '—'}]</span>
                  )}
                </button>

                {currentKey && !isCapturing && (
                  <button
                    type="button"
                    onClick={(e) => handleClearKey(item.id, e)}
                    className="w-8 h-8 rounded-lg border border-transparent hover:border-white/[0.1] text-zinc-500 hover:text-white text-xs flex items-center justify-center transition-colors cursor-pointer"
                    title={isRu ? 'Очистить клавишу' : 'Clear key'}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </SpecularCard>
          );
        })}
      </div>

      {/* 3. Sleek Info Notice Capsule */}
      <div className="p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex items-center gap-2.5 text-[11px] font-mono text-zinc-500 transition-all">
        <Info className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.5} />
        <span className="leading-snug">
          {isRu
            ? 'Все бинды синхронизируются автоматически в файл конфигурации бота и активны в фоновом режиме.'
            : 'All keybinds automatically synchronize with bot configuration and run active in background.'}
        </span>
      </div>
    </div>
  );
};
