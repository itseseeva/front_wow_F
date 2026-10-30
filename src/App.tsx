import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineSidebarRouteList } from './components/LineSidebarRouteList';
import { StealthHUDLeftSidebar, NavTab, RouteItem } from './components/StealthHUDLeftSidebar';
import { StealthHUDTopToolbar } from './components/StealthHUDTopToolbar';
import { mockStartRouteRecord, mockGetRouteRecordStatus, mockStopRouteRecord } from './data/mockRoutes';
import { SettingsView } from './components/SettingsView';
import { ComboSequence } from './components/ComboSequence';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { AppSettings, SessionSummaryData } from './types';
import { soundFx } from './utils/audio';
import { SpecularCard } from './components/ui/Specular';
import { Crosshair } from 'lucide-react';
import { getPywebviewApi } from './utils/pywebviewBridge';

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
  const isConfigLoadedRef = useRef<boolean>(false);
  const isBotRunningRef = useRef<boolean>(isBotRunning);
  const sessionSecondsRef = useRef<number>(sessionSeconds);
  const [activeCasting] = useState<{ chainId: string; stepId: string } | null>(null);
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryData | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const recordingRouteIdRef = useRef<string | null>(null);

  useEffect(() => {
    isBotRunningRef.current = isBotRunning;
  }, [isBotRunning]);

  useEffect(() => {
    sessionSecondsRef.current = sessionSeconds;
  }, [sessionSeconds]);

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

      try {
        const api = await getPywebviewApi();
        if (api?.save_config) {
          await api.save_config(JSON.stringify(configObj, null, 2));
        }
      } catch (err) {
        console.warn('save_config auto-save warning:', err);
      }
    },
    [chains, settings]
  );

  // Debounced autosave on chain edit (only after initial load_config completes)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (!isConfigLoadedRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveCurrentConfigToBackend();
    }, 600);
    return () => clearTimeout(timer);
  }, [chains, saveCurrentConfigToBackend]);

  // Fetch routes from backend
  const fetchRoutes = useCallback(async () => {
    try {
      const api = await getPywebviewApi();
      if (api?.list_routes) {
        const res = await api.list_routes();
        if (res && res.ok && Array.isArray(res.routes) && res.routes.length > 0) {
          const isRu = language === 'ru';
          const mapped: RouteItem[] = res.routes.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
            duration: isRu
              ? `≈${r.length_s} с бега • ${r.points} точек`
              : `≈${r.length_s}s run • ${r.points} pts`,
            points: r.points,
            active: res.active_id ? r.id === res.active_id : r.active,
          }));
          setRoutes(mapped);
        }
      }
    } catch (err) {
      console.warn('list_routes error:', err);
    }
  }, [language]);

  // 2) Load config on startup: call api.load_config() once
  useEffect(() => {
    let cancelled = false;

    const initConfig = async () => {
      try {
        const api = await getPywebviewApi();
        if (api?.load_config) {
          const res = await api.load_config();
          if (cancelled) return;

          if (res && res.ok && res.config) {
            let parsed = res.config;
            if (typeof parsed === 'string') {
              try {
                parsed = JSON.parse(parsed);
              } catch (e) {
                console.warn('load_config JSON parse error:', e);
              }
            }

            if (parsed && typeof parsed === 'object') {
              // Restore AppSettings
              if (parsed.settings) {
                rawLoadedSettingsRef.current = { ...parsed.settings };
                setSettings((prev) => ({
                  ...prev,
                  previousTargetKey: parsed.settings.previousTargetKey ?? prev.previousTargetKey,
                  mode: 'gather',
                  minimapZoomInKey: parsed.settings.minimapZoomInKey ?? prev.minimapZoomInKey,
                  minimapZoomOutKey: parsed.settings.minimapZoomOutKey ?? prev.minimapZoomOutKey,
                }));
              }

              // Restore ComboChains
              if (Array.isArray(parsed.chains) && parsed.chains.length > 0) {
                setChains((prev) =>
                  parsed.chains.map((chain: any, cIdx: number) => {
                    const existingChain = prev[cIdx] || DEFAULT_COMBO_CHAINS[0];
                    return {
                      ...existingChain,
                      id: chain.id || existingChain.id || `chain_${cIdx + 1}`,
                      name: chain.name || existingChain.name || (cIdx === 0 ? 'Основная ротация' : `Цепочка ${cIdx + 1}`),
                      steps: (chain.steps || []).map((step: any, sIdx: number) => ({
                        id: step.id || `step_${sIdx + 1}`,
                        key: step.key || '',
                        castTimeSeconds: step.castTimeSeconds ?? 1.5,
                        skillCooldownSeconds: step.skillCooldownSeconds != null ? Number(step.skillCooldownSeconds) : 0,
                        repeatCount: step.repeatCount ?? 1,
                        independent: Boolean(step.independent),
                        hpBelowPercent: step.hpBelowPercent != null ? Number(step.hpBelowPercent) : null,
                        actionType: 'press' as const,
                      })),
                    };
                  })
                );
              }
            }
          } else if (res && !res.ok) {
            console.warn('load_config error:', res.error);
          }
        }
      } catch (err) {
        console.warn('load_config error:', err);
      } finally {
        isConfigLoadedRef.current = true;
      }
    };

    initConfig();
    fetchRoutes();

    return () => {
      cancelled = true;
    };
  }, [fetchRoutes]);

  // 3) Bot status polling: call api.get_status() every 1 second
  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(async () => {
      try {
        const api = await getPywebviewApi();
        if (!api?.get_status) return;

        const status = await api.get_status();
        if (cancelled || !status) return;

        // If bot stopped on its own (running === false, but UI is currently in running state)
        if (isBotRunningRef.current && !status.running) {
          setIsBotRunning(false);
          soundFx.playStop();

          let backendSummary: SessionSummaryData | null = null;
          if (api.get_last_session) {
            try {
              backendSummary = await api.get_last_session();
            } catch (err) {
              console.warn('get_last_session error:', err);
            }
          }

          const dur = sessionSecondsRef.current > 0 ? sessionSecondsRef.current : 149;
          const k = backendSummary?.kills ?? Math.max(3, Math.round(dur * 0.15));
          const kph = backendSummary?.kills_per_hour ?? Math.round(k / (dur / 3600));
          setSessionSummary(
            backendSummary || {
              started_at_ms: Date.now() - dur * 1000,
              stopped_at_ms: Date.now(),
              duration_s: dur,
              kills: k,
              kills_per_hour: kph,
              avg_kill_gap_s: 6.4,
              lost: 1,
              stop_reason: 'auto',
              khorium: Math.max(2, Math.round(k * 0.45)),
              adamantite: Math.max(5, Math.round(k * 1.35)),
              fel_iron: Math.max(4, Math.round(k * 0.85)),
              gold: Math.round(k * 28 + 240),
            }
          );
          setActiveTab('summary');
        }
      } catch (err) {
        console.warn('get_status poll warning:', err);
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Route Selection & Deletion Handlers
  const handleSelectRoute = (id: string) => {
    setRoutes((prev) =>
      prev.map((r) => ({ ...r, active: r.id === id }))
    );
    soundFx.playClick();
    getPywebviewApi().then((api) => {
      if (api?.set_active_route) {
        api.set_active_route(id).catch((e) => console.warn('set_active_route error:', e));
      }
    });
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
    getPywebviewApi().then((api) => {
      if (api?.delete_route) {
        api.delete_route(id).catch((e) => console.warn('delete_route error:', e));
      }
    });
  };

  // Start inline route recording without popup window
  const handleStartRouteRecord = async () => {
    soundFx.playClick();
    const isRu = language === 'ru';
    const newRouteId = `route_${Date.now()}`;
    const defaultName = isRu ? `Маршрут ${routes.length + 1}` : `Route ${routes.length + 1}`;

    const newRoute: RouteItem = {
      id: newRouteId,
      name: defaultName,
      type: isRu ? 'КРУГ' : 'LOOP',
      duration: isRu ? 'идёт запись...' : 'recording...',
      points: 0,
      active: true,
      isRecording: true,
      recordingSeconds: 0,
    };

    recordingRouteIdRef.current = newRouteId;
    setRoutes((prev) => [
      ...prev.map((r) => ({ ...r, active: false })),
      newRoute,
    ]);

    try {
      const api = await getPywebviewApi();
      if (api?.start_route_record) {
        await api.start_route_record(defaultName);
      } else {
        await mockStartRouteRecord(defaultName);
      }
    } catch (err) {
      console.warn('start_route_record error:', err);
    }

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = setInterval(async () => {
      try {
        const api = await getPywebviewApi();
        let status: any = null;
        if (api?.get_route_record_status) {
          status = await api.get_route_record_status();
        } else {
          status = await mockGetRouteRecordStatus();
        }

        if (status) {
          setRoutes((prev) =>
            prev.map((r) =>
              r.id === newRouteId
                ? {
                    ...r,
                    points: status.points ? status.points.length : r.points,
                    recordingSeconds: status.seconds != null ? status.seconds : (r.recordingSeconds || 0) + 1,
                  }
                : r
            )
          );
        }
      } catch (e) {
        console.warn('record status poll warning:', e);
      }
    }, 1000);
  };

  // Stop inline route recording (Save)
  const handleSaveRecording = async (routeId?: string) => {
    soundFx.playClick();
    const activeRecId = routeId || recordingRouteIdRef.current;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingRouteIdRef.current = null;

    try {
      const api = await getPywebviewApi();
      let res: any = null;
      if (api?.stop_route_record) {
        res = await api.stop_route_record(true);
      } else {
        res = await mockStopRouteRecord(true);
      }

      if (res && res.ok) {
        const isRu = language === 'ru';
        const finalRoute = res.route;
        const pts = finalRoute?.points || 44;
        const dur = finalRoute?.length_s || 128;
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === activeRecId
              ? {
                  ...r,
                  name: finalRoute?.name || r.name,
                  isRecording: false,
                  isCreating: false,
                  points: pts,
                  duration: isRu
                    ? `≈${dur} с бега • ${pts} точек`
                    : `≈${dur}s run • ${pts} pts`,
                  type: finalRoute?.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
                  active: true,
                }
              : r
          )
        );
        fetchRoutes();
      }
    } catch (err) {
      console.warn('stop_route_record save error:', err);
    }
  };

  // Cancel inline route recording (Cancel)
  const handleCancelRecording = async (routeId?: string) => {
    soundFx.playClick();
    const activeRecId = routeId || recordingRouteIdRef.current;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingRouteIdRef.current = null;

    try {
      const api = await getPywebviewApi();
      if (api?.stop_route_record) {
        await api.stop_route_record(false);
      } else {
        await mockStopRouteRecord(false);
      }
    } catch (err) {
      console.warn('stop_route_record cancel error:', err);
    }

    setRoutes((prev) => {
      const filtered = prev.filter((r) => r.id !== activeRecId);
      if (filtered.length > 0 && !filtered.some((r) => r.active)) {
        filtered[0].active = true;
      }
      return filtered;
    });
  };

  // Listen for bot auto-stop of route recording
  useEffect(() => {
    const handleStopped = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const detail = customEvent.detail;
      const activeRecId = recordingRouteIdRef.current;
      if (!activeRecId) return;

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      recordingRouteIdRef.current = null;

      if (detail?.route) {
        const isRu = language === 'ru';
        const finalRoute = detail.route;
        const pts = finalRoute.points || 42;
        const dur = finalRoute.length_s || 130;
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === activeRecId
              ? {
                  ...r,
                  name: finalRoute.name || r.name,
                  isRecording: false,
                  isCreating: false,
                  points: pts,
                  duration: isRu
                    ? `≈${dur} с бега • ${pts} точек`
                    : `≈${dur}s run • ${pts} pts`,
                  type: finalRoute.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
                  active: true,
                }
              : r
          )
        );
        fetchRoutes();
      } else {
        setRoutes((prev) => {
          const filtered = prev.filter((r) => r.id !== activeRecId);
          if (filtered.length > 0 && !filtered.some((r) => r.active)) {
            filtered[0].active = true;
          }
          return filtered;
        });
      }
    };

    window.addEventListener('wowbot:route-record-stopped', handleStopped);
    return () => window.removeEventListener('wowbot:route-record-stopped', handleStopped);
  }, [fetchRoutes, language]);

  // Bot Start / Stop
  const handleToggleBot = async () => {
    const api = await getPywebviewApi();
    if (isBotRunning) {
      soundFx.playStop();
      setIsBotRunning(false);
      let backendSummary: SessionSummaryData | null = null;
      if (api?.stop_bot) {
        try {
          await api.stop_bot();
          if (api.get_last_session) {
            backendSummary = await api.get_last_session();
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
      if (api?.start_bot) {
        try {
          await api.start_bot();
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
        onRecordRouteClick={handleStartRouteRecord}
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
                onSaveRecording={handleSaveRecording}
                onCancelRecording={handleCancelRecording}
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
    </div>
  );
};
