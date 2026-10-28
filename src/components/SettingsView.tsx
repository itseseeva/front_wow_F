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
import { Language, Theme, translations } from '../utils/i18n';

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

// Convert keyboard event to clean game key format
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
  name: string;
  badge: string;
  description: string;
  defaultVal: string;
  icon: React.ReactNode;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSettingsChange,
  onBack,
  language = 'ru',
  theme = 'dark',
  onToast,
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

  const [capturingId, setCapturingId] = useState<keyof AppSettings | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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

      const bindName =
        capturingId === 'previousTargetKey'
          ? t.bindPreviousTarget
          : capturingId === 'startStopKey'
          ? t.bindStartStop
          : capturingId === 'interactKey'
          ? t.bindInteract
          : capturingId === 'clearTargetKey'
          ? t.bindClearTarget
          : capturingId === 'pauseKey'
          ? t.bindPause
          : String(capturingId);

      setCapturingId(null);
      if (onToast) {
        onToast(`${bindName}: [${keyName || '—'}]`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [capturingId, settings, onSettingsChange, onToast, t]);

  const handleClearKey = (bindId: keyof AppSettings, e: React.MouseEvent) => {
    e.stopPropagation();
    onSettingsChange({
      ...settings,
      [bindId]: '',
    });
    if (onToast) {
      onToast(t.keyCleared);
    }
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
      onToast(t.defaultsRestored);
    }
  };

  const bindList: KeybindItem[] = [
    {
      id: 'previousTargetKey',
      name: t.bindPreviousTarget,
      badge: t.bindPreviousTargetBadge,
      description: t.bindPreviousTargetDesc,
      defaultVal: 'H',
      icon: <Target className="w-3.5 h-3.5 text-cyan-500 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />,
    },
    {
      id: 'startStopKey',
      name: t.bindStartStop,
      badge: t.bindStartStopBadge,
      description: t.bindStartStopDesc,
      defaultVal: 'F5',
      icon: <Zap className="w-3.5 h-3.5 text-amber-500 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]" />,
    },
    {
      id: 'interactKey',
      name: t.bindInteract,
      badge: t.bindInteractBadge,
      description: t.bindInteractDesc,
      defaultVal: 'F',
      icon: <Hand className="w-3.5 h-3.5 text-emerald-500 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]" />,
    },
    {
      id: 'clearTargetKey',
      name: t.bindClearTarget,
      badge: t.bindClearTargetBadge,
      description: t.bindClearTargetDesc,
      defaultVal: 'ESC',
      icon: <XCircle className="w-3.5 h-3.5 text-rose-500 drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]" />,
    },
    {
      id: 'pauseKey',
      name: t.bindPause,
      badge: t.bindPauseBadge,
      description: t.bindPauseDesc,
      defaultVal: 'PAUSE',
      icon: <Pause className="w-3.5 h-3.5 text-sky-500 drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn select-none">
      {/* Subheader: Minimalist HUD Capsule Navigation */}
      <div className={`flex items-center justify-between pb-2 mb-2 border-b shrink-0 ${
        isDark ? 'border-zinc-800/80' : 'border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          {/* Back button with sleek hover expansion */}
          <button
            type="button"
            onClick={onBack}
            className={`group flex items-center h-7 px-2.5 rounded-lg text-[10.5px] font-mono font-bold tracking-wider border transition-all duration-200 cursor-pointer active:scale-95 ${
              isDark
                ? 'bg-[#070b12] border-cyan-900/60 hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] text-cyan-300'
                : 'bg-white border-slate-300 hover:border-cyan-500 hover:bg-slate-50 hover:shadow-sm text-slate-700'
            }`}
            title={t.backBtn}
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out group-hover:max-w-[70px] group-hover:opacity-100 group-hover:ml-1.5 text-[10.5px] font-mono">
              {t.backBtn}
            </span>
          </button>

          {/* Section title in HUD aesthetic matching top capsule */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            isDark
              ? 'bg-[#070b12] border-cyan-900/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]'
              : 'bg-slate-100 border-slate-300 shadow-inner'
          }`}>
            <Keyboard className="w-3.5 h-3.5 text-cyan-500" />
            <span className={`text-[11px] font-mono font-black tracking-wider uppercase ${
              isDark ? 'text-zinc-100' : 'text-slate-800'
            }`}>
              {t.hotkeysTitle}
            </span>
          </div>
        </div>

        {/* Right side: Reset defaults button with hover text */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className={`group flex items-center h-7 px-2.5 rounded-lg border text-[10px] font-mono font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
              isDark
                ? 'border-cyan-900/50 bg-[#070b12] hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_10px_rgba(6,182,212,0.3)] text-zinc-400 hover:text-cyan-300'
                : 'border-slate-300 bg-white hover:border-cyan-500 hover:bg-slate-50 hover:shadow-xs text-slate-600 hover:text-cyan-700'
            }`}
            title={t.resetDefaultsTooltip}
          >
            <RotateCcw className="w-3 h-3 text-cyan-500/80 group-hover:text-cyan-600 transition-transform group-hover:-rotate-90 shrink-0" />
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out group-hover:max-w-[140px] group-hover:opacity-100 group-hover:ml-1.5">
              {t.resetDefaults}
            </span>
          </button>

          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold tracking-widest border ${
            isDark
              ? 'bg-[#070b12] border-cyan-900/60 text-cyan-400/90 shadow-[0_0_6px_rgba(6,182,212,0.2)]'
              : 'bg-white border-slate-300 text-cyan-700 shadow-xs'
          }`}>
            HUD • BINDS
          </span>
        </div>
      </div>

      {/* Main Single-Section Container: Sleek Binds Grid */}
      <div className="flex-1 flex flex-col justify-between gap-2 min-h-0 overflow-y-auto pr-0.5">
        <div className="space-y-1.5">
          {bindList.map((item) => {
            const rawVal = settings[item.id];
            const currentKey = typeof rawVal === 'string' && rawVal !== '' ? rawVal : item.defaultVal;
            const isCapturing = capturingId === item.id;
            const isHovered = hoveredId === item.id;

            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative p-2 sm:p-2.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                  isCapturing
                    ? isDark
                      ? 'bg-[#0f1d33] border-cyan-300 shadow-[0_0_16px_rgba(6,182,212,0.5)] ring-1 ring-cyan-400'
                      : 'bg-cyan-50 border-cyan-500 shadow-sm ring-1 ring-cyan-400'
                    : isHovered
                    ? isDark
                      ? 'bg-[#090f1a] border-cyan-400/80 shadow-[0_0_14px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/30'
                      : 'bg-slate-50 border-cyan-500 shadow-sm'
                    : isDark
                    ? 'bg-[#06080e] border-zinc-800/80 hover:border-cyan-900/80'
                    : 'bg-white border-slate-200/90 hover:border-slate-300 shadow-xs'
                }`}
              >
                {/* Left side: Icon + Name + Badge + Dynamic Hover Text */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                      isHovered || isCapturing
                        ? isDark
                          ? 'border-cyan-400 bg-[#0a1628] shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                          : 'border-cyan-500 bg-cyan-100/60 shadow-xs'
                        : isDark
                        ? 'border-zinc-800 bg-[#070b12]'
                        : 'border-slate-200 bg-slate-100'
                    }`}
                  >
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-[11px] font-mono font-black tracking-wide truncate ${
                        isDark ? 'text-zinc-100' : 'text-slate-900'
                      }`}>
                        {item.name}
                      </h4>
                      <span className={`text-[8.5px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                        isDark
                          ? 'border-cyan-900/50 bg-[#070b12] text-cyan-400'
                          : 'border-cyan-200 bg-cyan-50 text-cyan-800'
                      }`}>
                        {item.badge}
                      </span>
                    </div>

                    {/* Minimalist description with high-tech glowing text on hover */}
                    <p
                      className={`text-[9.5px] font-mono truncate transition-colors duration-150 mt-0.5 ${
                        isHovered
                          ? isDark
                            ? 'text-cyan-300/90 font-medium'
                            : 'text-cyan-800 font-medium'
                          : isDark
                          ? 'text-zinc-400'
                          : 'text-slate-500'
                      }`}
                      title={item.description}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Right side: Keybind Cap with Glowing State */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCapturingId(item.id)}
                    className={`min-w-[56px] h-7 px-3 rounded-lg border flex items-center justify-center font-mono font-black text-xs tracking-wider transition-all duration-200 cursor-pointer active:scale-95 select-none ${
                      isCapturing
                        ? isDark
                          ? 'bg-[#0f1d33] border-cyan-300 text-cyan-200 shadow-[0_0_16px_rgba(6,182,212,0.8)] animate-pulse ring-2 ring-cyan-400'
                          : 'bg-cyan-100 border-cyan-500 text-cyan-900 shadow-sm animate-pulse ring-2 ring-cyan-500'
                        : currentKey
                        ? isDark
                          ? 'bg-[#070b12] border-cyan-500/70 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)] hover:border-cyan-300 hover:shadow-[0_0_12px_rgba(6,182,212,0.45)]'
                          : 'bg-slate-100 border-slate-300 text-cyan-800 hover:border-cyan-500 hover:bg-white shadow-xs'
                        : isDark
                        ? 'bg-[#070b12] border-zinc-700 text-zinc-400 hover:border-cyan-400 hover:text-white'
                        : 'bg-white border-slate-300 text-slate-500 hover:border-cyan-500 hover:text-slate-900'
                    }`}
                    title={isCapturing ? t.pressAnyKeyPrompt : t.clickToRebindPrompt}
                  >
                    {isCapturing ? (
                      <div className="flex items-center gap-1 text-[10px] text-cyan-500 font-bold">
                        <Sparkles className="w-3 h-3 text-cyan-500 animate-spin" />
                        <span>{t.pressingKey}</span>
                      </div>
                    ) : (
                      currentKey || '—'
                    )}
                  </button>

                  {/* Clear Keybind Button */}
                  {currentKey && !isCapturing && (
                    <button
                      type="button"
                      onClick={(e) => handleClearKey(item.id, e)}
                      className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                        isDark
                          ? 'border-zinc-800 bg-[#070b12] text-zinc-400 hover:text-rose-400 hover:border-rose-500/60 hover:shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                          : 'border-slate-300 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 shadow-xs'
                      }`}
                      title={t.clearBindTooltip}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Minimalist Tech Footer Notice */}
        <div className={`p-2 rounded-xl border flex items-center gap-2 text-[9.5px] font-mono shadow-xs mt-1 ${
          isDark
            ? 'border-cyan-900/40 bg-[#06080e] text-zinc-400'
            : 'border-slate-200 bg-slate-50 text-slate-600'
        }`}>
          <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="leading-snug">
            {t.syncNotice}
          </span>
        </div>
      </div>
    </div>
  );
};
