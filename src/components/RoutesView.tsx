import React, { useState, useEffect, useCallback } from 'react';
import { RouteInfo, TerrainStatus, RoutePreview } from '../types';
import { RouteIslandThumbnail } from './RouteIslandThumbnail';
import { RouteCanvas } from './RouteCanvas';
import { RouteRecordModal } from './RouteRecordModal';
import { TerrainNotificationCard } from './TerrainNotificationCard';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockListRoutes,
  mockSetActiveRoute,
  mockDeleteRoute,
  mockGetRoutePreview,
} from '../data/mockRoutes';
import {
  Plus,
  Trash2,
  CheckCircle,
  Circle,
  Loader2,
  FolderOpen,
  Eye,
  EyeOff,
  X,
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

  // Modal & Preview state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [dissolvingId, setDissolvingId] = useState<string | null>(null);
  const [previewRouteId, setPreviewRouteId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<RoutePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

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

  // Listen for terrain readiness
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

  // Set active route
  const handleSetActive = async (id: string) => {
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
            active: r.id === id,
          }))
        );
        onToast({
          type: 'success',
          message: 'Маршрут выбран основным',
        });
      } else {
        onError(res.error || 'Ошибка выбора маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка выбора маршрута');
    }
  };

  // Toggle route full preview
  const handleTogglePreview = async (routeId: string) => {
    if (previewRouteId === routeId) {
      setPreviewRouteId(null);
      setPreviewData(null);
      return;
    }

    setPreviewRouteId(routeId);
    setLoadingPreview(true);
    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.get_route_preview) {
        res = await api.get_route_preview(routeId);
      } else {
        res = await mockGetRoutePreview(routeId);
      }

      if (res.ok && res.preview) {
        setPreviewData(res.preview);
      } else {
        onError(res.error || 'Не удалось загрузить предпросмотр маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка загрузки предпросмотра');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Delete route
  const handleDeleteRoute = async (route: RouteInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (dissolvingId === route.id) return;

    setDissolvingId(route.id);
    if (previewRouteId === route.id) {
      setPreviewRouteId(null);
      setPreviewData(null);
    }

    try {
      const api = await getPywebviewApi();
      let res;
      if (api?.delete_route) {
        res = await api.delete_route(route.id);
      } else {
        res = await mockDeleteRoute(route.id);
      }

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
    <div className="flex-1 flex flex-row gap-2.5 min-h-0 w-full h-full select-none text-zinc-300 overflow-hidden">
      {/* =========================================================================
          Left Column (Compact Sidebar) - NO Auto-Select button, fits without scrolling
          ========================================================================= */}
      <aside className="w-32 sm:w-36 md:w-40 shrink-0 flex flex-col justify-between border-r border-zinc-800/80 pr-2 pb-1 gap-2">
        <div className="flex flex-col gap-2">
          {/* Header Title + Count Badge */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-100 truncate">
              Маршруты
            </h3>
            <span className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-mono font-black bg-cyan-950/80 text-cyan-300 border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)] shrink-0">
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
            className={`w-full py-2 px-2 rounded-lg text-[10.5px] font-mono font-bold tracking-wide border flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isBotRunning
                ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500'
                : 'bg-gradient-to-r from-[#091522] via-[#0b1d30] to-[#091522] border-cyan-500/60 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.18)] hover:shadow-[0_0_22px_rgba(6,182,212,0.35)]'
            }`}
            title={isBotRunning ? 'Идёт сессия бота — сначала нажмите Стоп' : 'Записать новый маршрут в игре'}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Записать</span>
          </button>
        </div>

        {/* Minimal info note at bottom of sidebar */}
        <div className="p-1.5 rounded-lg bg-[#05070c] border border-zinc-850 text-[8.5px] font-mono text-zinc-500 leading-tight">
          Выбранный маршрут используется ботом при старте.
        </div>
      </aside>

      {/* =========================================================================
          Right Column (Route list + In-App Terrain Visualizer)
          ========================================================================= */}
      <main className="flex-1 min-w-0 flex flex-col gap-2 overflow-hidden h-full">
        {/* In-App 3D Terrain Mesh Visualizer (compact, zero scroll force) */}
        {activeTerrainCard && (
          <div className="animate-screen-assemble shrink-0">
            <TerrainNotificationCard
              routeName={activeTerrainCard.routeName}
              initialTerrain={activeTerrainCard.initialTerrain}
              onClose={onCloseTerrainCard || (() => {})}
            />
          </div>
        )}

        {/* Full Route Preview Panel (when eye icon is toggled) */}
        {previewRouteId && (
          <div className="shrink-0 p-2 rounded-xl bg-[#040812] border border-cyan-700/60 relative overflow-hidden animate-fadeIn">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/80 mb-1.5">
              <span className="text-[10px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                <Eye className="w-3 h-3 text-cyan-400" />
                Карта обхода маршрута
              </span>
              <button
                type="button"
                onClick={() => setPreviewRouteId(null)}
                className="text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {loadingPreview ? (
              <div className="h-28 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                <span className="text-[10px] font-mono text-zinc-400">Загрузка траектории...</span>
              </div>
            ) : previewData ? (
              <div className="h-28 w-full rounded-lg overflow-hidden border border-cyan-950">
                <RouteCanvas
                  points={previewData.points}
                  paths={previewData.paths}
                  aspect={previewData.aspect || 1.6}
                  mode="preview"
                  loop={previewData.route.loop}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Route list */}
        <div className="flex-1 overflow-y-auto pr-0.5 min-h-0 space-y-2">
          {loading ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-zinc-400">Загрузка маршрутов...</span>
            </div>
          ) : routes.length === 0 ? (
            <div className="p-4 text-center rounded-xl bg-[#06080d] border border-zinc-800/70 space-y-1.5 my-auto">
              <FolderOpen className="w-6 h-6 text-zinc-600 mx-auto" />
              <p className="text-xs font-mono font-bold text-zinc-300">Маршруты пока не созданы</p>
              <p className="text-[9.5px] text-zinc-500 max-w-xs mx-auto">
                Нажмите «Записать», чтобы записать траекторию фарма в игре.
              </p>
            </div>
          ) : (
            routes.map((route) => {
              const isSelected = activeId === route.id;
              const isDissolving = dissolvingId === route.id;
              const isJustAdded = justAddedId === route.id;
              const isPreviewing = previewRouteId === route.id;

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
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all relative ${
                        isDissolving
                          ? 'route-curl-exit'
                          : isSelected
                          ? 'bg-[#090d16] border-cyan-500/70 shadow-[0_0_18px_rgba(6,182,212,0.18)] ring-1 ring-cyan-500/30'
                          : 'bg-[#06080d] border-zinc-800/90 hover:border-zinc-750 hover:bg-[#070a10]'
                      }`}
                    >
                      {/* Left: 3D Isometric Terrain Island Thumbnail (matching image_a5e4115a.png) */}
                      <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-[#03060c] border border-cyan-950/60 overflow-hidden shrink-0 relative shadow-inner">
                        <RouteIslandThumbnail
                          points={route.thumb && route.thumb.length > 0 ? route.thumb : []}
                          loop={route.loop}
                        />
                      </div>

                      {/* Middle: Details (matching image_a5e4115a.png) */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-mono font-bold text-zinc-100 truncate">
                            {route.name}
                          </h4>
                          {route.loop ? (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-bold shrink-0">
                              КРУГ
                            </span>
                          ) : (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-700/50 font-bold shrink-0">
                              ТУДА-ОБРАТНО
                            </span>
                          )}
                        </div>

                        {/* Telemetry subtitle (matching image_a5e4115a.png) */}
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                          <span className="text-cyan-300 font-bold">
                            ≈{route.length_s} с бега
                          </span>
                          <span className="text-zinc-650">•</span>
                          <span>
                            <strong className="text-zinc-200">{route.points}</strong> точки
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions [✓ Основной] [🗑] [👁] (matching image_a5e4115a.png) */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetActive(route.id)}
                          className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
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

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoute(route, e)}
                          disabled={isDissolving}
                          className="w-7 h-7 rounded-lg bg-[#080b12] border border-zinc-800 hover:border-rose-500/70 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-50"
                          title="Удалить маршрут"
                        >
                          {isDissolving ? (
                            <Loader2 className="w-3 h-3 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>

                        {/* Preview Eye button (matching image_a5e4115a.png) */}
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(route.id)}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            isPreviewing
                              ? 'bg-[#091522] border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                              : 'bg-[#080b12] border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-800'
                          }`}
                          title={isPreviewing ? 'Скрыть карту обхода' : 'Показать карту обхода'}
                        >
                          {isPreviewing ? (
                            <EyeOff className="w-3 h-3" />
                          ) : (
                            <Eye className="w-3 h-3" />
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
            setPendingRoute({ id: newRoute.id, name: newRoute.name });
            if (onTerrainStatus) {
              onTerrainStatus(newRoute.name, terrain);
            }
          } else {
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
