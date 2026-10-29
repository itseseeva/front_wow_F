import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineSidebarRouteList } from './components/LineSidebarRouteList';
import { StealthHUDLeftSidebar, NavTab, RouteItem, ResourceFilterItem } from './components/StealthHUDLeftSidebar';
import { StealthHUDTopToolbar } from './components/StealthHUDTopToolbar';
import { CompactStatsBar } from './components/CompactStatsBar';
import { RouteRecordModal } from './components/RouteRecordModal';
import { SettingsView } from './components/SettingsView';
import { ComboSequence } from './components/ComboSequence';
import { SessionSummaryModal } from './components/SessionSummaryModal';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { AppSettings, SessionSummaryData } from './types';
import { soundFx } from './utils/audio';
import { SpecularCard, SpecularButton } from './components/ui/Specular';
import { Crosshair, Layers, Check } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation: 'routes' | 'rotation' | 'gather' | 'settings'
  const [activeTab, setActiveTab] = useState<NavTab>('routes');
  const [language, setLanguage] = useState<'ru' | 'en'>(() => {
    const saved = localStorage.getItem('wowbot_lang');
    return saved === 'en' || saved === 'ru' ? saved : 'ru';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isRouteVisible, setIsRouteVisible] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Bot Execution State
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [sessionSeconds, setSessionSeconds] = useState<number>(149);

  // Farming Telemetry Counters
  const [khoriumCount] = useState<number>(790);
  const [adamantiteCount] = useState<number>(1297);
  const [felIronCount] = useState<number>(98);
  const [goldEstimate] = useState<number>(56875);

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

  // Resource Filters State (monochrome palette)
  const [resourceFilters, setResourceFilters] = useState<ResourceFilterItem[]>([
    {
      id: 'khorium',
      name: 'Кориумная жила (Khorium)',
      nameEn: 'Khorium Vein',
      color: '#ffffff',
      enabled: true,
    },
    {
      id: 'adamantite',
      name: 'Залежи адамантита (Adamantite)',
      nameEn: 'Adamantite Deposit',
      color: '#d4d4d8',
      enabled: true,
    },
    {
      id: 'fel_iron',
      name: 'Оскверненное железо (Fel Iron)',
      nameEn: 'Fel Iron Deposit',
      color: '#a1a1aa',
      enabled: true,
    },
    {
      id: 'netherbloom',
      name: 'Пустоцвет (Netherbloom)',
      nameEn: 'Netherbloom',
      color: '#71717a',
      enabled: true,
    },
    {
      id: 'dreamfoil',
      name: 'Грозовой мак (Dreamfoil)',
      nameEn: 'Dreamfoil',
      color: '#52525b',
      enabled: true,
    },
  ]);

  const handleToggleResource = (id: string) => {
    soundFx.playClick();
    setResourceFilters((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

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
  const handleAddRoute = (name: string, isLoop: boolean) => {
    const pointCount = 38 + Math.floor(Math.random() * 16);
    const durationSec = 120 + Math.floor(Math.random() * 30);
    const newRoute: RouteItem = {
      id: `route_${Date.now()}`,
      name: name || `Маршрут ${routes.length + 1}`,
      type: isLoop ? 'КРУГ' : 'ТОЧКА-ТОЧКА',
      duration: `≈${durationSec} с бега • ${pointCount} точек`,
      points: pointCount,
      active: true,
    };

    setRoutes((prev) => [
      ...prev.map((r) => ({ ...r, active: false })),
      newRoute,
    ]);
    soundFx.playClick();
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
      if (window.pywebview?.api?.stop_bot) {
        try {
          await window.pywebview.api.stop_bot();
        } catch (err) {
          console.warn('stop_bot error:', err);
        }
      }
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
      className="relative w-screen h-screen overflow-hidden bg-[#09090b] text-zinc-100 font-sans select-none"
      style={{
        width: '100vw',
        height: '100vh',
      }}
    >

      {/* =========================================================================
          LEFT SIDEBAR: Sleek Stealth HUD (320px, 4 Core Tabs: Routes, Rotation, Filters, Settings)
          ========================================================================= */}
      <StealthHUDLeftSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        routes={routes}
        onSelectRoute={handleSelectRoute}
        onDeleteRoute={handleDeleteRoute}
        isRouteVisible={isRouteVisible}
        onToggleRouteVisible={() => setIsRouteVisible(!isRouteVisible)}
        onRecordRouteClick={() => setIsRecordModalOpen(true)}
        resourceFilters={resourceFilters}
        onToggleResource={handleToggleResource}
        language={language}
      />

      {/* =========================================================================
          RIGHT TOP TOOLBAR: Compact Glass Capsule
          ========================================================================= */}
      <StealthHUDTopToolbar
        language={language}
        onToggleLanguage={() => setLanguage((l) => (l === 'ru' ? 'en' : 'ru'))}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        isBotRunning={isBotRunning}
        onToggleBot={handleToggleBot}
        onExport={handleExportJson}
        onOpenSettings={() => setActiveTab('settings')}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundFx.toggleMute())}
      />

      {/* =========================================================================
          DYNAMIC RIGHT-SIDE VIEWPORT (Switches with 60 FPS Smooth Assembly)
          ========================================================================= */}
      <div
        className="absolute top-0 bottom-0 right-0 overflow-hidden"
        style={{
          left: '350px',
        }}
      >
        {/* 1. ROUTES VIEW: Clean Route Card with LatticeLoader & Quick Actions */}
        {activeTab === 'routes' && (
          <div className="relative w-full h-full p-4 sm:p-6 pt-14 pb-6 flex flex-col justify-start overflow-y-auto animate-assemble">
            <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
              {/* Minimal Line Sidebar Route List (strictly route name, no buttons) */}
              <LineSidebarRouteList
                routes={routes}
                activeRouteId={activeRoute?.id || routes[0]?.id || ''}
                onSelectRoute={handleSelectRoute}
                language={language}
              />

              {/* Compact Bottom Stats Bar */}
              <CompactStatsBar
                sessionSeconds={sessionSeconds}
                khoriumCount={khoriumCount}
                adamantiteCount={adamantiteCount}
                felIronCount={felIronCount}
                goldEstimate={goldEstimate}
                speedMultiplier={speedMultiplier}
                onSpeedChange={setSpeedMultiplier}
                language={language}
              />
            </div>
          </div>
        )}

        {/* 2. ROTATION VIEW: Full Interactive ComboSequence & Keybind Editor */}
        {activeTab === 'rotation' && (
          <div className="relative w-full h-full p-4 sm:p-6 pt-14 pb-6 flex flex-col justify-start overflow-y-auto animate-assemble">
            <SpecularCard
              className="w-full max-w-5xl mx-auto rounded-xl p-4 sm:p-5 border border-transparent hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-transparent">
                <div>
                  <h1 className="text-sm font-semibold tracking-wide text-white font-mono flex items-center gap-2">
                    <Crosshair className="w-4 h-4 text-zinc-300" strokeWidth={1.5} />
                    <span>{isRu ? 'Боевая ротация и бинды' : 'Combat rotation & binds'}</span>
                  </h1>
                  <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                    {isRu
                      ? 'Последовательность заклинаний, тайминги каста, кулдауны и клавиши'
                      : 'Spell sequence, cast timings, cooldowns, and action keys'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-zinc-400">
                    {isRu ? 'Режим: ' : 'Mode: '}
                    <strong className="text-white font-semibold">Сбор (Gather)</strong>
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

        {/* 3. GATHER / RESOURCE FILTERS VIEW */}
        {activeTab === 'gather' && (
          <div className="relative w-full h-full p-4 sm:p-6 pt-14 pb-6 flex flex-col justify-start overflow-y-auto animate-assemble">
            <div className="w-full max-w-5xl mx-auto flex flex-col gap-4">
              <SpecularCard
                className="w-full rounded-xl p-4 sm:p-5 border border-transparent hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-transparent">
                  <div>
                    <h1 className="text-sm font-semibold tracking-wide text-white font-mono flex items-center gap-2">
                      <Layers className="w-4 h-4 text-zinc-300" strokeWidth={1.5} />
                      <span>{isRu ? 'Фильтры ресурсов и радар жил' : 'Resource filters & radar'}</span>
                    </h1>
                    <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                      {isRu
                        ? 'Управление распознаванием руды и трав при автоматическом сборе'
                        : 'Manage ore and herb detection during automated gathering'}
                    </p>
                  </div>

                  <span className="text-[10px] font-mono text-zinc-400">
                    {isRu ? 'Режим: ' : 'Mode: '}
                    <strong className="text-white font-semibold">Сбор (Gather)</strong>
                  </span>
                </div>

                {/* 5 Filter Cards with Tactile Ghost Hover */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {resourceFilters.map((res) => (
                    <div
                      key={res.id}
                      onClick={() => handleToggleResource(res.id)}
                      className={`group p-3.5 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex flex-col justify-between cursor-pointer transition-all duration-150 ${
                        res.enabled ? 'opacity-100' : 'opacity-40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              res.enabled ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]' : 'bg-zinc-600'
                            }`}
                          />
                          <span className="text-xs font-medium text-white">
                            {isRu ? res.name : res.nameEn}
                          </span>
                        </div>

                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            res.enabled
                              ? 'text-white border-transparent'
                              : 'text-transparent border-transparent'
                          }`}
                        >
                          {res.enabled && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-transparent">
                        <span className="text-[10px] font-mono text-zinc-500">
                          {isRu ? 'Статус сбора' : 'Status'}
                        </span>
                        <span
                          className={`text-[10px] font-mono font-medium ${
                            res.enabled
                              ? 'text-white font-semibold'
                              : 'text-zinc-600'
                          }`}
                        >
                          {res.enabled ? (isRu ? 'Активен' : 'Enabled') : (isRu ? 'Отключен' : 'Disabled')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </SpecularCard>

              {/* Compact Bottom Stats Bar */}
              <CompactStatsBar
                sessionSeconds={sessionSeconds}
                khoriumCount={khoriumCount}
                adamantiteCount={adamantiteCount}
                felIronCount={felIronCount}
                goldEstimate={goldEstimate}
                speedMultiplier={speedMultiplier}
                onSpeedChange={setSpeedMultiplier}
                language={language}
              />
            </div>
          </div>
        )}

        {/* 4. SETTINGS VIEW: Full AppSettings Editor */}
        {activeTab === 'settings' && (
          <div className="relative w-full h-full p-6 pt-16 pb-8 flex flex-col justify-start overflow-y-auto animate-assemble">
            <SpecularCard
              className="w-full max-w-3xl mx-auto rounded-xl p-5 border border-transparent hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
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
        defaultName={`Маршрут ${routes.length + 1}`}
        onStartRecord={handleAddRoute}
        language={language}
      />

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
