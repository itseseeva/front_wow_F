import React, { useState, useEffect, useCallback } from 'react';
import { RouteInfo, TerrainStatus } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { RouteRecordModal } from './RouteRecordModal';
import { TerrainNotificationCard } from './TerrainNotificationCard';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockListRoutes,
  mockSetActiveRoute,
  mockDeleteRoute,
} from '../data/mockRoutes';
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Loader2,
  FolderOpen,
} from 'lucide-react';

interface RoutesViewProps {
  isBotRunning: boolean;
  onToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
  onError: (msg: string) => void;
  onTerrainStatus?: (routeName: string, terrain: TerrainStatus) => void;
  activeTerrainCard?: { routeName: string; initialTerrain: TerrainStatus } | null;
  onCloseTerrainCard?: () => void;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  isBotRunning,
  onToast,
  onError,
  onTerrainStatus,
  activeTerrainCard,
  onCloseTerrainCard,
}) => {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [dissolvingId, setDissolvingId] = useState<string | null>(null);

  // New route pending terrain generation before becoming available
  const [pendingRoute, setPendingRoute] = useState<{ id: string; name: string } | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Fetch routes from pywebview or mock
  const fetchRoutes = useCallback(async () => {
    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.list_routes) {
        res = await api.list_routes();
      } else {
        res = await mockListRoutes();
      }

      if (res.ok) {
        setRoutes(res.routes || []);
        setActiveId(res.active_id ?? null);
      } else {
        onError(res.error || 'Не удалось загрузить список маршрутов');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка загрузки маршрутов');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Listen for terrain readiness: ONLY after loading is ready, route appears in available list with animation!
  useEffect(() => {
    const handleTerrainEvent = (e: any) => {
      const detail: TerrainStatus = e?.detail;
      if (detail && detail.status === 'ready') {
        fetchRoutes().then(() => {
          if (pendingRoute) {
            setJustAddedId(pendingRoute.id);
            setPendingRoute(null);
            setTimeout(() => {
              setJustAddedId(null);
            }, 3500);
          }
        });
      }
    };

    window.addEventListener('wowbot:terrain-status', handleTerrainEvent);
    return () => {
      window.removeEventListener('wowbot:terrain-status', handleTerrainEvent);
    };
  }, [fetchRoutes, pendingRoute]);

  // Set active route (or null for auto)
  const handleSetActive = async (id: string | null) => {
    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.set_active_route) {
        res = await api.set_active_route(id);
      } else {
        res = await mockSetActiveRoute(id);
      }

      if (res.ok) {
        setActiveId(id);
        setRoutes((prev) =>
          prev.map((r) => ({
            ...r,
            active: id === null ? false : r.id === id,
          }))
        );
        onToast({
          type: 'success',
          message: id ? 'Маршрут выбран основным' : 'Включён автовыбор маршрута',
        });
      } else {
        onError(res.error || 'Ошибка выбора маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка выбора маршрута');
    }
  };

  // Immediate delete with 60 FPS GPU pillar curl & smooth grid height collapse
  const handleDeleteRoute = async (route: RouteInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dissolvingId === route.id) return;

    // Instantly launch the GPU curl animation and slot height collapse
    setDissolvingId(route.id);

    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.delete_route) {
        res = await api.delete_route(route.id);
      } else {
        res = await mockDeleteRoute(route.id);
      }

      // Smoothly let the 360ms GPU roll & grid collapse finish before removing from list
      setTimeout(() => {
        setRoutes((prev) => prev.filter((r) => r.id !== route.id));
        setDissolvingId((curr) => (curr === route.id ? null : curr));

        if (res?.ok) {
          onToast({
            type: 'info',
            message: `Маршрут «${route.name}» удалён`,
          });
        } else {
          onError(res?.error || 'Не удалось удалить маршрут');
          fetchRoutes();
        }
      }, 360);
    } catch (err: any) {
      setTimeout(() => {
        setDissolvingId(null);
        onError(err?.message || 'Ошибка при удалении маршрута');
        fetchRoutes();
      }, 360);
    }
  };

  return (
    <div className="flex-1 flex flex-col sm:flex-row gap-3 min-h-0 w-full select-none text-zinc-300">
      {/* =========================================================================
          Left Column (Sidebar) - matching image_483f0b48.png
          ========================================================================= */}
      <aside className="w-full sm:w-60 md:w-64 shrink-0 flex flex-col justify-between sm:border-r border-zinc-800/80 sm:pr-3.5 pb-2 sm:pb-0 gap-3">
        <div className="flex flex-col gap-3">
          {/* Header Title + Count Badge */}
          <div className="flex items-center gap-2 pt-0.5">
            <h3 className="text-xs sm:text-[13px] font-mono font-black uppercase tracking-wider text-zinc-100">
              Маршруты фарма
            </h3>
            <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-black bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]">
              {routes.length}
            </span>
          </div>

          {/* Record Route Button */}
          <button
            type="button"
            onClick={() => {
              if (isBotRunning) {
                onError('Идёт сессия бота — сначала нажмите Стоп');
                return;
              }
              setIsRecordModalOpen(true);
            }}
            disabled={isBotRunning}
            className={`w-full py-2 px-3 rounded-lg text-xs font-mono font-bold tracking-wide border flex items-center justify-center gap-2 transition-all cursor-pointer select-none active:scale-95 ${
              isBotRunning
                ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500'
                : 'bg-gradient-to-r from-[#091522] via-[#0b1d30] to-[#091522] border-cyan-500/60 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.18)] hover:shadow-[0_0_22px_rgba(6,182,212,0.35)]'
            }`}
            title={isBotRunning ? 'Идёт сессия бота — сначала нажмите Стоп' : 'Записать новый маршрут в игре'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Записать маршрут</span>
          </button>

          {/* Auto-selection toggle button */}
          <button
            type="button"
            onClick={() => handleSetActive(null)}
            className={`w-full py-2 px-2.5 rounded-lg text-[11px] font-mono border flex items-center justify-between transition-all cursor-pointer select-none active:scale-95 ${
              activeId === null
                ? 'bg-[#091420] border-cyan-500/70 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.22)] font-bold'
                : 'bg-[#06080d] border-zinc-800/90 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
            title="Автоматически выбирать ближайший маршрут текущей карты"
          >
            <div className="flex items-center gap-2">
              {activeId === null ? (
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-zinc-600" />
              )}
              <span>Автовыбор</span>
            </div>
            {activeId === null && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-bold">
                АКТИВЕН
              </span>
            )}
          </button>
        </div>

        {/* Minimal info note at bottom of sidebar */}
        <div className="p-2 rounded-lg bg-[#05070c] border border-zinc-850 text-[9.5px] font-mono text-zinc-500 leading-relaxed">
          Бот выбирает ближайший маршрут зоны или указанный вручную.
        </div>
      </aside>

      {/* =========================================================================
          Right Column (Route list + In-App Terrain Visualizer)
          ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col gap-2.5 overflow-hidden">
        {/* In-App 60 FPS Terrain Mesh Visualizer (embedded directly above the list!) */}
        {activeTerrainCard && (
          <div className="animate-screen-assemble mb-1 shrink-0">
            <TerrainNotificationCard
              routeName={activeTerrainCard.routeName}
              initialTerrain={activeTerrainCard.initialTerrain}
              onClose={onCloseTerrainCard || (() => {})}
            />
          </div>
        )}

        {/* Route list */}
        <div className="flex-1 overflow-y-auto pr-0.5 min-h-0 space-y-2" style={{ perspective: '1000px' }}>
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-zinc-400">Загрузка маршрутов...</span>
            </div>
          ) : routes.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-[#06080d] border border-zinc-800/70 space-y-2 my-auto">
              <FolderOpen className="w-7 h-7 text-zinc-600 mx-auto" />
              <p className="text-xs font-mono font-bold text-zinc-300">Маршруты пока не созданы</p>
              <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
                Нажмите «Записать маршрут», чтобы записать траекторию фарма в игре.
              </p>
            </div>
          ) : (
            routes.map((route) => {
              const isSelected = activeId === route.id;
              const isDissolving = dissolvingId === route.id;
              const isJustAdded = justAddedId === route.id;

              return (
                <div
                  key={route.id}
                  className={`route-slot ${isDissolving ? 'is-dissolving' : ''} ${
                    isJustAdded
                      ? 'animate-route-materialize ring-1 ring-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.45)]'
                      : ''
                  }`}
                >
                  <div className="route-slot-inner">
                    <div
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all relative ${
                        isDissolving
                          ? 'route-curl-exit'
                          : isSelected
                          ? 'bg-[#090d16] border-cyan-500/70 shadow-[0_0_18px_rgba(6,182,212,0.18)] ring-1 ring-cyan-500/30'
                          : 'bg-[#06080d] border-zinc-800/90 hover:border-zinc-750 hover:bg-[#070a10]'
                      }`}
                    >
                      {/* Left: Square Thumbnail (aspect 1:1, purely visual without eye overlay) */}
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-lg bg-[#030508] border border-cyan-950/60 overflow-hidden shrink-0 relative">
                        <RouteCanvas
                          points={route.thumb && route.thumb.length > 0 ? route.thumb : []}
                          mapId={route.map_id}
                          mode="thumb"
                          loop={route.loop}
                          aspect={1}
                        />
                      </div>

                      {/* Middle: Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 py-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-mono font-bold text-zinc-100 truncate">
                            {route.name}
                          </h4>
                          {route.loop ? (
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-bold shrink-0">
                              КРУГ
                            </span>
                          ) : (
                            <span className="text-[8.5px] px-1.5 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-700/50 font-bold shrink-0">
                              ТУДА-ОБРАТНО
                            </span>
                          )}
                        </div>

                        {/* Minimalist running stats with icons - NO noisy map_id */}
                        <div className="flex items-center gap-2.5 text-[10px] font-mono text-zinc-400">
                          <span className="text-cyan-300 font-bold">
                            ≈{route.length_s} с бега
                          </span>
                          <span className="text-zinc-650">•</span>
                          <span>
                            <strong className="text-zinc-200">{route.points}</strong> точки
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions (✓ Основной + Delete) - NO EYE ICON */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetActive(route.id)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-[10.5px] font-mono font-bold border transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                              : 'bg-[#080b12] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                          }`}
                          title="Сделать этот маршрут основным"
                        >
                          {isSelected ? (
                            <CheckCircle className="w-3 h-3 text-cyan-400" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          <span>{isSelected ? 'Основной' : 'Выбрать'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoute(route, e)}
                          disabled={isDissolving}
                          className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#080b12] border border-zinc-800 hover:border-rose-500/70 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-50"
                          title="Удалить маршрут"
                        >
                          {isDissolving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Record Modal */}
      <RouteRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRouteSaved={(newRoute, terrain) => {
          if (terrain && terrain.status === 'building') {
            // Hold until terrain is ready: route will appear only after building completes!
            setPendingRoute({ id: newRoute.id, name: newRoute.name });
            if (onTerrainStatus) {
              onTerrainStatus(newRoute.name, terrain);
            }
          } else {
            // Instant / already ready
            fetchRoutes().then(() => {
              setJustAddedId(newRoute.id);
              setTimeout(() => setJustAddedId(null), 3500);
            });
            if (terrain && onTerrainStatus) {
              onTerrainStatus(newRoute.name, terrain);
            }
          }
        }}
        onToast={onToast}
      />
    </div>
  );
};
