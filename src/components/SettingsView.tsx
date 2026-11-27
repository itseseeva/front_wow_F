import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  RotateCcw,
  Clock,
  AlertTriangle,
  Route,
  Coins,
  RefreshCw,
  Loader2,
  Keyboard,
  ArrowUpRight,
} from 'lucide-react';
import { AppSettings, ScheduleSettings, PriceStatus, AuctionRuleset } from '../types';
import { Language, Theme } from '../utils/i18n';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { DEFAULT_SCHEDULE_SETTINGS } from '../data/mockSchedule';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetPriceStatus, mockRefreshPrices } from '../data/mockPrices';
import { soundFx } from '../utils/audio';

export type SettingsSubTab = 'keybinds' | 'schedule' | 'autoroute' | 'auction';

const SETTINGS_TAB_STORAGE_KEY = 'wowbot_settings_tab';
const VALID_SETTINGS_TABS: SettingsSubTab[] = ['keybinds', 'schedule', 'autoroute', 'auction'];

const readSavedSettingsTab = (): SettingsSubTab => {
  try {
    const saved = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
    if (saved && VALID_SETTINGS_TABS.includes(saved as SettingsSubTab)) {
      return saved as SettingsSubTab;
    }
  } catch {}
  return 'keybinds';
};

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

  // Tilde / Backquote key (` / ~ / ё)
  if (e.code === 'Backquote' || e.key === '`' || e.key === '~' || e.key === 'ё' || e.key === 'Ё') {
    return '`';
  }

  if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') return '-';
  if (e.key === '=' || e.code === 'Equal') return '=';
  if (e.code === 'BracketLeft' || e.key === '[') return '[';
  if (e.code === 'BracketRight' || e.key === ']') return ']';

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

// Search key validator: A–Z, 0–9, '-', '=', '`', F1–F12, PAGEUP, PAGEDOWN, HOME, END, INSERT, DELETE
export const isValidSearchKey = (key: string): boolean => {
  if (!key) return true;
  if (/^[A-Z]$/.test(key)) return true;
  if (/^[0-9]$/.test(key)) return true;
  if (key === '-' || key === '=' || key === '`') return true;
  if (/^F([1-9]|1[0-2])$/.test(key)) return true;
  if (['PAGEUP', 'PAGEDOWN', 'HOME', 'END', 'INSERT', 'DELETE'].includes(key)) return true;
  return false;
};

const getRulesetLabel = (ruleset: AuctionRuleset | string | null | undefined, isRu: boolean): string => {
  switch (ruleset) {
    case 'normal':
      return isRu ? 'Обычный' : 'Normal';
    case 'pvp':
      return 'PvP';
    case 'rp':
      return isRu ? 'Ролевая игра' : 'RP';
    case 'rp_pvp':
      return isRu ? 'Ролевая игра с PvP' : 'RP-PvP';
    default:
      return isRu ? 'набор неизвестен' : 'unknown ruleset';
  }
};

interface KeybindItem {
  id: keyof AppSettings;
  nameRu: string;
  nameEn: string;
  hintRu: string;
  hintEn: string;
  defaultVal: string;
}

interface KeybindGroup {
  id: string;
  titleRu: string;
  titleEn: string;
  tourAttr?: string;
  items: KeybindItem[];
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
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(readSavedSettingsTab);
  const [capturingId, setCapturingId] = useState<keyof AppSettings | null>(null);
  const [clearTargetError, setClearTargetError] = useState(false);
  const [priceStatus, setPriceStatus] = useState<PriceStatus | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);

  const handleSelectSubTab = useCallback((tab: SettingsSubTab) => {
    soundFx.playClick();
    setCapturingId(null);
    setActiveSubTab(tab);
    try {
      localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, tab);
    } catch {}
  }, []);

  // Sync active settings tab when InteractiveTourGuide focuses a step inside Settings
  useLayoutEffect(() => {
    const handleTourTabSwitch = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: SettingsSubTab }>).detail;
      if (detail?.tab && VALID_SETTINGS_TABS.includes(detail.tab)) {
        setCapturingId(null);
        setActiveSubTab(detail.tab);
      }
    };
    window.addEventListener('wowbot:settings-tour-tab', handleTourTabSwitch);
    return () => window.removeEventListener('wowbot:settings-tour-tab', handleTourTabSwitch);
  }, []);

  // Auction prices: fetch on mount and listen to 'wowbot:prices'
  useEffect(() => {
    let isMounted = true;
    const loadPrices = async () => {
      try {
        const api = await getPywebviewApi();
        let res;
        if (api?.get_price_status) {
          res = await api.get_price_status();
        } else {
          res = await mockGetPriceStatus();
        }
        if (isMounted && res && res.ok) {
          setPriceStatus(res);
        }
      } catch (e) {
        console.warn('get_price_status error:', e);
      }
    };

    loadPrices();

    const handlePrices = (e: any) => {
      let detail: PriceStatus | undefined = e?.detail;
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail);
        } catch {}
      }
      if (detail && typeof detail === 'object') {
        setPriceStatus(detail);
      }
    };

    window.addEventListener('wowbot:prices', handlePrices);
    return () => {
      isMounted = false;
      window.removeEventListener('wowbot:prices', handlePrices);
    };
  }, []);

  const getHouseSourceText = () => {
    if (!priceStatus) return '';
    const note = priceStatus.who?.note || '';
    const houseId = priceStatus.house_id ?? settings.auctionHouseId ?? '';

    if (priceStatus.house_source === 'auto') {
      return isRu
        ? `Определён по игре: ${note} — аукцион №${houseId}`
        : `Determined by game: ${note} — auction #${houseId}`;
    }
    if (priceStatus.house_source === 'settings') {
      return isRu
        ? `Выбран вручную: №${houseId}`
        : `Manually selected: #${houseId}`;
    }
    return note;
  };

  const handleRefreshPrices = async () => {
    setIsPriceLoading(true);
    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.refresh_prices) {
        res = await api.refresh_prices();
      } else {
        res = await mockRefreshPrices();
      }
      if (res && res.ok) {
        setPriceStatus(res);
        if (onToast) {
          onToast(isRu ? 'Цены аукциона обновлены' : 'Auction prices updated');
        }
      }
    } catch (e) {
      console.warn('refresh_prices error:', e);
    } finally {
      setIsPriceLoading(false);
    }
  };

  // Global listener for capturing keypress
  useEffect(() => {
    if (!capturingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const isSearchBind = capturingId === 'herbSearchKey' || capturingId === 'oreSearchKey';
      const isClearTargetBind = capturingId === 'clearTargetKey';

      // Clear target bind: single key only, no modifiers, not Esc/Enter/Tab/Space
      if (isClearTargetBind) {
        const hasModifier =
          e.ctrlKey ||
          e.shiftKey ||
          e.altKey ||
          e.metaKey ||
          ['Control', 'Shift', 'Alt', 'Meta'].includes(e.key);
        const isForbiddenKey =
          e.key === 'Escape' ||
          e.code === 'Escape' ||
          e.key === 'Enter' ||
          e.code === 'Enter' ||
          e.code === 'NumpadEnter' ||
          e.key === 'Tab' ||
          e.code === 'Tab' ||
          e.key === ' ' ||
          e.code === 'Space';

        if (hasModifier || isForbiddenKey) {
          setClearTargetError(true);
          setCapturingId(null);
          return;
        }
      }

      // Backspace or Delete clears the bind (value '')
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (isClearTargetBind) setClearTargetError(false);
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

      // Search keys only accept A–Z, 0–9, '-', '=', '`', F1–F12, PAGEUP, PAGEDOWN, HOME, END, INSERT, DELETE
      if (isSearchBind && !isValidSearchKey(keyName)) {
        setCapturingId(null);
        if (onToast) {
          onToast(isRu ? 'Эту клавишу бот нажать не может' : 'The bot cannot press this key');
        }
        return;
      }

      if (isClearTargetBind) setClearTargetError(false);
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

  const handleResetKeybinds = () => {
    soundFx.playClick();
    setCapturingId(null);
    setClearTargetError(false);
    onSettingsChange({
      ...settings,
      previousTargetKey: 'H',
      startStopKey: 'F5',
      interactKey: 'G',
      clearTargetKey: isRu ? 'Э' : "'",
      pauseKey: 'PAUSE',
      herbSearchKey: 'F9',
      oreSearchKey: 'F10',
    });
    if (onToast) {
      onToast(isRu ? 'Горячие клавиши сброшены' : 'Keybinds restored to defaults');
    }
  };

  const handleResetSchedule = () => {
    soundFx.playClick();
    onScheduleSettingsChange({ ...DEFAULT_SCHEDULE_SETTINGS });
    if (onToast) {
      onToast(isRu ? 'Расписание сброшено по умолчанию' : 'Schedule restored to defaults');
    }
  };

  const handleResetAutoRoute = () => {
    soundFx.playClick();
    onSettingsChange({
      ...settings,
      autoRouteMinutes: 30,
    });
    if (onToast) {
      onToast(isRu ? 'Длина автомаршрута сброшена (30 мин)' : 'Auto route length reset (30 min)');
    }
  };

  const tabs: {
    id: SettingsSubTab;
    labelRu: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    hasAlert?: boolean;
  }[] = [
    { id: 'keybinds', labelRu: 'Клавиши', labelEn: 'Keybinds', icon: Keyboard },
    { id: 'schedule', labelRu: 'Расписание', labelEn: 'Schedule', icon: Clock, hasAlert: Boolean(scheduleError) },
    { id: 'autoroute', labelRu: 'Автомаршрут', labelEn: 'Auto Route', icon: Route },
    { id: 'auction', labelRu: 'Аукцион', labelEn: 'Auction', icon: Coins },
  ];

  const keybindGroups: KeybindGroup[] = [
    {
      id: 'bot',
      titleRu: 'Управление ботом',
      titleEn: 'Bot controls',
      items: [
        {
          id: 'startStopKey',
          nameRu: 'Старт / Стоп',
          nameEn: 'Start / Stop',
          hintRu: 'Клавиша самого бота — в игре настраивать не нужно',
          hintEn: 'Bot hotkey — nothing to set in game',
          defaultVal: 'F5',
        },
        {
          id: 'pauseKey',
          nameRu: 'Пауза',
          nameEn: 'Pause',
          hintRu: 'Клавиша самого бота: нажал — бот отпускает клавиши и ждёт, ещё раз — продолжает ту же сессию. Совсем остановить — кнопка «Стоп». В игре настраивать не нужно',
          hintEn: 'Bot key: press to release keys and pause, press again to resume the session. To stop completely, use the "Stop" button. No in-game setup needed',
          defaultVal: 'PAUSE',
        },
      ],
    },
    {
      id: 'game',
      titleRu: 'В игре и выбор цели',
      titleEn: 'In-game & targeting',
      items: [
        {
          id: 'previousTargetKey',
          nameRu: 'Предыдущая цель',
          nameEn: 'Previous Target',
          hintRu: 'В игре: Параметры → Управление → Выбор цели → «Предыдущая цель»',
          hintEn: 'In game: Options → Controls → Targeting → Target Last Target',
          defaultVal: 'H',
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
          hintRu: 'Одна клавиша без Ctrl/Shift. Её назначает аддон при входе в игру; поменял — /reload в игре.',
          hintEn: 'Single key, no Ctrl/Shift. The addon binds it on login; changed it — /reload in game.',
          defaultVal: isRu ? 'Э' : "'",
        },
      ],
    },
    {
      id: 'tracking',
      titleRu: 'Поиск ресурсов',
      titleEn: 'Resource tracking',
      tourAttr: 'settings-radar',
      items: [
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
      ],
    },
  ];

  return (
    <div className="flex flex-col gap-5 w-full select-none text-zinc-900 dark:text-zinc-100 font-sans pb-24">
      {/* =========================================================================
          GAME-STYLE TOP CATEGORY BAR (Strict underline + icons)
          ========================================================================= */}
      <div
        data-tour="settings-tabs"
        role="tablist"
        aria-label={isRu ? 'Разделы настроек' : 'Settings categories'}
        className="flex items-center gap-1 sm:gap-2 border-b border-black/10 dark:border-white/10 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              id={`settings-tab-${tab.id}`}
              onClick={() => handleSelectSubTab(tab.id)}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-mono transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-white rounded-t-lg ${
                isActive
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors duration-150 ${
                  isActive
                    ? 'text-zinc-950 dark:text-white'
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <span>{isRu ? tab.labelRu : tab.labelEn}</span>
              {tab.hasAlert && (
                <AlertTriangle
                  className="w-3.5 h-3.5 text-red-500 shrink-0"
                  aria-label={isRu ? 'Есть ошибка валидации' : 'Validation error'}
                />
              )}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-950 dark:bg-white dark:shadow-[0_0_8px_rgba(255,255,255,0.65)]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB PANEL 1: КЛАВИШИ (Global Hotkeys & Keybinds)
          ========================================================================= */}
      {activeSubTab === 'keybinds' && (
        <div
          id="settings-panel-keybinds"
          role="tabpanel"
          aria-labelledby="settings-tab-keybinds"
          className="flex flex-col gap-5 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-mono font-semibold text-zinc-950 dark:text-white">
                {isRu ? 'Глобальные горячие клавиши' : 'Global hotkeys'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isRu
                  ? 'Нажмите на клавишу справа для привязки · Backspace — очистить · Esc — отмена'
                  : 'Click a keycap on the right to rebind · Backspace to clear · Esc to cancel'}
              </p>
            </div>

            <SpecularButton
              onClick={handleResetKeybinds}
              className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono whitespace-nowrap shrink-0"
              title={isRu ? 'Сбросить все клавиши по умолчанию' : 'Reset all hotkeys to defaults'}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
            </SpecularButton>
          </div>

          <div data-tour="settings-keybinds" className="flex flex-col gap-5">
            {keybindGroups.map((group) => (
              <div key={group.id} data-tour={group.tourAttr} className="flex flex-col gap-2">
                <div className="flex items-center gap-3 pb-1 border-b border-black/[0.06] dark:border-white/[0.07]">
                  <h3 className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                    {isRu ? group.titleRu : group.titleEn}
                  </h3>
                </div>

                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => {
                    const rawVal = settings[item.id];
                    const currentKey = rawVal !== undefined ? rawVal : item.defaultVal;
                    const isCapturing = capturingId === item.id;
                    const itemTourAttr = item.id === 'pauseKey' ? 'settings-pause' : undefined;

                    return (
                      <SpecularCard
                        key={item.id}
                        data-tour={itemTourAttr}
                        className={`p-3 sm:p-3.5 rounded-xl border transition-colors duration-150 ${
                          isCapturing
                            ? 'border-zinc-950 dark:border-white bg-black/[0.03] dark:bg-white/[0.05]'
                            : 'border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent'
                        }`}
                      >
                        <div className="flex flex-col w-full">
                          <div className="flex items-center justify-between w-full gap-4">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white tracking-wide">
                                {isRu ? item.nameRu : item.nameEn}
                              </span>
                              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-snug mt-0.5 break-words">
                                {isRu ? item.hintRu : item.hintEn}
                              </span>
                            </div>

                            <div className="relative shrink-0 ml-auto flex items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  soundFx.playClick();
                                  if (item.id === 'clearTargetKey') {
                                    setClearTargetError(false);
                                  }
                                  setCapturingId(isCapturing ? null : item.id);
                                }}
                                className={`min-w-[78px] h-8 px-3 rounded-lg border font-mono font-bold text-xs uppercase flex items-center justify-center transition-colors duration-150 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:focus-visible:ring-white ${
                                  isCapturing
                                    ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white animate-pulse bg-black/5 dark:bg-white/10'
                                    : currentKey
                                    ? 'border-black/15 dark:border-white/15 hover:border-black/35 dark:hover:border-white/40 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white bg-transparent'
                                    : 'border-dashed border-black/15 dark:border-white/10 text-zinc-400 dark:text-zinc-600 hover:border-zinc-400 dark:hover:border-white/30'
                                }`}
                                title={isRu ? 'Нажмите для привязки клавиши' : 'Click to rebind key'}
                              >
                                <span className="tracking-widest">
                                  {isCapturing ? (isRu ? 'ЖМИ…' : 'KEY…') : `[${currentKey || '—'}]`}
                                </span>
                              </button>
                            </div>
                          </div>

                          {item.id === 'clearTargetKey' && clearTargetError && (
                            <p className="text-xs text-red-400 font-mono mt-1.5">
                              {isRu
                                ? 'Нужна одна клавиша без Ctrl/Shift, не Esc/Enter/Tab/ пробел'
                                : 'Single key without Ctrl/Shift, not Esc/Enter/Tab/Space'}
                            </p>
                          )}
                        </div>
                      </SpecularCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB PANEL 2: РАСПИСАНИЕ (Farm Schedule Settings)
          ========================================================================= */}
      {activeSubTab === 'schedule' && (
        <div
          id="settings-panel-schedule"
          role="tabpanel"
          aria-labelledby="settings-tab-schedule"
          data-tour="settings-schedule"
          className="flex flex-col gap-4 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-mono font-semibold text-zinc-950 dark:text-white">
                {isRu ? 'Расписание фарма' : 'Farm schedule'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isRu
                  ? 'Общие переключатели расписания; окна по дням настраиваются в разделе «Расписание»'
                  : 'Global schedule switches; daily time windows are configured in the Schedule section'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onNavigateToSchedule && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onNavigateToSchedule();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 bg-transparent text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono whitespace-nowrap shrink-0"
                >
                  <span>{isRu ? 'Открыть график' : 'Open schedule'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              )}

              <SpecularButton
                onClick={handleResetSchedule}
                className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono whitespace-nowrap shrink-0"
                title={isRu ? 'Сбросить параметры расписания' : 'Reset schedule to default'}
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
              </SpecularButton>
            </div>
          </div>

          {scheduleError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs flex items-center gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="leading-snug">{scheduleError}</span>
            </div>
          )}

          {/* Enable Toggle */}
          <SpecularCard className="p-3.5 sm:p-4 rounded-xl border border-black/10 dark:border-white/[0.08] bg-transparent">
            <div className="flex items-center justify-between gap-4 w-full">
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
                role="switch"
                aria-checked={scheduleSettings.enabled}
                onClick={() => {
                  soundFx.playClick();
                  onScheduleSettingsChange({
                    ...scheduleSettings,
                    enabled: !scheduleSettings.enabled,
                  });
                }}
                className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
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

          {/* Off Day Chance (offDayPercent: 0..50) */}
          {scheduleSettings.enabled && (
            <SpecularCard className="p-3.5 sm:p-4 rounded-xl border border-black/10 dark:border-white/[0.08] bg-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
                <div>
                  <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Шанс случайного выходного' : 'Random day off chance'}
                  </span>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                    {isRu ? 'Вероятность дополнительного дня отдыха (0–50%)' : 'Probability of an additional day off (0–50%)'}
                  </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={scheduleSettings.offDayPercent ?? 0}
                    onChange={(e) =>
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        offDayPercent: Math.max(0, Math.min(50, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-16 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold tabular-nums text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-zinc-500">%</span>
                </div>
              </div>
            </SpecularCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB PANEL 3: АВТОМАРШРУТ (Auto Route Settings)
          ========================================================================= */}
      {activeSubTab === 'autoroute' && (
        <div
          id="settings-panel-autoroute"
          role="tabpanel"
          aria-labelledby="settings-tab-autoroute"
          data-tour="settings-autoroute"
          className="flex flex-col gap-4 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-mono font-semibold text-zinc-950 dark:text-white">
                {isRu ? 'Автоматический маршрут' : 'Auto route'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isRu
                  ? 'Параметры автоматического построения круга вокруг персонажа'
                  : 'Settings for automatic loop generation around the character'}
              </p>
            </div>

            <SpecularButton
              onClick={handleResetAutoRoute}
              className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono whitespace-nowrap shrink-0"
              title={isRu ? 'Сбросить длину автомаршрута' : 'Reset auto route length'}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
            </SpecularButton>
          </div>

          <SpecularCard className="p-4 sm:p-5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-transparent">
            <div className="flex flex-col gap-3.5 w-full">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                  {isRu ? 'Длина автомаршрута, мин' : 'Auto route length, min'}
                </span>
                <div className="flex items-baseline gap-1 font-mono text-sm font-bold tabular-nums text-zinc-950 dark:text-white">
                  <span>{settings.autoRouteMinutes ?? 30}</span>
                  <span className="text-xs text-zinc-500 font-normal">{isRu ? 'мин' : 'min'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono tabular-nums text-zinc-400">30</span>
                <input
                  type="range"
                  min={30}
                  max={120}
                  step={5}
                  value={settings.autoRouteMinutes ?? 30}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onSettingsChange({
                      ...settings,
                      autoRouteMinutes: val,
                    });
                  }}
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer h-1.5 bg-black/10 dark:bg-white/15 rounded-full"
                />
                <span className="text-[11px] font-mono tabular-nums text-zinc-400">120</span>
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono leading-relaxed pt-1 border-t border-black/[0.06] dark:border-white/[0.07]">
                {isRu
                  ? 'Если рядом нет записанного маршрута, бот сам построит круг по местам руды и трав от места запуска (около минуты стоит на месте) и сохранит его как «Автомаршрут».'
                  : 'If there is no recorded route nearby, the bot will automatically build a loop along ore and herb spots from the start location (stands still for ~1 minute) and save it as "Auto Route".'}
              </p>
            </div>
          </SpecularCard>
        </div>
      )}

      {/* =========================================================================
          TAB PANEL 4: АУКЦИОН (Auction Prices)
          ========================================================================= */}
      {activeSubTab === 'auction' && (
        <div
          id="settings-panel-auction"
          role="tabpanel"
          aria-labelledby="settings-tab-auction"
          data-tour="settings-auction"
          className="flex flex-col gap-4 animate-fadeIn"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-mono font-semibold text-zinc-950 dark:text-white">
                {isRu ? 'Цены аукциона' : 'Auction prices'}
              </h2>
              <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isRu
                  ? 'Источник рыночных цен для оценки добычи, фильтра лута и журнала продаж'
                  : 'Market price source used for loot valuation, drop filter, and sales log'}
              </p>
            </div>

            {priceStatus?.configured && (
              <SpecularButton
                onClick={handleRefreshPrices}
                disabled={isPriceLoading || priceStatus.loading}
                className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-black/25 dark:hover:border-white/25 bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono whitespace-nowrap shrink-0 disabled:opacity-50"
                title={isRu ? 'Обновить цены аукциона' : 'Refresh auction prices'}
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isPriceLoading || priceStatus.loading ? 'animate-spin' : ''}`}
                  strokeWidth={1.5}
                />
                <span>{isRu ? 'Обновить цены' : 'Refresh prices'}</span>
              </SpecularButton>
            )}
          </div>

          {!priceStatus ? (
            <SpecularCard className="p-4 rounded-xl border border-black/10 dark:border-white/[0.08] bg-transparent">
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                <span>{isRu ? 'Загрузка статуса аукциона…' : 'Loading auction status…'}</span>
              </div>
            </SpecularCard>
          ) : !priceStatus.configured ? (
            <SpecularCard className="p-4 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col gap-2 font-mono">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{priceStatus.keys_error || (isRu ? 'Ключи Blizzard API не настроены' : 'Blizzard API keys not configured')}</span>
              </div>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {isRu
                  ? 'Скопируй .env.example в .env (папка бота) и впиши ключи API Blizzard'
                  : 'Copy .env.example to .env (bot folder) and enter Blizzard API keys'}
              </p>
            </SpecularCard>
          ) : (
            <SpecularCard className="p-4 sm:p-5 rounded-xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col gap-4 font-mono">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs sm:text-sm font-medium text-zinc-950 dark:text-white">
                    {isRu ? 'Аукционный дом' : 'Auction House'}
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    {isRu ? 'Регион: ' : 'Region: '}
                    <strong className="text-zinc-800 dark:text-zinc-200 uppercase font-semibold">
                      {priceStatus.region || '—'}
                    </strong>
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 items-start sm:items-end w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <select
                      value={settings.auctionHouseId != null ? String(settings.auctionHouseId) : ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Number(e.target.value);
                        onSettingsChange({
                          ...settings,
                          auctionHouseId: val,
                        });
                      }}
                      className="w-full sm:w-80 px-3 py-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-xs font-mono text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white cursor-pointer"
                    >
                      <option value="" className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                        {isRu ? 'Авто — по персонажу в игре (рекомендуется)' : 'Auto — by in-game character (recommended)'}
                      </option>
                      {priceStatus.houses.map((house) => (
                        <option key={house.id} value={house.id} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
                          {house.name} — {getRulesetLabel(house.ruleset, isRu)} (№{house.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {getHouseSourceText() && (
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono text-left sm:text-right max-w-sm">
                      {getHouseSourceText()}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-black/10 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-zinc-500 tabular-nums">
                <div className="flex items-center gap-2">
                  <span>
                    {isRu ? 'Цены обновлены: ' : 'Prices updated: '}
                    <strong className="text-zinc-800 dark:text-zinc-200">
                      {priceStatus.updated_at_ms
                        ? new Date(priceStatus.updated_at_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : (isRu ? 'ещё нет' : 'not yet')}
                    </strong>
                  </span>

                  {priceStatus.items > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{priceStatus.items} {isRu ? 'предметов' : 'items'}</span>
                    </>
                  )}
                </div>

                {(isPriceLoading || priceStatus.loading) && (
                  <div className="flex items-center gap-1.5 text-amber-500 font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{isRu ? 'обновляю…' : 'updating…'}</span>
                  </div>
                )}
              </div>

              {priceStatus.error && (
                <div className="text-[11px] text-red-500 dark:text-red-400 font-medium pt-1">
                  {priceStatus.error}
                </div>
              )}
            </SpecularCard>
          )}
        </div>
      )}

      {/* Quiet Sync Info Footer */}
      <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.07] text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
        <span className="leading-snug">
          {isRu
            ? 'Все настройки и расписание синхронизируются автоматически в файл конфигурации бота и активны в фоновом режиме.'
            : 'All settings and schedule automatically synchronize with bot configuration and run active in background.'}
        </span>
      </div>
    </div>
  );
};
