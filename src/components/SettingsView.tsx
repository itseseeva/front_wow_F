import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  SlidersHorizontal,
  Target,
  Zap,
  Compass,
  Globe,
  Download,
  X,
  Sparkles,
  Sun,
  Moon,
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

type SettingCategory = 'target' | 'hotkeys' | 'route' | 'appearance' | 'export';

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
  onNavigateToRoutes,
  onExportJson,
  language = 'ru',
  onLanguageChange,
  theme = 'dark',
  onThemeChange,
  onToast,
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

  const [activeCategory, setActiveCategory] = useState<SettingCategory>('target');
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
        onToast(`${t.keySaved}: [${keyName || '—'}]`);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isCapturingKey, settings, onSettingsChange, onToast, t]);

  const handleClearKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSettingsChange({
      ...settings,
      previousTargetKey: '',
    });
    if (onToast) {
      onToast(t.keyCleared);
    }
  };

  const [zoomConflictError, setZoomConflictError] = useState<string | null>(null);

  const handleZoomKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    setter: (keyName: string) => void
  ) => {
    if (['Tab', 'Escape', 'Enter'].includes(e.key)) return;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      return; // allow normal deletion
    }

    let keyName = '';
    if (e.key === 'PageUp') keyName = 'PAGEUP';
    else if (e.key === 'PageDown') keyName = 'PAGEDOWN';
    else if (e.key === 'Home') keyName = 'HOME';
    else if (e.key === 'End') keyName = 'END';
    else if (e.key === 'Insert') keyName = 'INSERT';
    else if (e.key === 'ArrowUp') keyName = 'UP';
    else if (e.key === 'ArrowDown') keyName = 'DOWN';
    else if (e.key === 'ArrowLeft') keyName = 'LEFT';
    else if (e.key === 'ArrowRight') keyName = 'RIGHT';
    else if (/^F([1-9]|1[0-2])$/i.test(e.key)) keyName = e.key.toUpperCase();
    else if (e.code.startsWith('Key')) keyName = e.code.replace('Key', '').toUpperCase();
    else if (e.code.startsWith('Digit')) keyName = e.code.replace('Digit', '');
    else if (e.code.startsWith('Numpad')) keyName = 'NUM' + e.code.replace('Numpad', '').toUpperCase();
    else if (e.key === ' ' || e.code === 'Space') keyName = 'SPACE';
    else if (e.key.length === 1) keyName = e.key.toUpperCase();

    if (keyName) {
      e.preventDefault();
      setter(keyName);
    }
  };

  const handleZoomInChange = (rawKey: string) => {
    const newKey = rawKey.toUpperCase().trim();
    if (newKey !== '' && newKey === (settings.minimapZoomOutKey || '').toUpperCase().trim()) {
      setZoomConflictError(t.minimapZoomConflictError);
      if (onToast) onToast(t.minimapZoomConflictError);
      return;
    }
    setZoomConflictError(null);
    onSettingsChange({
      ...settings,
      minimapZoomInKey: newKey,
    });
  };

  const handleZoomOutChange = (rawKey: string) => {
    const newKey = rawKey.toUpperCase().trim();
    if (newKey !== '' && newKey === (settings.minimapZoomInKey || '').toUpperCase().trim()) {
      setZoomConflictError(t.minimapZoomConflictError);
      if (onToast) onToast(t.minimapZoomConflictError);
      return;
    }
    setZoomConflictError(null);
    onSettingsChange({
      ...settings,
      minimapZoomOutKey: newKey,
    });
  };

  const categories: { id: SettingCategory; title: string; subtitle: string; icon: React.ReactNode }[] = [
    {
      id: 'target',
      title: 'Цель и лут',
      subtitle: 'Предыдущая цель',
      icon: <Target className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'hotkeys',
      title: 'Горячие клавиши',
      subtitle: 'F5 Старт / Стоп',
      icon: <Zap className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'route',
      title: 'Запись маршрута',
      subtitle: 'Фарм маршрут',
      icon: <Compass className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'appearance',
      title: 'Язык и тема',
      subtitle: `${language.toUpperCase()} • ${theme === 'dark' ? 'Dark' : 'Light'}`,
      icon: <Globe className="w-3.5 h-3.5 text-cyan-400" />,
    },
    {
      id: 'export',
      title: 'Экспорт JSON',
      subtitle: 'Резервная копия',
      icon: <Download className="w-3.5 h-3.5 text-cyan-400" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn select-none">
      {/* Subheader: [ ← Назад ] 🎛️ НАСТРОЙКИ БОТА ------------- [ CONFIG ] */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-zinc-800/80 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back Button */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-mono font-bold tracking-wider bg-[#070b12] border border-cyan-900/60 hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_10px_rgba(6,182,212,0.4)] text-cyan-300 transition-all cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Назад</span>
          </button>

          <div className="flex items-center gap-1.5 text-zinc-100 font-mono font-black text-xs tracking-wider">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span>НАСТРОЙКИ БОТА</span>
          </div>
        </div>

        <span className="text-[9px] px-2 py-0.5 rounded font-mono font-bold tracking-widest bg-[#070b12] border border-cyan-900/60 text-cyan-400">
          CONFIG
        </span>
      </div>

      {/* Two-column layout matching screenshot image_ba356a08.png */}
      <div className="flex-1 flex gap-2.5 min-h-0 overflow-hidden">
        {/* Left Column: Sidebar Menu */}
        <div className="w-44 sm:w-48 flex flex-col border border-zinc-800/80 rounded-xl bg-[#06080d] p-1.5 shrink-0">
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-zinc-800/60 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
            <span>НАСТРОЙКИ</span>
            <span className="text-cyan-400 font-black">5</span>
          </div>

          <div className="space-y-1 overflow-y-auto pr-0.5 flex-1">
            {categories.map((cat) => {
              const isActive = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`w-full text-left p-2 rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                    isActive
                      ? 'bg-[#0a1424] border-cyan-400 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400/40'
                      : 'bg-[#080b11] border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{cat.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10.5px] font-mono font-bold leading-tight truncate">
                      {cat.title}
                    </div>
                    <div className="text-[9px] font-mono text-zinc-400 truncate mt-0.5">
                      {cat.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Category Content */}
        <div className="flex-1 border border-zinc-800/80 rounded-xl bg-[#06080d] p-3 flex flex-col justify-between overflow-y-auto relative">
          <div key={activeCategory} className="animate-screen-assemble stagger-assemble flex-1 flex flex-col justify-between">
          {activeCategory === 'target' && (
            <div className="space-y-3 flex flex-col h-full justify-between">
              <div>
                {/* Title */}
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-black uppercase tracking-wider mb-2.5">
                  <Target className="w-4 h-4" />
                  <span>ПРЕДЫДУЩАЯ ЦЕЛЬ</span>
                </div>

                {/* Keybind Card */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <h4 className="text-xs font-mono font-black text-zinc-100">
                      Клавиша в игре
                    </h4>
                    <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                      {isCapturingKey ? 'Нажмите любую клавишу...' : 'Нажмите для назначения'}
                    </p>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      ref={captureButtonRef}
                      type="button"
                      onClick={() => setIsCapturingKey(true)}
                      className={`min-w-[50px] h-7 px-3 rounded-md border flex items-center justify-center font-mono font-black text-xs transition-all cursor-pointer active:scale-95 ${
                        isCapturingKey
                          ? 'bg-[#0c1626] border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.6)] animate-pulse'
                          : settings.previousTargetKey
                            ? 'bg-[#070b12] border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)] hover:border-cyan-300'
                            : 'bg-[#070b12] border-zinc-700 text-zinc-400 hover:border-cyan-400'
                      }`}
                    >
                      {isCapturingKey ? (
                        <Sparkles className="w-3 h-3 text-cyan-300 animate-spin" />
                      ) : (
                        settings.previousTargetKey || '—'
                      )}
                    </button>

                    {settings.previousTargetKey && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="w-7 h-7 rounded-md border border-zinc-800 bg-[#070b12] text-zinc-400 hover:text-rose-400 hover:border-rose-500/60 flex items-center justify-center transition-colors cursor-pointer"
                        title="Очистить клавишу"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Minimap Zoom Block */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-mono font-black text-zinc-100">
                        {t.minimapZoomTitle}
                      </h4>
                      <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                        {t.minimapZoomInLabel} / {t.minimapZoomOutLabel}
                      </p>
                    </div>
                    {zoomConflictError && (
                      <span className="text-[10px] font-mono text-rose-400 font-bold animate-pulse text-right max-w-[200px]">
                        {zoomConflictError}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                    {/* Zoom In Input */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#070b12] border border-zinc-800/80">
                      <label className="text-[10px] sm:text-[10.5px] font-mono text-zinc-300 font-bold whitespace-nowrap">
                        {t.minimapZoomInLabel}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={settings.minimapZoomInKey ?? ''}
                          onChange={(e) => handleZoomInChange(e.target.value)}
                          onKeyDown={(e) => handleZoomKeyDown(e, handleZoomInChange)}
                          placeholder=""
                          className="w-24 sm:w-28 bg-[#0b101b] text-cyan-300 border border-cyan-900/70 hover:border-cyan-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded px-2 py-1 text-xs font-mono font-black outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] text-center uppercase"
                        />
                        {settings.minimapZoomInKey && (
                          <button
                            type="button"
                            onClick={() => handleZoomInChange('')}
                            className="w-6 h-6 rounded border border-zinc-800 bg-[#070b12] text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Очистить"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Zoom Out Input */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-[#070b12] border border-zinc-800/80">
                      <label className="text-[10px] sm:text-[10.5px] font-mono text-zinc-300 font-bold whitespace-nowrap">
                        {t.minimapZoomOutLabel}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={settings.minimapZoomOutKey ?? ''}
                          onChange={(e) => handleZoomOutChange(e.target.value)}
                          onKeyDown={(e) => handleZoomKeyDown(e, handleZoomOutChange)}
                          placeholder=""
                          className="w-24 sm:w-28 bg-[#0b101b] text-cyan-300 border border-cyan-900/70 hover:border-cyan-400 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded px-2 py-1 text-xs font-mono font-black outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] text-center uppercase"
                        />
                        {settings.minimapZoomOutKey && (
                          <button
                            type="button"
                            onClick={() => handleZoomOutChange('')}
                            className="w-6 h-6 rounded border border-zinc-800 bg-[#070b12] text-zinc-500 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                            title="Очистить"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Подсказка мелким текстом под блоком */}
                  <p className="text-[9.5px] font-mono text-zinc-400 leading-relaxed border-t border-zinc-800/60 pt-2 mt-0.5">
                    {t.minimapZoomHint}
                  </p>
                </div>

                {/* Bot Mode Setting Card */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <h4 className="text-xs font-mono font-black text-zinc-100">
                      Режим бота
                    </h4>
                    <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                      {settings.mode === 'grind'
                        ? 'Гринд — бой с мобами, руда и травы по дороге'
                        : 'Сбор — только руда и травы, бой — если напали'}
                    </p>
                  </div>

                  <div className="p-0.5 rounded-lg border border-cyan-900/60 bg-[#070b12] flex items-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                    <button
                      type="button"
                      onClick={() => onSettingsChange({ ...settings, mode: 'grind' })}
                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                        settings.mode === 'grind'
                          ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                          : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
                      }`}
                    >
                      Гринд
                    </button>
                    <button
                      type="button"
                      onClick={() => onSettingsChange({ ...settings, mode: 'gather' })}
                      className={`px-2.5 py-1 rounded-md text-[10.5px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                        settings.mode === 'gather'
                          ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                          : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
                      }`}
                    >
                      Сбор
                    </button>
                  </div>
                </div>
              </div>

              {/* Hint Card */}
              <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-[#080b11] text-[10px] font-mono text-zinc-400 leading-relaxed">
                Как в игре: Параметры → Управление → Выбор цели → Предыдущая цель. После убийства бот жмёт её, чтобы выделить труп и облутать его
              </div>
            </div>
          )}

          {activeCategory === 'hotkeys' && (
            <div className="space-y-3 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-black uppercase tracking-wider mb-2.5">
                  <Zap className="w-4 h-4" />
                  <span>ГОРЯЧИЕ КЛАВИШИ</span>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <h4 className="text-xs font-mono font-black text-zinc-100">
                      Старт / Стоп бота
                    </h4>
                    <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                      Быстрое включение и выключение
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-md bg-[#070b12] border border-cyan-400 text-cyan-300 font-mono font-black text-xs shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                    F5
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-[#080b11] text-[10px] font-mono text-zinc-400 leading-relaxed">
                Клавиша F5 работает в панели и в игре для мгновенного запуска и остановки цикла фарма.
              </div>
            </div>
          )}

          {activeCategory === 'route' && (
            <div className="space-y-3 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-black uppercase tracking-wider mb-2.5">
                  <Compass className="w-4 h-4" />
                  <span>ЗАПИСЬ МАРШРУТА</span>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <h4 className="text-xs font-mono font-black text-zinc-100">
                      Управление маршрутами
                    </h4>
                    <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                      Запись, просмотр и выбор основного пути
                    </p>
                  </div>
                  {onNavigateToRoutes && (
                    <button
                      type="button"
                      onClick={onNavigateToRoutes}
                      className="px-2.5 py-1 rounded-md border border-cyan-400 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/50 font-mono font-bold text-xs transition-colors cursor-pointer"
                    >
                      К маршрутам →
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-[#080b11] text-[10px] font-mono text-zinc-400 leading-relaxed">
                Вы можете записывать обходы карты, просматривать вариации движения и назначать основной маршрут во вкладке «Маршруты».
              </div>
            </div>
          )}

          {activeCategory === 'appearance' && (
            <div className="space-y-3 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-black uppercase tracking-wider mb-2.5">
                  <Globe className="w-4 h-4" />
                  <span>ЯЗЫК И ТЕМА</span>
                </div>

                <div className="space-y-2">
                  {/* Language switcher */}
                  <div className="p-2.5 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                    <div>
                      <h4 className="text-xs font-mono font-black text-zinc-100">Язык интерфейса</h4>
                      <p className="text-[9.5px] font-mono text-zinc-400">RU / EN</p>
                    </div>
                    <div className="flex items-center gap-1 bg-[#05070a] p-0.5 rounded-md border border-zinc-800">
                      <button
                        type="button"
                        onClick={() => onLanguageChange && onLanguageChange('ru')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          language === 'ru'
                            ? 'bg-cyan-500 text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        RU
                      </button>
                      <button
                        type="button"
                        onClick={() => onLanguageChange && onLanguageChange('en')}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          language === 'en'
                            ? 'bg-cyan-500 text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        EN
                      </button>
                    </div>
                  </div>

                  {/* Theme switcher */}
                  <div className="p-2.5 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                    <div>
                      <h4 className="text-xs font-mono font-black text-zinc-100">Тема оформления</h4>
                      <p className="text-[9.5px] font-mono text-zinc-400">{theme === 'dark' ? 'Тёмная' : 'Светлая'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onThemeChange && onThemeChange(theme === 'dark' ? 'light' : 'dark')}
                      className="px-2.5 py-1 rounded-md border border-cyan-900/60 bg-[#070b12] text-cyan-300 hover:border-cyan-400 font-mono text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-cyan-400" /> : <Moon className="w-3.5 h-3.5 text-blue-500" />}
                      <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-[#080b11] text-[10px] font-mono text-zinc-400 leading-relaxed">
                Настройки темы и языка сохраняются в браузере автоматически.
              </div>
            </div>
          )}

          {activeCategory === 'export' && (
            <div className="space-y-3 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-mono font-black uppercase tracking-wider mb-2.5">
                  <Download className="w-4 h-4" />
                  <span>ЭКСПОРТ И ИМПОРТ</span>
                </div>

                <div className="p-3 rounded-lg border border-zinc-800 bg-[#090d16] flex items-center justify-between gap-2 shadow-xs">
                  <div>
                    <h4 className="text-xs font-mono font-black text-zinc-100">
                      Резервная копия
                    </h4>
                    <p className="text-[9.5px] font-mono text-zinc-400 mt-0.5">
                      Файл wowbot_config.json
                    </p>
                  </div>
                  {onExportJson && (
                    <button
                      type="button"
                      onClick={onExportJson}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-cyan-400 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 font-mono font-bold text-xs transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Скачать</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg border border-zinc-800/80 bg-[#080b11] text-[10px] font-mono text-zinc-400 leading-relaxed">
                Экспортирует конфигурацию ротации умений, задержек и параметров в формате JSON для переноса между ПК.
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
