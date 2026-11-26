import { Sun, Moon, Download, SlidersHorizontal, BarChart3 } from 'lucide-react';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';
interface StealthHUDTopToolbarProps {
  language: 'ru' | 'en';
  onToggleLanguage: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isBotRunning: boolean;
  isBotStopping?: boolean;
  isBotPaused?: boolean;
  pauseKey?: string;
  onToggleBot: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  onOpenStats?: () => void;
  className?: string;
}

export const StealthHUDTopToolbar: React.FC<StealthHUDTopToolbarProps> = ({
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  isBotRunning,
  isBotStopping = false,
  isBotPaused = false,
  pauseKey = 'PAUSE',
  onToggleBot,
  onExport,
  onOpenSettings,
  onOpenStats,
  className = '',
}) => {
  const isRu = language === 'ru';
  const formattedPauseKey = (pauseKey || 'PAUSE').toUpperCase();

  return (
    <header
      className={`relative flex items-center gap-1.5 sm:gap-2 select-none rounded-xl border border-black/10 dark:border-white/[0.12] transition-all duration-200 py-1.5 px-2.5 sm:px-3 bg-zinc-100/90 dark:bg-[#09090b]/90 backdrop-blur-md shadow-md ${className}`}
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

      {/* 4. Amber Pause Badge (рядом с кнопкой СТОП) */}
      {isBotRunning && isBotPaused && !isBotStopping && (
        <div
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-500 dark:text-amber-400 font-mono text-xs font-semibold shadow-sm animate-pulse select-none whitespace-nowrap"
          title={isRu ? `Бот на паузе. Нажми ${formattedPauseKey}, чтобы продолжить` : `Bot paused. Press ${formattedPauseKey} to resume`}
        >
          <span>
            {isRu
              ? `⏸ Пауза — управление у тебя. Нажми ${formattedPauseKey}, чтобы продолжить`
              : `⏸ Paused — you are in control. Press ${formattedPauseKey} to resume`}
          </span>
        </div>
      )}

      {/* 5. Action Button: START / STOP / STOPPING (Ghost Specular Button) */}
      <SpecularButton
        disabled={isBotStopping}
        onClick={() => {
          if (isBotStopping) return;
          onToggleBot();
        }}
        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold tracking-wider transition-all border border-transparent bg-transparent ${
          isBotStopping
            ? 'text-zinc-500 dark:text-zinc-400 cursor-not-allowed opacity-75'
            : isBotRunning
            ? 'text-zinc-950 dark:text-white font-bold cursor-pointer hover:border-black/15 dark:hover:border-white/[0.12]'
            : 'text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer hover:border-black/15 dark:hover:border-white/[0.12]'
        }`}
        title={
          isBotStopping
            ? (isRu ? 'Останавливаем бота…' : 'Stopping bot…')
            : isBotRunning
            ? (isRu ? 'Остановить бота (F5)' : 'Stop bot (F5)')
            : (isRu ? 'Запустить бота (F5)' : 'Start bot (F5)')
        }
      >
        {isBotStopping ? (
          <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            <span className="w-3 h-3 rounded-full border-[1.5px] border-zinc-400/30 border-t-zinc-400 animate-spin shrink-0" />
            {isRu ? 'Останавливаю…' : 'Stopping…'}
          </span>
        ) : isBotRunning ? (
          <span className="flex items-center gap-1.5 text-zinc-950 dark:text-white">
            <span className="w-2 h-2 rounded-[1.5px] bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)] animate-pulse shrink-0" />
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
