import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { ComboSequence } from './components/ComboSequence';
import { SettingsView } from './components/SettingsView';
import { RoutesView } from './components/RoutesView';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { SessionSummaryData, AppSettings, RouteRecordStoppedDetail, ALLOWED_MINIMAP_ZOOM_KEYS } from './types';
import {
  Play,
  Square,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings,
  Layers,
  Compass,
  Swords,
  Pickaxe,
} from 'lucide-react';
import { Language, Theme, translations } from './utils/i18n';

export const App: React.FC = () => {
  // Combo Chains (Dynamic rotation & customizable steps)
  const [chains, setChains] = useState<ComboChain[]>(() => {
    const saved = localStorage.getItem('wowbot_rotation');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            steps: (c.steps || []).map((s: any, idx: number) => ({
              id: s.id || `step_${idx + 1}`,
              key: s.key || '',
              castTimeSeconds: s.castTimeSeconds ?? 1.5,
              repeatCount: s.repeatCount ?? 1,
              independent: Boolean(s.independent),
              skillCooldownSeconds: s.skillCooldownSeconds != null ? Number(s.skillCooldownSeconds) : 0,
              actionType: 'press' as const,
            }))
          }));
        }
      } catch (e) {}
    }
    return DEFAULT_COMBO_CHAINS;
  });

  // Bot execution and bridge states
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Floating Toast Notifications (top right corner, 5s timeout, dismiss on click)
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error' | 'info'; message: string }[]>([]);

  const addToast = useCallback((toast: { type: 'success' | 'error' | 'info'; message: string }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Theme & Language Settings
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('wowbot_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('wowbot_lang');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });

  // Active View: 'rotation' | 'routes' | 'settings'
  const [activeView, setActiveView] = useState<'rotation' | 'routes' | 'settings'>('rotation');

  // Исходный объект settings из бэкенда (сохраняем неизвестные фронту поля)
  const rawLoadedSettingsRef = useRef<Record<string, any>>({});

  // App Settings (default previousTargetKey: 'H', mode: 'grind', minimapZoomInKey: 'PAGEUP', minimapZoomOutKey: 'PAGEDOWN')
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('wowbot_settings');
    let prevKey = 'H';
    let mode: 'grind' | 'gather' = 'grind';
    let zoomIn = 'PAGEUP';
    let zoomOut = 'PAGEDOWN';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.previousTargetKey !== undefined && typeof parsed.previousTargetKey === 'string') {
          prevKey = parsed.previousTargetKey;
        }
        if (parsed.mode === 'grind' || parsed.mode === 'gather') {
          mode = parsed.mode;
        }
        if (typeof parsed.minimapZoomInKey === 'string') {
          zoomIn = parsed.minimapZoomInKey;
        }
        if (typeof parsed.minimapZoomOutKey === 'string') {
          zoomOut = parsed.minimapZoomOutKey;
        }
      } catch (e) {}
    }
    return {
      previousTargetKey: prevKey,
      mode,
      minimapZoomInKey: zoomIn,
      minimapZoomOutKey: zoomOut,
    };
  });

  useEffect(() => {
    localStorage.setItem('wowbot_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('wowbot_theme', theme);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('wowbot_lang', language);
  }, [language]);

  const t = translations[language];
  const isDark = theme === 'dark';

  // Session Summary
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null);
  const lastShownStoppedAtMsRef = useRef<number | null>(null);

  const [activeCasting, setActiveCasting] = useState<{ chainId: string; stepId: string } | null>(null);
  const isInitialMount = useRef<boolean>(true);

  // 1) Session Summary: listener for "wowbot:session-summary" and initial get_last_session()
  useEffect(() => {
    const handleSummaryEvent = (e: any) => {
      const data: SessionSummaryData = e?.detail;
      if (data && data.stopped_at_ms !== lastShownStoppedAtMsRef.current) {
        lastShownStoppedAtMsRef.current = data.stopped_at_ms;
        setSessionSummary(data);
      }
    };

    window.addEventListener('wowbot:session-summary', handleSummaryEvent);

    const checkLastSession = async () => {
      if (typeof window !== 'undefined' && window.pywebview?.api?.get_last_session) {
        try {
          const last = await window.pywebview.api.get_last_session();
          if (last && last.stopped_at_ms !== lastShownStoppedAtMsRef.current) {
            lastShownStoppedAtMsRef.current = last.stopped_at_ms;
            setSessionSummary(last);
          }
        } catch (err) {
          console.warn('get_last_session check warning:', err);
        }
      }
    };

    if (typeof window !== 'undefined' && window.pywebview?.api?.get_last_session) {
      checkLastSession();
    } else {
      window.addEventListener('pywebviewready', checkLastSession, { once: true });
    }

    return () => {
      window.removeEventListener('wowbot:session-summary', handleSummaryEvent);
      window.removeEventListener('pywebviewready', checkLastSession);
    };
  }, []);

  // Route record auto-stopped listener: "wowbot:route-record-stopped"
  useEffect(() => {
    const handleRouteStopped = (e: any) => {
      const detail: RouteRecordStoppedDetail = e?.detail;
      if (detail) {
        const reason = detail.reason || 'авто';
        if (detail.route) {
          addToast({
            type: 'success',
            message: `Запись остановилась сама (${reason}). Маршрут «${detail.route.name}» сохранён`,
          });
        } else {
          addToast({
            type: 'error',
            message: `Запись остановилась (${reason}). ${detail.error || 'Маршрут не сохранён'}`,
          });
        }
      }
    };

    window.addEventListener('wowbot:route-record-stopped', handleRouteStopped);
    return () => {
      window.removeEventListener('wowbot:route-record-stopped', handleRouteStopped);
    };
  }, [addToast]);

  // 2) Status polling: sync bot running and chat_running from get_status()
  useEffect(() => {
    let isCancelled = false;

    const pollStatus = async () => {
      if (typeof window !== 'undefined' && window.pywebview?.api?.get_status) {
        try {
          const res = await window.pywebview.api.get_status();
          if (!isCancelled && res) {
            if (typeof res.running === 'boolean' && !isStarting && !isStopping) {
              setIsBotRunning(res.running);
            }
          }
        } catch (err) {
          console.warn('get_status poll error:', err);
        }
      }
    };

    pollStatus();
    window.addEventListener('pywebviewready', pollStatus, { once: true });
    const interval = setInterval(pollStatus, 2000);
    return () => {
      isCancelled = true;
      window.removeEventListener('pywebviewready', pollStatus);
      clearInterval(interval);
    };
  }, [isStarting, isStopping]);

  // Восстанавливаем цепочки из бэкенда через load_config()
  useEffect(() => {
    const fetchConfig = () => {
      if (!window.pywebview?.api?.load_config) return;
      window.pywebview.api.load_config().then((res) => {
        if (!res.ok || !res.config) return;
        const cfg = res.config;

        if (Array.isArray(cfg.chains) && cfg.chains.length > 0 && Array.isArray(cfg.chains[0]?.steps)) {
          setChains([
            {
              id: 'chain_1',
              name: 'Ротация умений',
              order: 1,
              cooldown: 0,
              triggerAfterChainId: 'always',
              steps: cfg.chains[0].steps.map((s: any, idx: number) => ({
                id: `step_${idx + 1}`,
                key: s.key || '',
                castTimeSeconds: s.castTimeSeconds ?? 1.5,
                repeatCount: s.repeatCount ?? 1,
                independent: Boolean(s.independent),
                skillCooldownSeconds: s.skillCooldownSeconds != null ? Number(s.skillCooldownSeconds) : 0,
                hpBelowPercent: s.hpBelowPercent != null ? Number(s.hpBelowPercent) : null,
                actionType: 'press' as const,
              })),
            }
          ]);
        }

        if (cfg.settings && typeof cfg.settings === 'object') {
          rawLoadedSettingsRef.current = { ...cfg.settings };
          const loadedMode = (cfg.settings.mode === 'grind' || cfg.settings.mode === 'gather')
            ? cfg.settings.mode
            : undefined;
          const loadedPrevKey = typeof cfg.settings.previousTargetKey === 'string'
            ? cfg.settings.previousTargetKey
            : undefined;
          const loadedZoomIn = typeof cfg.settings.minimapZoomInKey === 'string'
            ? cfg.settings.minimapZoomInKey
            : undefined;
          const loadedZoomOut = typeof cfg.settings.minimapZoomOutKey === 'string'
            ? cfg.settings.minimapZoomOutKey
            : undefined;

          setSettings(curr => ({
            ...curr,
            ...(loadedPrevKey !== undefined ? { previousTargetKey: loadedPrevKey } : {}),
            ...(loadedMode !== undefined ? { mode: loadedMode } : {}),
            ...(loadedZoomIn !== undefined ? { minimapZoomInKey: loadedZoomIn } : {}),
            ...(loadedZoomOut !== undefined ? { minimapZoomOutKey: loadedZoomOut } : {}),
          }));
        }
      }).catch((err) => {
        console.warn('load_config: не удалось восстановить конфигурацию', err);
      });
    };

    if (window.pywebview?.api?.load_config) {
      fetchConfig();
    } else {
      const handleReady = () => fetchConfig();
      window.addEventListener('pywebviewready', handleReady, { once: true });
      return () => window.removeEventListener('pywebviewready', handleReady);
    }
  }, []);

  // Auto-dismiss notifications
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('wowbot_rotation', JSON.stringify(chains));
  }, [chains]);

  // Backend config format: {settings: {...rawLoadedSettings, previousTargetKey, mode, minimapZoomInKey, minimapZoomOutKey}, chains: [{steps: [...]}]}
  const generateConfigObject = useCallback((customChains = chains, customSettings = settings) => {
    const mainChain = customChains[0] || { steps: [] };
    const safeMode = (customSettings.mode === 'grind' || customSettings.mode === 'gather')
      ? customSettings.mode
      : 'grind';
    return {
      settings: {
        ...rawLoadedSettingsRef.current,
        previousTargetKey: customSettings.previousTargetKey || 'H',
        mode: safeMode,
        minimapZoomInKey: customSettings.minimapZoomInKey !== undefined ? customSettings.minimapZoomInKey : 'PAGEUP',
        minimapZoomOutKey: customSettings.minimapZoomOutKey !== undefined ? customSettings.minimapZoomOutKey : 'PAGEDOWN',
      },
      chains: [
        {
          steps: (mainChain.steps || []).map((s) => ({
            key: s.key || '',
            castTimeSeconds: s.castTimeSeconds ?? 1.5,
            skillCooldownSeconds: s.skillCooldownSeconds ?? 0,
            repeatCount: s.repeatCount ?? 1,
            independent: Boolean(s.independent),
            hpBelowPercent: s.hpBelowPercent != null ? Number(s.hpBelowPercent) : null,
          })),
        },
      ],
    };
  }, [chains, settings]);

  // Backend Bridge: save_config(jsonString) autosave safeguard
  const saveCurrentConfigToBackend = async (customChains = chains, customSettings = settings) => {
    const safeMode = (customSettings.mode === 'grind' || customSettings.mode === 'gather')
      ? customSettings.mode
      : 'grind';
    rawLoadedSettingsRef.current = {
      ...rawLoadedSettingsRef.current,
      previousTargetKey: customSettings.previousTargetKey || 'H',
      mode: safeMode,
      minimapZoomInKey: customSettings.minimapZoomInKey !== undefined ? customSettings.minimapZoomInKey : 'PAGEUP',
      minimapZoomOutKey: customSettings.minimapZoomOutKey !== undefined ? customSettings.minimapZoomOutKey : 'PAGEDOWN',
    };
    const configObj = generateConfigObject(customChains, customSettings);
    const configJson = JSON.stringify(configObj, null, 2);
    if (window.pywebview?.api?.save_config) {
      try {
        await window.pywebview.api.save_config(configJson);
      } catch (err: any) {
        console.warn('save_config auto-save warning:', err);
      }
    } else {
      localStorage.setItem('wowbot_rotation', JSON.stringify(customChains));
      localStorage.setItem('wowbot_settings', JSON.stringify(customSettings));
    }
  };

  // Переключение режима «Гринд» / «Сбор» с мгновенным сохранением в save_config
  const handleModeChange = (newMode: 'grind' | 'gather') => {
    if (isBotRunning || settings.mode === newMode) return;
    const updatedSettings: AppSettings = {
      ...settings,
      mode: newMode,
    };
    setSettings(updatedSettings);
    saveCurrentConfigToBackend(chains, updatedSettings);
  };

  // Автосохранение [chains] на диск с debounce ~600мс
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const timer = setTimeout(() => {
      saveCurrentConfigToBackend();
    }, 600);

    return () => clearTimeout(timer);
  }, [chains]);

  // Backend Bridge: start_bot() with autosave safeguard
  const handleStartBot = async () => {
    if (isBotRunning || isStarting) return;
    setErrorMessage(null);
    setIsStarting(true);

    await saveCurrentConfigToBackend();

    if (window.pywebview?.api?.start_bot) {
      try {
        const result = await window.pywebview.api.start_bot();
        if (result.ok || result.error === "already_running") {
          setIsBotRunning(true);
        } else {
          setErrorMessage(result.error || "Не удалось запустить бота");
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Ошибка связи с backend-мостом");
      } finally {
        setIsStarting(false);
      }
    } else {
      console.warn("pywebview API недоступен в превью браузера");
      setTimeout(() => {
        setIsBotRunning(true);
        setIsStarting(false);
      }, 250);
    }
  };

  // Backend Bridge: stop_bot()
  const handleStopBot = async () => {
    if (!isBotRunning || isStopping) return;
    setErrorMessage(null);
    setIsStopping(true);

    if (window.pywebview?.api?.stop_bot) {
      try {
        const result = await window.pywebview.api.stop_bot();
        if (result.ok) {
          setIsBotRunning(false);
          setActiveCasting(null);
        } else {
          setErrorMessage(result.error || "Не удалось остановить бота");
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "Ошибка связи с backend-мостом");
      } finally {
        setIsStopping(false);
      }
    } else {
      setTimeout(() => {
        setIsBotRunning(false);
        setActiveCasting(null);
        setIsStopping(false);
        // Preview session summary test event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('wowbot:session-summary', {
              detail: {
                started_at_ms: Date.now() - 3600000,
                stopped_at_ms: Date.now(),
                duration_s: 3600,
                kills: 142,
                kills_per_hour: 142,
                avg_kill_gap_s: 18.2,
                lost: 2,
                stop_reason: 'user',
              },
            })
          );
        }
      }, 250);
    }
  };

  // Export JSON file download (wowbot_rotation.json)
  const handleExportJson = () => {
    saveCurrentConfigToBackend();
    const output = generateConfigObject();
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wowbot_rotation.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Global F5 key shortcut for Start / Stop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (isBotRunning) {
          handleStopBot();
        } else {
          handleStartBot();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBotRunning, isStarting, isStopping]);

  // Visual casting rotation simulation in preview while bot is running
  useEffect(() => {
    if (!isBotRunning || chains.length === 0) {
      setActiveCasting(null);
      return;
    }

    let isCancelled = false;

    const runSimulationLoop = async () => {
      while (!isCancelled) {
        for (const chain of chains) {
          if (isCancelled) break;
          for (const step of chain.steps) {
            if (isCancelled) break;
            const holdMs = Math.max(350, (step.castTimeSeconds ?? 1.5) * 600);

            setActiveCasting({ chainId: chain.id, stepId: step.id });
            await new Promise((res) => setTimeout(res, holdMs));
            if (isCancelled) break;
            setActiveCasting(null);
            await new Promise((res) => setTimeout(res, 150));
          }
        }
      }
    };

    runSimulationLoop();

    return () => {
      isCancelled = true;
      setActiveCasting(null);
    };
  }, [isBotRunning, chains]);

  return (
    <div className={`min-h-screen w-full flex flex-col items-center justify-start sm:justify-center p-1 sm:p-2 md:p-3 lg:p-4 transition-colors duration-200 overflow-x-hidden ${
      isDark ? 'bg-black text-zinc-300 selection:bg-zinc-700 selection:text-white' : 'bg-[#eef0f4] text-zinc-800 selection:bg-blue-200 selection:text-blue-900'
    }`}>
      {/* Window Card - Responsive and adapts fluidly to window enlargement/reduction */}
      <div
        id="app-window-card"
        className={`w-full max-w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl rounded-xl sm:rounded-2xl flex flex-col relative max-h-[99vh] sm:max-h-[96vh] my-auto transition-all duration-350 ease-[cubic-bezier(0.4,0,0.2,1)] border ${
          isDark
            ? 'bg-[#07070a] border-zinc-800/90 shadow-[0_0_50px_rgba(0,0,0,0.95),0_0_25px_rgba(255,255,255,0.03)]'
            : 'bg-white border-zinc-200/90 shadow-[0_10px_35px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]'
        }`}
      >
        {/* Compact & Responsive Header matching image_ba356a08.png */}
        <header className="px-2.5 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 rounded-t-xl sm:rounded-t-2xl shrink-0 border-b border-zinc-800/80 bg-[#06080d] transition-colors flex-wrap sm:flex-nowrap">
          {/* Left: Animated Logo */}
          <div className="flex items-center shrink-0 pl-0.5 sm:pl-1">
            <span className="logo-shimmer font-mono text-sm sm:text-base font-black tracking-[0.2em] sm:tracking-[0.24em] uppercase select-none cursor-default text-cyan-400">
              EZF
            </span>
            <span className="ml-2 text-[10px] sm:text-[11px] font-mono text-zinc-500 uppercase tracking-wider font-bold">
              WOW FOREVER
            </span>
          </div>

          {/* Center: Single Continuous Segmented Control [ ⊞ Ротация ] [ 🧭 Маршруты ] [ ⚔️ Гринд ] [ ⛏️ Сбор ] */}
          <div className="p-0.5 rounded-lg border border-cyan-900/60 bg-[#070b12] flex items-center shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] shrink-0">
            {/* Ротация */}
            <button
              type="button"
              onClick={() => setActiveView('rotation')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[10.5px] sm:text-[11px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                activeView === 'rotation'
                  ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                  : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ротация</span>
            </button>

            {/* Маршруты */}
            <button
              type="button"
              onClick={() => setActiveView('routes')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[10.5px] sm:text-[11px] font-mono font-bold tracking-wider transition-all duration-150 cursor-pointer select-none active:scale-95 ${
                activeView === 'routes'
                  ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                  : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Маршруты</span>
            </button>

            {/* Гринд */}
            <button
              type="button"
              disabled={isBotRunning}
              onClick={() => handleModeChange('grind')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[10.5px] sm:text-[11px] font-mono font-bold tracking-wider transition-all duration-150 select-none ${
                isBotRunning ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'
              } ${
                settings.mode === 'grind'
                  ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                  : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
              }`}
              title={isBotRunning ? 'Режим применяется при старте' : undefined}
            >
              <Swords className="w-3.5 h-3.5 text-cyan-400" />
              <span>Гринд</span>
            </button>

            {/* Сбор */}
            <button
              type="button"
              disabled={isBotRunning}
              onClick={() => handleModeChange('gather')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-md text-[10.5px] sm:text-[11px] font-mono font-bold tracking-wider transition-all duration-150 select-none ${
                isBotRunning ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'
              } ${
                settings.mode === 'gather'
                  ? 'bg-[#0c1626] text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.4)] border border-cyan-400 font-black'
                  : 'text-zinc-400 hover:text-cyan-200 border border-transparent'
              }`}
              title={isBotRunning ? 'Режим применяется при старте' : undefined}
            >
              <Pickaxe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Сбор</span>
            </button>
          </div>

          {/* Right Action Controls: [ • ▶ СТАРТ ] [ ⤓ ] [ ⚙ ] */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Start / Stop Button with F5 Keybind */}
            {isBotRunning ? (
              <button
                onClick={handleStopBot}
                disabled={isStopping}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer border select-none disabled:opacity-50 active:scale-95 bg-gradient-to-r from-[#190a12] via-[#240e1b] to-[#190a12] text-rose-300 border-rose-500/80 hover:border-rose-400 hover:text-rose-100 hover:shadow-[0_0_18px_rgba(244,63,94,0.45)] shadow-[0_0_10px_rgba(244,63,94,0.25)] animate-pulse"
                title={t.stopTitle}
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                </span>
                {isStopping ? (
                  <Loader2 className="w-3 h-3 text-rose-200 animate-spin" />
                ) : (
                  <Square className="w-2.5 h-2.5 fill-current" />
                )}
                <span className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider">
                  {isStopping ? t.stopping : t.stop}
                </span>
              </button>
            ) : (
              <button
                onClick={handleStartBot}
                disabled={isStarting}
                className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer border select-none disabled:opacity-50 active:scale-95 bg-gradient-to-r from-[#061019] via-[#091b2c] to-[#061019] text-cyan-300 border-cyan-400/80 hover:border-cyan-300 hover:text-cyan-100 hover:shadow-[0_0_18px_rgba(6,182,212,0.5)] shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                title={t.startTitle}
              >
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.9)]"></span>
                </span>
                {isStarting ? (
                  <Loader2 className="w-3 h-3 text-cyan-200 animate-spin" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-current drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
                )}
                <span className="text-[10.5px] sm:text-[11px] font-black uppercase tracking-wider">
                  {isStarting ? t.starting : t.start}
                </span>
              </button>
            )}

            {/* Download JSON backup */}
            <button
              onClick={handleExportJson}
              className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border border-cyan-900/60 bg-[#070b12] hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] text-cyan-300 flex items-center justify-center transition-all duration-200 cursor-pointer select-none active:scale-95"
              title={t.exportJson}
            >
              <Download className="w-3.5 h-3.5 drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
            </button>

            {/* Settings Tab Button */}
            <button
              type="button"
              onClick={() => setActiveView((curr) => (curr === 'settings' ? 'rotation' : 'settings'))}
              className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg border flex items-center justify-center transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                activeView === 'settings'
                  ? 'bg-[#0c1626] border-cyan-400 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.7)] ring-1 ring-cyan-400'
                  : 'bg-[#070b12] border-cyan-900/60 hover:border-cyan-400 hover:bg-[#0c1626] hover:shadow-[0_0_12px_rgba(6,182,212,0.4)] text-cyan-300'
              }`}
              title={t.settings}
            >
              <Settings
                className={`w-3.5 h-3.5 transition-transform duration-300 ${
                  activeView === 'settings' ? 'rotate-90 text-cyan-200' : ''
                } drop-shadow-[0_0_6px_rgba(6,182,212,0.5)]`}
              />
            </button>
          </div>
        </header>

        {/* Floating Status / Error Notifications */}
        {errorMessage && (
          <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-[#1a1215] border border-zinc-600 text-zinc-200 text-xs flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-zinc-300 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-zinc-400 hover:text-white font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-[#111116] border border-zinc-600 text-zinc-200 text-xs flex items-center justify-between shadow-[0_0_20px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-zinc-300 shrink-0" />
              <span className="font-medium">{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-zinc-400 hover:text-white font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Content: Rotation Sequence OR Routes View OR Settings View */}
        <main className="p-2 sm:p-3 w-full flex flex-col overflow-y-auto min-h-0 flex-1">
          {activeView === 'settings' ? (
            <SettingsView
              settings={settings}
              onSettingsChange={(newSettings) => {
                setSettings(newSettings);
                saveCurrentConfigToBackend(chains, newSettings);
              }}
              onBack={() => setActiveView('rotation')}
              onNavigateToRoutes={() => setActiveView('routes')}
              onExportJson={handleExportJson}
              language={language}
              onLanguageChange={setLanguage}
              theme={theme}
              onThemeChange={setTheme}
              onToast={(msg) => addToast({ type: 'success', message: msg })}
            />
          ) : activeView === 'routes' ? (
            <RoutesView
              isBotRunning={isBotRunning}
              onToast={addToast}
              onError={(msg) => addToast({ type: 'error', message: msg })}
            />
          ) : (
            <ComboSequence
              chains={chains}
              onChainsChange={setChains}
              activeCasting={activeCasting}
              isBotRunning={isBotRunning}
              onToast={(msg) => addToast({ type: 'success', message: msg })}
              onError={(msg) => addToast({ type: 'error', message: msg })}
              language={language}
              theme={theme}
            />
          )}
        </main>
      </div>

      {/* Floating Toast Notifications in top-right corner (5s auto-dismiss, click to dismiss) */}
      <div className="fixed top-3 right-3 z-50 flex flex-col gap-1.5 max-w-sm pointer-events-none select-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`px-3 py-2 rounded-lg border text-xs font-mono shadow-[0_0_20px_rgba(0,0,0,0.95)] cursor-pointer pointer-events-auto flex items-start gap-2 transition-transform active:scale-95 animate-fadeIn ${
              toast.type === 'success'
                ? 'bg-[#061810] border-emerald-500/70 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-[#1a0a0f] border-rose-500/70 text-rose-200'
                : 'bg-[#12141a] border-zinc-700/80 text-zinc-300'
            }`}
            title="Нажмите, чтобы закрыть"
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug flex-1">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Session Summary Modal */}
      <SessionSummaryModal
        data={sessionSummary}
        onClose={() => setSessionSummary(null)}
        language={language}
        theme={theme}
      />
    </div>
  );
};
