import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Sparkles, X, Target } from 'lucide-react';
import { AppSettings } from '../types';
import { Language, Theme, translations } from '../utils/i18n';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onBack: () => void;
  language?: Language;
  theme?: Theme;
  onToast?: (msg: string) => void;
}

// Convert physical key event to clean game key format
const getPhysicalKeyFromEvent = (e: KeyboardEvent): string | null => {
  if (e.key === 'Escape') return null;
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

  return keyStr.slice(0, 5);
};

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

  const [isCapturingKey, setIsCapturingKey] = useState(false);
  const captureButtonRef = useRef<HTMLButtonElement | null>(null);

  // Global keydown listener when capturing key for Previous Target
  useEffect(() => {
    if (!isCapturingKey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setIsCapturingKey(false);
        return;
      }

      const keyName = getPhysicalKeyFromEvent(e);
      if (keyName === null) {
        setIsCapturingKey(false);
        return;
      }

      onSettingsChange({
        ...settings,
        previousTargetKey: keyName,
      });
      setIsCapturingKey(false);
      if (onToast) {
        onToast(language === 'ru' ? `Клавиша [${keyName || '—'}] сохранена` : `Key [${keyName || '—'}] saved`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isCapturingKey, settings, onSettingsChange, onToast, language]);

  const handleClearKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSettingsChange({
      ...settings,
      previousTargetKey: '',
    });
    if (onToast) {
      onToast(language === 'ru' ? 'Клавиша очищена' : 'Key cleared');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn select-none">
      {/* Compact Top Navigation Bar */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back Button in compact black & cyan style */}
          <button
            type="button"
            onClick={onBack}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer border select-none active:scale-95 ${
              isDark
                ? 'bg-[#070b12] border-cyan-900/60 hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_10px_rgba(6,182,212,0.4)] text-cyan-300'
                : 'bg-white border-zinc-300 text-zinc-700 hover:text-blue-600 hover:border-blue-400 shadow-xs'
            }`}
            title={t.backToMain}
          >
            <ArrowLeft className="w-3 h-3 drop-shadow-[0_0_4px_rgba(6,182,212,0.5)]" />
            <span>{t.backToMain}</span>
          </button>

          <span className="text-[11px] font-mono font-black uppercase tracking-wider text-zinc-200">
            {t.settingsTitle}
          </span>
        </div>

        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-widest border ${
          isDark ? 'bg-[#070b12] border-cyan-900/60 text-cyan-400' : 'bg-blue-50 border-blue-200 text-blue-600'
        }`}>
          CONFIG
        </span>
      </div>

      {/* Compact Settings List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 min-h-0">
        {/* Section Header */}
        <div className="flex items-center gap-1.5 px-1 pt-0.5 text-zinc-400">
          <Target className="w-3 h-3 text-cyan-400" />
          <span className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-300">
            {t.targetingSection}
          </span>
          <div className="flex-1 h-px bg-zinc-800/80 ml-1" />
        </div>

        {/* Compact Setting Row: Previous Target Key */}
        <div className={`px-2.5 py-1.5 rounded-lg border flex items-center justify-between gap-2 transition-all ${
          isDark
            ? 'bg-[#080b10] border-zinc-800/80 hover:border-cyan-900/50'
            : 'bg-white border-zinc-200 hover:border-blue-200'
        }`}>
          <div className="flex flex-col min-w-0 pr-1">
            <span className="text-[11px] font-mono font-bold text-zinc-200 leading-tight">
              {t.previousTargetKeyLabel}
            </span>
            <span className="text-[9px] text-zinc-400 font-mono truncate leading-tight">
              {t.previousTargetKeyHint}
            </span>
          </div>

          {/* Key Binding Button matching black-and-cyan style */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              ref={captureButtonRef}
              type="button"
              onClick={() => setIsCapturingKey(true)}
              className={`min-w-[58px] h-6 px-2 rounded-md border flex items-center justify-center gap-1 text-[10px] font-mono font-black tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                isCapturingKey
                  ? isDark
                    ? 'bg-[#0c1626] border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.6)] animate-pulse'
                    : 'bg-blue-100 border-blue-500 text-blue-700 ring-1 ring-blue-300 animate-pulse'
                  : settings.previousTargetKey
                    ? isDark
                      ? 'bg-[#070b12] border-cyan-400/80 text-cyan-300 hover:bg-[#0c1626] hover:border-cyan-300 hover:shadow-[0_0_10px_rgba(6,182,212,0.4)] shadow-[0_0_5px_rgba(6,182,212,0.2)]'
                      : 'bg-blue-50 border-blue-400 text-blue-700 hover:bg-blue-100 shadow-xs'
                    : isDark
                      ? 'bg-[#070b12] border-cyan-900/60 text-zinc-400 hover:text-cyan-200 hover:border-cyan-400 hover:bg-[#0c1626]'
                      : 'bg-zinc-100 border-zinc-300 text-zinc-500 hover:text-zinc-800 hover:border-zinc-400'
              }`}
              title={settings.previousTargetKey ? `${t.previousTargetKeyLabel}: ${settings.previousTargetKey}` : t.clickToBind}
            >
              {isCapturingKey ? (
                <span className="text-[9.5px] text-cyan-200 font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-cyan-300 animate-spin" />
                  <span>{t.pressAnyKey}</span>
                </span>
              ) : settings.previousTargetKey ? (
                <span className="text-[10px] uppercase tracking-wider text-cyan-300 drop-shadow-[0_0_4px_rgba(6,182,212,0.6)] font-black">
                  {settings.previousTargetKey}
                </span>
              ) : (
                <span className="text-[9px] text-zinc-400 hover:text-cyan-300 font-bold uppercase">
                  {t.clickToBind}
                </span>
              )}
            </button>

            {/* Clear Button */}
            {settings.previousTargetKey && (
              <button
                type="button"
                onClick={handleClearKey}
                disabled={isCapturingKey}
                className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                  isDark
                    ? 'bg-[#070b12] border-zinc-800 text-zinc-400 hover:text-rose-300 hover:border-rose-500/70 hover:bg-rose-950/20'
                    : 'bg-white border-zinc-200 text-zinc-400 hover:text-rose-600 hover:border-rose-300'
                }`}
                title={t.clearKey}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
