import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { ComboSequence } from './components/ComboSequence';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { SessionSummaryData } from './types';
import {
  Play,
  Square,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon
} from 'lucide-react';
import { Language, Theme, translations } from './utils/i18n';

export const App: React.FC = () => {
  // Combo Chains (Dynamic chains & customizable steps)
  const [chains, setChains] = useState<ComboChain[]>(() => {
    const saved = localStorage.getItem('tl_combo_chains');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((c: any) => ({
            ...c,
            steps: (c.steps || []).map((s: any, idx: number) => ({
              id: s.id || `step_${idx + 1}`,
              key: s.key || s.slot || s.combo || (s.skill ? s.skill.name : '') || `${idx + 1}`,
              castTimeSeconds: s.castTimeSeconds ?? 0,
              repeatCount: s.repeatCount ?? 1,
              independent: Boolean(s.independent),
              skillCooldownSeconds: s.skillCooldownSeconds != null ? Number(s.skillCooldownSeconds) : 6,
              actionType: s.actionType || 'press',
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

  // Theme & Language Settings
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ezf_theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ezf_lang');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });

  useEffect(() => {
    localStorage.setItem('ezf_theme', theme);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ezf_lang', language);
  }, [language]);

  const t = translations[language];
  const isDark = theme === 'dark';

  // Session Summary
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null);
  const lastShownStoppedAtMsRef = useRef<number | null>(null);

  const [activeCasting, setActiveCasting] = useState<{ chainId: string; stepId: string } | null>(null);
  const isInitialMount = useRef<boolean>(true);

  // 1) Session Summary: listener for "easyfarm:session-summary" and initial get_last_session()
  useEffect(() => {
    const handleSummaryEvent = (e: any) => {
      const data: SessionSummaryData = e?.detail;
      if (data && data.stopped_at_ms !== lastShownStoppedAtMsRef.current) {
        lastShownStoppedAtMsRef.current = data.stopped_at_ms;
        setSessionSummary(data);
      }
    };

    window.addEventListener('easyfarm:session-summary', handleSummaryEvent);

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
      window.removeEventListener('easyfarm:session-summary', handleSummaryEvent);
      window.removeEventListener('pywebviewready', checkLastSession);
    };
  }, []);

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

  // Восстанавливаем цепочки из файла на диске (skills_config.json)
  useEffect(() => {
    const fetchConfig = () => {
      if (!window.pywebview?.api?.load_config) return;
      window.pywebview.api.load_config().then((res) => {
        if (!res.ok || !res.config) return;
        const cfg = res.config;

        if (Array.isArray(cfg.chains) && cfg.chains.length > 0) {
          setChains(
            cfg.chains.map((c: any) => ({
              id: c.id,
              name: c.name,
              order: c.order,
              cooldown: c.cooldownSeconds ?? (
                c.cooldownMinSeconds != null && c.cooldownMaxSeconds != null
                  ? (c.cooldownMinSeconds + c.cooldownMaxSeconds) / 2
                  : 0
              ),
              triggerAfterChainId: c.triggerAfter || 'start',
              steps: (c.steps || []).map((s: any, idx: number) => ({
                id: `${c.id}_step${s.stepIndex || idx + 1}`,
                key: s.key || s.slot || s.combo || (s.skillName && s.skillName !== 'None' ? s.skillName : '') || `${idx + 1}`,
                castTimeSeconds: s.castTimeSeconds ?? 0,
                repeatCount: s.repeatCount ?? 1,
                independent: Boolean(s.independent),
                skillCooldownSeconds: s.skillCooldownSeconds != null ? Number(s.skillCooldownSeconds) : 6,
                actionType: s.actionType || 'press',
              })),
            }))
          );
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
    localStorage.setItem('tl_combo_chains', JSON.stringify(chains));
  }, [chains]);

  // Full config object generator matching backend schema
  const generateConfigObject = useCallback((customChains = chains) => {
    return {
      "_README": "Конфигурация клавиатурных комбинаций и цепочек ротации для Throne and Liberty.",
      "exportDate": new Date().toISOString(),
      "mode": "keyboard",
      "totalChains": customChains.length,
      "chains": customChains.map(chain => ({
        id: chain.id,
        name: chain.name,
        order: chain.order,
        triggerAfter: chain.triggerAfterChainId,
        cooldownSeconds: chain.cooldown ?? 0,
        stepsCount: chain.steps.length,
        steps: chain.steps.map((s, idx) => {
          const stepData: any = {
            stepIndex: idx + 1,
            key: s.key || '',
            slot: s.key || '',
            combo: s.key || '',
            skillName: s.key ? `Key_${s.key}` : 'None',
            castTimeSeconds: s.castTimeSeconds ?? 0,
          };
          if (s.repeatCount && s.repeatCount > 1) {
            stepData.repeatCount = s.repeatCount;
          }
          if (s.actionType) {
            stepData.actionType = s.actionType;
          }
          const skillCd = typeof s.skillCooldownSeconds === 'number' ? s.skillCooldownSeconds : (typeof s.cooldown === 'number' ? s.cooldown : 0);
          stepData.skillCooldownSeconds = skillCd;
          stepData.cooldown = skillCd;
          stepData.independent = Boolean(s.independent);
          return stepData;
        })
      }))
    };
  }, [chains]);

  // Backend Bridge: save_config(jsonString) autosave safeguard
  const saveCurrentConfigToBackend = async (customChains = chains) => {
    const configObj = generateConfigObject(customChains);
    const configJson = JSON.stringify(configObj, null, 2);
    if (window.pywebview) {
      try {
        await window.pywebview.api.save_config(configJson);
      } catch (err: any) {
        console.warn('save_config auto-save warning:', err);
      }
    } else {
      localStorage.setItem('tl_combo_chains', JSON.stringify(customChains));
    }
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

    if (window.pywebview) {
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

    if (window.pywebview) {
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
            new CustomEvent('easyfarm:session-summary', {
              detail: {
                started_at_ms: Date.now() - 3600000,
                stopped_at_ms: Date.now(),
                duration_s: 3600,
                kills: 412,
                kills_per_hour: 412,
                avg_kill_gap_s: 8.7,
                lost: 9,
                stop_reason: 'user',
              },
            })
          );
        }
      }, 250);
    }
  };


  // Export JSON file download
  const handleExportJson = () => {
    saveCurrentConfigToBackend();
    const output = generateConfigObject();
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'throne_and_liberty_keyboard_combo.json';
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
            const holdMs = Math.max(350, (step.castTimeSeconds ?? 0) * 800);

            setActiveCasting({ chainId: chain.id, stepId: step.id });
            await new Promise((res) => setTimeout(res, holdMs));
            if (isCancelled) break;
            setActiveCasting(null);
            await new Promise((res) => setTimeout(res, 120));
          }
          if (!isCancelled && chain.cooldown > 0) {
            await new Promise((res) => setTimeout(res, Math.min(2500, chain.cooldown * 400)));
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
    <div className={`min-h-screen w-full flex flex-col justify-center items-center p-1 sm:p-2 md:p-4 transition-colors duration-200 ${
      isDark ? 'bg-black text-zinc-300 selection:bg-zinc-700 selection:text-white' : 'bg-[#eef0f4] text-zinc-800 selection:bg-blue-200 selection:text-blue-900'
    }`}>
      {/* Window Card */}
      <div
        id="app-window-card"
        className={`w-full max-w-[480px] rounded-2xl flex flex-col relative max-h-[98vh] sm:max-h-[96vh] transition-colors duration-200 border ${
          isDark
            ? 'bg-[#07070a] border-zinc-800/90 shadow-[0_0_50px_rgba(0,0,0,0.95),0_0_25px_rgba(255,255,255,0.03)]'
            : 'bg-white border-zinc-200/90 shadow-[0_10px_35px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]'
        }`}
      >
        {/* Compact Header */}
        <header className={`px-3 py-2 flex items-center justify-between gap-2 rounded-t-2xl shrink-0 border-b transition-colors ${
          isDark ? 'bg-[#0b0b0f] border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
        }`}>
          {/* Animated EZF Logo */}
          <div className="flex items-center shrink-0 pl-1">
            <span className="ezf-shimmer font-mono text-base font-black tracking-[0.24em] uppercase select-none cursor-default">
              EZF
            </span>
          </div>

          {/* Right Action Controls: Язык, Тема, Чат-бот, Старт/Стоп, Экспорт */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Language Switcher: RU / EN */}
            <button
              type="button"
              onClick={() => setLanguage(l => l === 'ru' ? 'en' : 'ru')}
              title={t.langToggle}
              className={`px-1.5 py-1 rounded-lg text-[10.5px] font-mono font-bold tracking-wider transition cursor-pointer select-none border flex items-center gap-0.5 ${
                isDark
                  ? 'bg-[#111118] hover:bg-[#1a1b24] text-zinc-300 hover:text-white border-zinc-700/80 hover:border-zinc-500'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-300 hover:border-zinc-400 shadow-xs'
              }`}
            >
              <span className={language === 'ru' ? (isDark ? 'text-blue-400 font-black' : 'text-blue-600 font-black') : 'opacity-40'}>RU</span>
              <span className="opacity-30">/</span>
              <span className={language === 'en' ? (isDark ? 'text-blue-400 font-black' : 'text-blue-600 font-black') : 'opacity-40'}>EN</span>
            </button>

            {/* Theme Switcher: Dark / Light */}
            <button
              type="button"
              onClick={() => setTheme(curr => curr === 'dark' ? 'light' : 'dark')}
              title={theme === 'dark' ? t.themeLight : t.themeDark}
              className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center justify-center ${
                isDark
                  ? 'bg-[#111118] hover:bg-[#1a1b24] text-amber-300 hover:text-amber-200 border-zinc-700/80 hover:border-zinc-500'
                  : 'bg-white hover:bg-zinc-100 text-zinc-700 hover:text-black border-zinc-300 hover:border-zinc-400 shadow-xs'
              }`}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-zinc-700" />
              )}
            </button>

            {/* Start / Stop Button */}
            {isBotRunning ? (
              <button
                onClick={handleStopBot}
                disabled={isStopping}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs transition cursor-pointer shadow border bg-[#181822] text-white border-zinc-400 hover:bg-[#22222e] disabled:opacity-50 shadow-[0_0_16px_rgba(255,255,255,0.35)] animate-pulse"
                title={t.stopTitle}
              >
                {isStopping ? (
                  <Loader2 className="w-3 h-3 text-zinc-200 animate-spin" />
                ) : (
                  <Square className="w-3 h-3 fill-zinc-100 text-zinc-100" />
                )}
                <span>{isStopping ? t.stopping : t.stop}</span>
              </button>
            ) : (
              <button
                onClick={handleStartBot}
                disabled={isStarting}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium text-xs transition cursor-pointer shadow border disabled:opacity-50 ${
                  isDark
                    ? 'bg-[#111116] hover:bg-[#1a1a22] text-zinc-100 border-zinc-700/80 hover:border-zinc-400 hover:shadow-[0_0_18px_rgba(255,255,255,0.25)]'
                    : 'bg-zinc-900 hover:bg-black text-white border-zinc-800 shadow-xs'
                }`}
                title={t.startTitle}
              >
                {isStarting ? (
                  <Loader2 className="w-3 h-3 text-zinc-300 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>{isStarting ? t.starting : t.start}</span>
              </button>
            )}

            {/* Download JSON backup */}
            <button
              onClick={handleExportJson}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/70 hover:shadow-[0_0_12px_rgba(255,255,255,0.15)] border-transparent hover:border-zinc-700'
                  : 'text-zinc-600 hover:text-black hover:bg-zinc-100 border-transparent hover:border-zinc-300 shadow-xs'
              }`}
              title={t.exportJson}
            >
              <Download className="w-3.5 h-3.5" />
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

        {/* Main Content: Minimalist Combo Sequence */}
        <main className="p-2 sm:p-3 w-full flex flex-col overflow-y-auto min-h-0 flex-1">
          <ComboSequence
            chains={chains}
            onChainsChange={setChains}
            activeCasting={activeCasting}
            isBotRunning={isBotRunning}
            onToast={setSuccessMessage}
            onError={setErrorMessage}
            language={language}
            theme={theme}
          />
        </main>
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
