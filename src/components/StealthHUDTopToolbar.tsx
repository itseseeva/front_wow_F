import React from 'react';
import { Sun, Moon, Download, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
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
  isMuted: boolean;
  onToggleMute: () => void;
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
  isMuted,
  onToggleMute,
}) => {
  return (
    <header
      className="fixed z-30 flex items-center gap-2.5 select-none rounded-xl border border-transparent hover:border-white/[0.08] transition-all duration-200"
      style={{
        top: '20px',
        right: '20px',
        padding: '5px 10px',
        background: 'transparent',
        boxShadow: 'none',
      }}
    >
      {/* 1. Language Toggle */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onToggleLanguage();
        }}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-white cursor-pointer transition-colors text-xs font-medium py-1 px-1.5 rounded active:scale-95"
        title="Сменить язык (RU / EN)"
      >
        <span className="font-serif text-xs">文A</span>
        <span className="font-mono text-[11px] font-semibold tracking-wider">
          {language.toUpperCase()}
        </span>
      </button>

      {/* 2. Vertical Divider */}
      <div className="w-px h-3.5 bg-white/[0.08] shrink-0" />

      {/* 3. Theme Toggle */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onToggleTheme();
        }}
        className="text-zinc-500 hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title="Тема"
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
        className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold tracking-wider cursor-pointer transition-all border border-transparent hover:border-white/[0.12] bg-transparent ${
          isBotRunning
            ? 'text-white'
            : 'text-zinc-300 hover:text-white'
        }`}
        title={isBotRunning ? 'Остановить бота (F5)' : 'Запустить бота (F5)'}
      >
        {isBotRunning ? (
          <span className="flex items-center gap-1.5 text-white">
            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
            STOP
          </span>
        ) : (
          'START'
        )}
      </SpecularButton>

      {/* 5. Download Tray Icon */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onExport();
        }}
        className="text-zinc-500 hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title="Экспорт маршрута"
      >
        <Download className="w-3.5 h-3.5 stroke-[1.5]" />
      </button>

      {/* 6. Sound Toggle */}
      <button
        type="button"
        onClick={() => {
          onToggleMute();
          soundFx.playClick();
        }}
        className="text-zinc-500 hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title={isMuted ? 'Включить звук' : 'Выключить звук'}
      >
        {isMuted ? (
          <VolumeX className="w-3.5 h-3.5 text-zinc-700 stroke-[1.5]" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 stroke-[1.5]" />
        )}
      </button>

      {/* 7. Settings */}
      <button
        type="button"
        onClick={() => {
          soundFx.playClick();
          onOpenSettings();
        }}
        className="text-zinc-500 hover:text-white cursor-pointer transition-colors p-1 rounded active:scale-95"
        title="Настройки"
      >
        <SlidersHorizontal className="w-3.5 h-3.5 stroke-[1.5]" />
      </button>
    </header>
  );
};
