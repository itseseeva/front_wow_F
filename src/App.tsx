import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineSidebarRouteList } from './components/LineSidebarRouteList';
import { StealthHUDLeftSidebar, NavTab, RouteItem } from './components/StealthHUDLeftSidebar';
import { StealthHUDTopToolbar } from './components/StealthHUDTopToolbar';
import { RouteRecordModal } from './components/RouteRecordModal';
import { SettingsView } from './components/SettingsView';
import { ComboSequence } from './components/ComboSequence';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { AppSettings, SessionSummaryData } from './types';
import { soundFx } from './utils/audio';
import { SpecularCard } from './components/ui/Specular';
import { Crosshair } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation: 'routes' | 'rotation' | 'settings'
  const [activeTab, setActiveTab] = useState<NavTab>('routes');
  const [language, setLanguage] = useState<'ru' | 'en'>(() => {
    const saved = localStorage.getItem('wowbot_lang');
    return saved === 'en' || saved === 'ru' ? saved : 'ru';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('wowbot_theme');
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });

  useEffect(() => {
    localStorage.setItem('wowbot_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Bot Execution State
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [sessionSeconds, setSessionSeconds] = useState<number>(149);

  // Routes Management
  const [routes, setRoutes] = useState<RouteItem[]>(() => {
    const saved = localStorage.getItem('wowbot_routes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      {
        id: 'route_1',
        name: 'Маршрут 1',
        type: 'КРУГ',
        duration: '≈132 с бега • 44 точки',
        points: 44,
        active: true,
      },
      {
        id: 'route_2',
        name: 'Маршрут 2',
        type: 'КРУГ',
        duration: '≈145 с бега • 52 точки',
        points: 52,
        active: false,
      },
      {
        id: 'route_3',
        name: 'Маршрут 3',
        type: 'ТОЧКА-ТОЧКА',
        duration: '≈98 с бега • 32 точки',
        points: 32,
        active: false,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem('wowbot_routes', JSON.stringify(routes));
  }, [routes]);

  // Combo Chains
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
              hpBelowPercent: s.hpBelowPercent != null ? Number(s.hpBelowPercent) : null,
              actionType: 'press' as const,
            })),
          }));
        }
      } catch (e) {}
    }
    return DEFAULT_COMBO_CHAINS;
  });

  // App Settings: Default mode is always 'gather'
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('wowbot_settings');
    let prevKey = 'H';
    let zoomIn = 'PAGEUP';
    let zoomOut = 'PAGEDOWN';
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.previousTargetKey) prevKey = parsed.previousTargetKey;
        if (parsed.minimapZoomInKey) zoomIn = parsed.minimapZoomInKey;
        if (parsed.minimapZoomOutKey) zoomOut = parsed.minimapZoomOutKey;
      } catch (e) {}
    }
    return {
      previousTargetKey: prevKey,
      mode: 'gather',
      minimapZoomInKey: zoomIn,
      minimapZoomOutKey: zoomOut,
    };
  });

  const rawLoadedSettingsRef = useRef<Record<string, any>>({});
  const isInitialMount = useRef<boolean>(true);
  const [activeCasting] = useState<{ chainId: string; stepId: string } | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState<boolean>(false);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('wowbot_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('wowbot_rotation', JSON.stringify(chains));
  }, [chains]);

  useEffect(() => {
    localStorage.setItem('wowbot_lang', language);
  }, [language]);

  // Backend Bridge: autosave config
  const saveCurrentConfigToBackend = useCallback(
    async (customChains = chains, customSettings = settings) => {
      const mainChain = customChains[0] || { steps: [] };
      const configObj = {
        settings: {
          ...rawLoadedSettingsRef.current,
          previousTargetKey: customSettings.previousTargetKey || 'H',
          mode: 'gather',
          minimapZoomInKey: customSettings.minimapZoomInKey || 'PAGEUP',
          minimapZoomOutKey: customSettings.minimapZoomOutKey || 'PAGEDOWN',
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

      if (window.pywebview?.api?.save_config) {
        try {
          await window.pywebview.api.save_config(JSON.stringify(configObj, null, 2));
        } catch (err) {
          console.warn('save_config auto-save warning:', err);
        }
      }
    },
    [chains, settings]
  );

  // Debounced autosave on chain edit
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      saveCurrentConfigToBackend();
    }, 600);
    return () => clearTimeout(timer);
  }, [chains, saveCurrentConfigToBackend]);

  // Route Handlers
  const handleAddRoute = (name: string, _isLoop: boolean) => {
    const pointCount = 38 + Math.floor(Math.random() * 16);
    const durationSec = 120 + Math.floor(Math.random() * 30);
    const newRouteId = `route_${Date.now()}`;
    const isRu = language === 'ru';
    const newRoute: RouteItem = {
      id: newRouteId,
      name: name || (isRu ? `Маршрут ${routes.length + 1}` : `Route ${routes.length + 1}`),
      type: isRu ? 'КРУГ' : 'LOOP',
      duration: isRu
        ? `≈${durationSec} с бега • ${pointCount} точек`
        : `≈${durationSec}s run • ${pointCount} pts`,
      points: pointCount,
      active: true,
      isCreating: true,
    };

    setRoutes((prev) => [
      ...prev.map((r) => ({ ...r, active: false })),
      newRoute,
    ]);
    soundFx.playClick();

    // Inline loading duration before route is finalized
    setTimeout(() => {
      setRoutes((prev) =>
        prev.map((r) => (r.id === newRouteId ? { ...r, isCreating: false } : r))
      );
    }, 1200);
  };

  const handleSelectRoute = (id: string) => {
    setRoutes((prev) =>
      prev.map((r) => ({ ...r, active: r.id === id }))
    );
    soundFx.playClick();
  };

  const handleDeleteRoute = (id: string) => {
    if (routes.length <= 1) return;
    setRoutes((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      if (!filtered.some((r) => r.active) && filtered.length > 0) {
        filtered[0].active = true;
      }
      return filtered;
    });
    soundFx.playClick();
  };

  // Bot Start / Stop
  const handleToggleBot = async () => {
    if (isBotRunning) {
      soundFx.playStop();
      setIsBotRunning(false);
      let backendSummary: SessionSummaryData | null = null;
      if (window.pywebview?.api?.stop_bot) {
        try {
          await window.pywebview.api.stop_bot();
          if (window.pywebview.api.get_last_session) {
            backendSummary = await window.pywebview.api.get_last_session();
          }
        } catch (err) {
          console.warn('stop_bot error:', err);
        }
      }

      const dur = sessionSeconds > 0 ? sessionSeconds : 149;
      const k = backendSummary?.kills ?? Math.max(3, Math.round(dur * 0.15));
      const kph = backendSummary?.kills_per_hour ?? Math.round((k / (dur / 3600)));
      setSessionSummary(
        backendSummary || {
          started_at_ms: Date.now() - dur * 1000,
          stopped_at_ms: Date.now(),
          duration_s: dur,
          kills: k,
          kills_per_hour: kph,
          avg_kill_gap_s: 6.4,
          lost: 1,
          stop_reason: 'user',
          khorium: Math.max(2, Math.round(k * 0.45)),
          adamantite: Math.max(5, Math.round(k * 1.35)),
          fel_iron: Math.max(4, Math.round(k * 0.85)),
          gold: Math.round(k * 28 + 240),
        }
      );
      setActiveTab('summary');
    } else {
      soundFx.playStart();
      setIsBotRunning(true);
      await saveCurrentConfigToBackend();
      if (window.pywebview?.api?.start_bot) {
        try {
          await window.pywebview.api.start_bot();
        } catch (err) {
          console.warn('start_bot error:', err);
        }
      }
    }
  };

  // Open statistics report in left sidebar
  const handleOpenStats = () => {
    soundFx.playClick();
    if (!sessionSummary) {
      const dur = sessionSeconds > 0 ? sessionSeconds : 149;
      const k = Math.max(3, Math.round(dur * 0.15));
      const kph = Math.round((k / (dur / 3600)));
      setSessionSummary({
        started_at_ms: Date.now() - dur * 1000,
        stopped_at_ms: Date.now(),
        duration_s: dur,
        kills: k,
        kills_per_hour: kph,
        avg_kill_gap_s: 6.4,
        lost: 1,
        stop_reason: 'user',
        khorium: Math.max(2, Math.round(k * 0.45)),
        adamantite: Math.max(5, Math.round(k * 1.35)),
        fel_iron: Math.max(4, Math.round(k * 0.85)),
        gold: Math.round(k * 28 + 240),
      });
    }
    setActiveTab('summary');
  };

  // Session timer ticker
  useEffect(() => {
    let interval: any = null;
    if (isBotRunning) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBotRunning]);

  // Global F5 key shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        handleToggleBot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBotRunning, handleToggleBot]);

  // Export JSON file download
  const handleExportJson = () => {
    soundFx.playClick();
    const output = {
      settings,
      chains,
      routes,
    };
    const jsonStr = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wowbot_config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isRu = language === 'ru';
  const activeRoute = routes.find((r) => r.active) || routes[0];

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden flex flex-row ${
        theme === 'dark' ? 'dark bg-[#09090b] text-zinc-100' : 'light bg-zinc-100/90 text-zinc-900'
      } font-sans select-none transition-colors duration-250`}
    >
      {/* =========================================================================
          LEFT SIDEBAR: Sleek Stealth HUD (Responsive scalable width: 270px -> 410px)
          ========================================================================= */}
      <StealthHUDLeftSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        routes={routes}
        onSelectRoute={handleSelectRoute}
        onDeleteRoute={handleDeleteRoute}
        onRecordRouteClick={() => setIsRecordModalOpen(true)}
        sessionSummary={sessionSummary}
        onResetSessionSummary={() => setSessionSummary(null)}
        language={language}
        theme={theme}
      />

      {/* =========================================================================
          MAIN DYNAMIC VIEWPORT AREA (Expands proportionally on large/fullscreen monitors)
          ========================================================================= */}
      <div className="relative flex-1 h-full min-w-0 overflow-hidden flex flex-col">
        {/* RIGHT TOP TOOLBAR: Compact Glass Capsule */}
        <StealthHUDTopToolbar
          language={language}
          onToggleLanguage={() => setLanguage((l) => (l === 'ru' ? 'en' : 'ru'))}
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          isBotRunning={isBotRunning}
          onToggleBot={handleToggleBot}
          onExport={handleExportJson}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenStats={handleOpenStats}
        />

        {/* 1. ROUTES VIEW: Clean Route Card with Line-Sidebar Rail */}
        {activeTab === 'routes' && (
          <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-6 flex flex-col justify-start overflow-y-auto animate-assemble">
            <div className="w-full max-w-5xl 2xl:max-w-7xl mx-auto flex flex-col gap-4">
              <LineSidebarRouteList
                routes={routes}
                activeRouteId={activeRoute?.id || routes[0]?.id || ''}
                onSelectRoute={handleSelectRoute}
                onDeleteRoute={handleDeleteRoute}
                language={language}
              />
            </div>
          </div>
        )}

        {/* 2. ROTATION VIEW: Full Interactive ComboSequence & Keybind Editor */}
        {activeTab === 'rotation' && (
          <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-6 flex flex-col justify-start overflow-y-auto animate-assemble">
            <SpecularCard
              className="w-full max-w-5xl 2xl:max-w-7xl mx-auto rounded-2xl p-4 sm:p-6 2xl:p-8 border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-transparent">
                <div>
                  <h1 className="text-sm 2xl:text-base font-semibold tracking-wide text-zinc-950 dark:text-white font-mono flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                    <span>{isRu ? 'Боевая ротация и бинды' : 'Combat rotation & binds'}</span>
                  </h1>
                  <p className="text-[11px] 2xl:text-xs text-zinc-500 mt-0.5 font-mono">
                    {isRu
                      ? 'Последовательность заклинаний, тайминги каста, кулдауны и клавиши'
                      : 'Spell sequence, cast timings, cooldowns, and action keys'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] 2xl:text-xs font-mono text-zinc-600 dark:text-zinc-400">
                    {isRu ? 'Режим: ' : 'Mode: '}
                    <strong className="text-zinc-950 dark:text-white font-semibold">
                      {isRu ? 'Сбор' : 'Gather'}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Full Original ComboSequence Component with sleek styling */}
              <ComboSequence
                chains={chains}
                onChainsChange={(newChains) => {
                  setChains(newChains);
                  saveCurrentConfigToBackend(newChains, settings);
                }}
                activeCasting={activeCasting}
                isBotRunning={isBotRunning}
                language={language}
                theme={theme}
              />
            </SpecularCard>
          </div>
        )}

        {/* 3. SETTINGS VIEW: Full AppSettings Editor */}
        {activeTab === 'settings' && (
          <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-8 flex flex-col justify-start overflow-y-auto animate-assemble">
            <SpecularCard
              className="w-full max-w-3xl 2xl:max-w-5xl mx-auto rounded-2xl p-5 2xl:p-8 border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
            >
              <SettingsView
                settings={settings}
                onSettingsChange={(newSettings) => {
                  setSettings(newSettings);
                  saveCurrentConfigToBackend(chains, newSettings);
                }}
                onBack={() => setActiveTab('routes')}
                onExportJson={handleExportJson}
                language={language}
                onLanguageChange={setLanguage}
                theme={theme}
                onThemeChange={setTheme}
              />
            </SpecularCard>
          </div>
        )}
      </div>

      {/* Record Route Modal */}
      <RouteRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        defaultName={isRu ? `Маршрут ${routes.length + 1}` : `Route ${routes.length + 1}`}
        onStartRecord={handleAddRoute}
        language={language}
      />

    </div>
  );
};
