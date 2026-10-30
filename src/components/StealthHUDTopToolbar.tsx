import React from 'react';
import { Sun, Moon, Download, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

interface StealthHUDTopToolbarProps {
  language: 'ru' | 'en';
  onToggleLanguage: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isBotRunning: boolean;
  onToggleBot: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenStats?: () => void;
}

export const StealthHUDTopToolbar: React.FC<StealthHUDTopToolbarProps> = ({
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  isBotRunning,
  onToggleBot,
  onExport,
  onOpenSettings,
  onOpenStats,
}) => {
  const isRu = language === 'ru';

  return (
    <header
      className="absolute top-2.5 right-2.5 sm:top-4 sm:right-4 xl:top-5 xl:right-5 z-30 flex items-center gap-1.5 sm:gap-2 select-none rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] transition-all duration-200 py-1 px-2 sm:px-3 bg-transparent shadow-none"
    >
      {/* 1. Language Toggle */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onToggleLanguage();
        }}
        className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors text-xs font-medium py-1 px-1.5 rounded active:scale-95"
        title={isRu ? 'Сменить язык (Switch to English)' : 'Switch language (Переключить на русский)'}
      >
        <span className="font-serif text-xs">文A</span>
        <span className="font-mono text-[11px] font-semibold tracking-wider">
          {language.toUpperCase()}
        </span>
      </button>

      {/* 2. Vertical Divider */}
      <div className="w-px h-3.5 bg-black/10 dark:bg-white/[0.08] shrink-0" />

      {/* 3. Theme Toggle */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onToggleTheme();
        }}
        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95 flex items-center gap-1"
        title={theme === 'dark' ? (isRu ? 'Включить светлую тему' : 'Switch to light mode') : (isRu ? 'Включить тёмную тему' : 'Switch to dark mode')}
      >
        {theme === 'dark' ? (
          <Sun className="w-3.5 h-3.5 stroke-[1.5]" />
        ) : (
          <Moon className="w-3.5 h-3.5 stroke-[1.5]" />
        )}
      </button>

      {/* 4. Action Button: START / STOP (Ghost Specular Button) */}
      <SpecularButton
        onClick={() => {
          if (isBotRunning) {
            soundFx.playStop();
          } else {
            soundFx.playStart();
          }
          onToggleBot();
        }}
        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold tracking-wider cursor-pointer transition-all border border-transparent hover:border-black/15 dark:hover:border-white/[0.12] bg-transparent ${
          isBotRunning
            ? 'text-zinc-950 dark:text-white font-bold'
            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white'
        }`}
        title={isBotRunning ? (isRu ? 'Остановить бота (F5)' : 'Stop bot (F5)') : (isRu ? 'Запустить бота (F5)' : 'Start bot (F5)')}
      >
        {isBotRunning ? (
          <span className="flex items-center gap-1.5 text-zinc-950 dark:text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
            {isRu ? 'СТОП' : 'STOP'}
          </span>
        ) : (
          isRu ? 'СТАРТ' : 'START'
        )}
      </SpecularButton>

      {/* 5. Statistics / Analytics Report Button */}
      {onOpenStats && (
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            onOpenStats();
          }}
          className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
          title={isRu ? 'Итоги сессии и аналитика' : 'Session summary & analytics'}
        >
          <BarChart3 className="w-3.5 h-3.5 stroke-[1.5]" />
        </button>
      )}

      {/* 6. Download Tray Icon */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onExport();
        }}
        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title={isRu ? 'Экспорт конфигурации JSON' : 'Export JSON configuration'}
      >
        <Download className="w-3.5 h-3.5 stroke-[1.5]" />
      </button>

      {/* 7. Settings */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onOpenSettings();
        }}
        className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title={isRu ? 'Настройки' : 'Settings'}
      >
        <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.5]" />
      </button>
    </header>
  );
};
