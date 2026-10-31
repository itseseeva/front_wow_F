import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LineSidebarRouteList } from './components/LineSidebarRouteList';
import { StealthHUDLeftSidebar, NavTab, RouteItem } from './components/StealthHUDLeftSidebar';
import { StealthHUDTopToolbar } from './components/StealthHUDTopToolbar';
import {
  mockStartRouteRecord,
  mockGetRouteRecordStatus,
  mockStopRouteRecord,
  mockSetActiveRoute,
  mockDeleteRoute,
} from './data/mockRoutes';
import { SettingsView } from './components/SettingsView';
import { ComboSequence } from './components/ComboSequence';
import { ComboChain, DEFAULT_COMBO_CHAINS } from './data/skillsLibrary';
import { AppSettings, SessionSummaryData } from './types';
import { soundFx } from './utils/audio';
import { SpecularCard } from './components/ui/Specular';
import { Crosshair, AlertTriangle, X, BarChart3, Clock, Sparkles, RotateCcw } from 'lucide-react';
import { getPywebviewApi } from './utils/pywebviewBridge';
import { SessionHeatmapCard } from './components/SessionHeatmapCard';
import { getMockSessionSummary } from './utils/mockHeatmap';

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    if (!globalError) return;
    const timer = setTimeout(() => {
      setGlobalError(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [globalError]);

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
  const [isMockSessionActive, setIsMockSessionActive] = useState<boolean>(false);
  const recordingTimerRef = useRef<any>(null);
  const recordingRouteIdRef = useRef<string | null>(null);

  const handleLoadTestExample = useCallback(() => {
    soundFx.playClick();
    const mock = getMockSessionSummary();
    setSessionSummary(mock);
    setIsMockSessionActive(true);
  }, []);

  const handleClearTestExample = useCallback(() => {
    soundFx.playClick();
    setSessionSummary(null);
    setIsMockSessionActive(false);
  }, []);

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
        if (res && res.ok && Array.isArray(res.routes)) {
          const isRu = language === 'ru';
          const mapped: RouteItem[] = res.routes.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
            duration: isRu
              ? `≈${r.length_s} с бега • ${r.points} точек`
              : `≈${r.length_s}s run • ${r.points} pts`,
            points: r.points,
            active: Boolean(res.active_id && r.id === res.active_id),
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

          if (backendSummary) {
            setSessionSummary(backendSummary);
            setActiveTab('summary');
          } else if (sessionSecondsRef.current > 0) {
            const dur = sessionSecondsRef.current;
            setSessionSummary({
              started_at_ms: Date.now() - dur * 1000,
              stopped_at_ms: Date.now(),
              duration_s: dur,
              kills: 0,
              kills_per_hour: 0,
              avg_kill_gap_s: null,
              lost: 0,
              stop_reason: 'auto',
            });
            setActiveTab('summary');
          }
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
  const handleSelectRoute = async (id: string) => {
    soundFx.playClick();
    try {
      const api = await getPywebviewApi();
      let res: { ok: boolean; error?: string } | null = null;
      if (api?.set_active_route) {
        res = await api.set_active_route(id);
      } else {
        res = await mockSetActiveRoute(id);
      }

      if (res && res.ok) {
        setRoutes((prev) =>
          prev.map((r) => ({ ...r, active: r.id === id }))
        );
      } else {
        const errMsg = res?.error || (language === 'ru' ? 'Не удалось выбрать маршрут' : 'Failed to select route');
        setGlobalError(errMsg);
      }
    } catch (err: any) {
      console.warn('set_active_route error:', err);
      setGlobalError(err?.message || (language === 'ru' ? 'Ошибка при выборе маршрута' : 'Error selecting route'));
    }
  };

  const handleDeleteRoute = async (id: string) => {
    soundFx.playClick();
    setRoutes((prev) => {
      const filtered = prev.filter((r) => r.id !== id);
      return filtered;
    });
    try {
      const api = await getPywebviewApi();
      if (api?.delete_route) {
        const res = await api.delete_route(id);
        if (res && !res.ok && res.error) {
          setGlobalError(res.error);
          fetchRoutes();
        }
      } else {
        await mockDeleteRoute(id);
      }
    } catch (e: any) {
      console.warn('delete_route error:', e);
    }
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
        const finalId = finalRoute?.id || activeRecId;

        // Replace temporary id with res.route.id and do NOT set active: true locally
        setRoutes((prev) =>
          prev.map((r) =>
            r.id === activeRecId
              ? {
                  ...r,
                  id: finalId,
                  name: finalRoute?.name || r.name,
                  isRecording: false,
                  isCreating: false,
                  points: pts,
                  duration: isRu
                    ? `≈${dur} с бега • ${pts} точек`
                    : `≈${dur}s run • ${pts} pts`,
                  type: finalRoute?.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
                }
              : r
          )
        );

        if (finalRoute?.id) {
          let setRes: { ok: boolean; error?: string } | null = null;
          if (api?.set_active_route) {
            setRes = await api.set_active_route(finalRoute.id);
          } else {
            setRes = await mockSetActiveRoute(finalRoute.id);
          }

          if (setRes && setRes.ok) {
            await fetchRoutes();
          } else if (setRes && !setRes.ok && setRes.error) {
            setGlobalError(setRes.error);
          }
        } else {
          await fetchRoutes();
        }
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
        const finalId = finalRoute.id || activeRecId;

        setRoutes((prev) =>
          prev.map((r) =>
            r.id === activeRecId
              ? {
                  ...r,
                  id: finalId,
                  name: finalRoute.name || r.name,
                  isRecording: false,
                  isCreating: false,
                  points: pts,
                  duration: isRu
                    ? `≈${dur} с бега • ${pts} точек`
                    : `≈${dur}s run • ${pts} pts`,
                  type: finalRoute.loop ? (isRu ? 'КРУГ' : 'LOOP') : (isRu ? 'ТОЧКА-ТОЧКА' : 'POINT-TO-POINT'),
                }
              : r
          )
        );

        getPywebviewApi().then(async (api) => {
          if (finalRoute?.id) {
            let setRes: { ok: boolean; error?: string } | null = null;
            if (api?.set_active_route) {
              setRes = await api.set_active_route(finalRoute.id);
            } else {
              setRes = await mockSetActiveRoute(finalRoute.id);
            }
            if (setRes && setRes.ok) {
              await fetchRoutes();
            } else if (setRes && !setRes.ok && setRes.error) {
              setGlobalError(setRes.error);
            }
          } else {
            await fetchRoutes();
          }
        });
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

  // Listen for backend session summary event: 'wowbot:session-summary'
  useEffect(() => {
    const handleSessionSummaryEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SessionSummaryData | null>;
      const detail = customEvent.detail;
      setSessionSummary(detail || null);
      setIsMockSessionActive(false);
      setIsBotRunning(false);
      setActiveTab('summary');
    };

    window.addEventListener('wowbot:session-summary', handleSessionSummaryEvent);
    return () => {
      window.removeEventListener('wowbot:session-summary', handleSessionSummaryEvent);
    };
  }, []);

  // Bot Start / Stop
  const handleToggleBot = async () => {
    const isRu = language === 'ru';
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

      setSessionSummary(backendSummary || null);
      setActiveTab('summary');
    } else {
      // 1. Check board connection and start bot via backend
      await saveCurrentConfigToBackend();

      if (api?.start_bot) {
        try {
          const res = await api.start_bot();
          if (!res || !res.ok) {
            soundFx.playStop();
            const errMsg = res?.error || (isRu
              ? 'Ошибка: плата управления не подключена'
              : 'Error: Controller board not connected');
            setGlobalError(errMsg);
            return;
          }
        } catch (err: any) {
          soundFx.playStop();
          setGlobalError(err?.message || (isRu
            ? 'Ошибка связи: плата не отвечает'
            : 'Connection error: board not responding'));
          return;
        }
      } else {
        // In browser mock mode: check if board is mock-connected
        const isMockBoardConnected = localStorage.getItem('wowbot_board_connected') !== 'false';
        if (!isMockBoardConnected) {
          soundFx.playStop();
          setGlobalError(isRu ? 'Ошибка: плата управления не подключена' : 'Error: Controller board not connected');
          return;
        }
      }

      // 2. Only if board connection and start succeed:
      setGlobalError(null);
      soundFx.playStart();
      setSessionSeconds(0);
      setIsBotRunning(true);
    }
  };

  // Open statistics report
  const handleOpenStats = async () => {
    soundFx.playClick();
    if (!sessionSummary) {
      try {
        const api = await getPywebviewApi();
        if (api?.get_last_session) {
          const s = await api.get_last_session();
          if (s) {
            setSessionSummary(s);
          }
        }
      } catch (err) {
        console.warn('get_last_session error:', err);
      }
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
      {/* Global Error Banner */}
      {globalError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red-950/95 border border-red-500/50 text-red-100 text-xs font-mono shadow-[0_12px_40px_rgba(239,68,68,0.35)] backdrop-blur-md animate-fadeIn select-none">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="ml-2 text-red-400 hover:text-white p-0.5 rounded cursor-pointer transition-colors"
            title={isRu ? 'Закрыть' : 'Close'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
                onRecordRoute={handleStartRouteRecord}
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

        {/* 4. SUMMARY VIEW: Detailed Session Analytics */}
        {activeTab === 'summary' && (
          <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-8 flex flex-col justify-start overflow-y-auto animate-assemble">
            <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto flex flex-col gap-4">
              <SpecularCard
                className="w-full rounded-2xl p-5 2xl:p-7 border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200"
              >
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/10 dark:border-white/10">
                  <div>
                    <h1 className="text-sm 2xl:text-base font-semibold tracking-wide text-zinc-950 dark:text-white font-mono flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                      <span>{isRu ? 'Итоги сессии' : 'Session Summary'}</span>
                    </h1>
                    <p className="text-[11px] 2xl:text-xs text-zinc-500 mt-0.5 font-mono">
                      {sessionSummary
                        ? (isMockSessionActive
                            ? (isRu ? 'Тестовый пример (демонстрация карты и размеров)' : 'Test example (map & layout preview)')
                            : (isRu
                                ? `Завершена в ${new Date(sessionSummary.stopped_at_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : `Finished at ${new Date(sessionSummary.stopped_at_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`))
                        : (isRu ? 'Статистика работы бота' : 'Bot telemetry summary')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {sessionSummary && (
                      <span className="text-[10px] 2xl:text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {isRu ? 'Длительность: ' : 'Duration: '}
                        <strong className="text-zinc-950 dark:text-white font-semibold">
                          {formatDuration(sessionSummary.duration_s)}
                        </strong>
                      </span>
                    )}

                    {sessionSummary && (
                      <button
                        type="button"
                        onClick={isMockSessionActive ? handleClearTestExample : handleLoadTestExample}
                        className="text-[11px] font-mono px-2.5 py-1 rounded-md border border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
                        title={isMockSessionActive ? (isRu ? 'Очистить тестовые данные' : 'Clear test data') : (isRu ? 'Загрузить тестовый пример' : 'Load test example')}
                      >
                        {isMockSessionActive ? (
                          <>
                            <RotateCcw className="w-3 h-3 text-zinc-400" />
                            <span>{isRu ? 'Сбросить тест' : 'Reset test'}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>{isRu ? 'Тестовый пример' : 'Test example'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {!sessionSummary ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-dashed border-zinc-400 dark:border-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                      <BarChart3 className="w-6 h-6" />
                    </div>
                    <span className="text-sm font-mono font-semibold text-zinc-600 dark:text-zinc-400">
                      {isRu ? 'нет данных' : 'no data'}
                    </span>
                    <span className="text-xs font-mono text-zinc-500 max-w-sm text-center leading-relaxed">
                      {isRu
                        ? 'Сессия еще не запускалась или данные отсутствуют. Нажмите кнопку ниже, чтобы загрузить тестовый пример и оценить реальные размеры карты.'
                        : 'Session has not run or no data is available. Click below to load a test example and inspect real heatmap dimensions.'}
                    </span>

                    {/* Test Example Button */}
                    <button
                      type="button"
                      onClick={handleLoadTestExample}
                      className="mt-2 px-4 py-2 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 font-mono text-xs font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-2 cursor-pointer border border-transparent hover:border-black/20 dark:hover:border-white/20"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isRu ? 'Тестовый пример (показать карту и размеры)' : 'Test example (show map & layout)'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-5">
                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                        <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Длительность' : 'Duration'}</span>
                        <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                          {formatDuration(sessionSummary.duration_s)}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                        <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Узлов собрано' : 'Nodes Gathered'}</span>
                        <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                          {sessionSummary.kills != null ? sessionSummary.kills : (isRu ? 'нет данных' : 'no data')}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                        <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Темп в час' : 'Pace / hour'}</span>
                        <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                          {sessionSummary.kills_per_hour != null ? `${sessionSummary.kills_per_hour}/ч` : (isRu ? 'нет данных' : 'no data')}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                        <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Пауза' : 'Avg Kill Gap'}</span>
                        <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                          {sessionSummary.avg_kill_gap_s != null ? `${sessionSummary.avg_kill_gap_s}с` : (isRu ? 'нет данных' : 'no data')}
                        </span>
                      </div>
                    </div>

                    {/* Resource breakdown */}
                    <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-2.5">
                      <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                        {isRu ? 'Добытые ресурсы' : 'Extracted Resources'}
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-zinc-500">{isRu ? 'Кориум' : 'Khorium'}</span>
                          <span className="text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                            {sessionSummary.khorium != null ? sessionSummary.khorium : (isRu ? 'нет данных' : 'no data')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-zinc-500">{isRu ? 'Адамантит' : 'Adamantite'}</span>
                          <span className="text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                            {sessionSummary.adamantite != null ? sessionSummary.adamantite : (isRu ? 'нет данных' : 'no data')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-zinc-500">{isRu ? 'Оскверн. железо' : 'Fel Iron'}</span>
                          <span className="text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                            {sessionSummary.fel_iron != null ? sessionSummary.fel_iron : (isRu ? 'нет данных' : 'no data')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-mono text-zinc-500">{isRu ? 'Золото' : 'Gold'}</span>
                          <span className="text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                            {sessionSummary.gold != null ? `+${sessionSummary.gold.toLocaleString()}g` : (isRu ? 'нет данных' : 'no data')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Additional info */}
                    <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-2 border-t border-black/10 dark:border-white/10">
                      <span>
                        {isRu ? 'Причина остановки:' : 'Stop Reason:'}{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {sessionSummary.stop_reason || (isRu ? 'нет данных' : 'no data')}
                        </strong>
                      </span>
                      <span>
                        {isRu ? 'Потеряно целей:' : 'Targets lost:'}{' '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {sessionSummary.lost != null ? sessionSummary.lost : (isRu ? 'нет данных' : 'no data')}
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </SpecularCard>

              {/* Session Heatmap Card directly below statistics in the same neat container */}
              {sessionSummary && (
                <SessionHeatmapCard
                  summary={sessionSummary}
                  language={language}
                  theme={theme}
                />
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
