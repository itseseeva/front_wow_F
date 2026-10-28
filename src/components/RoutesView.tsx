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
import { Language, Theme, translations } from '../utils/i18n';

interface RoutesViewProps {
  isBotRunning: boolean;
  onToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
  onError: (msg: string) => void;
  onTerrainStatus?: (routeName: string, terrain: TerrainStatus) => void;
  activeTerrainCard?: { routeName: string; initialTerrain: TerrainStatus } | null;
  onCloseTerrainCard?: () => void;
  language?: Language;
  theme?: Theme;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  isBotRunning,
  onToast,
  onError,
  onTerrainStatus,
  activeTerrainCard,
  onCloseTerrainCard,
  language = 'ru',
  theme = 'dark',
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

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
        onError(res.error || t.routesLoadError);
      }
    } catch (err: any) {
      onError(err?.message || t.routesErrorGeneric);
    } finally {
      setLoading(false);
    }
  }, [onError, t]);

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

    window.addEventListener('wowbot:terrain', handleTerrainEvent);
    return () => {
      window.removeEventListener('wowbot:terrain', handleTerrainEvent);
    };
  }, [fetchRoutes, pendingRoute]);

  const handleSetActive = async (id: string) => {
    if (activeId === id) return;
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
        const activeRoute = routes.find((r) => r.id === id);
        onToast({
          type: 'success',
          message: `${t.routesActiveBadge}: «${activeRoute?.name || id}»`,
        });
      } else {
        onError(res.error || 'Failed to set route');
      }
    } catch (err: any) {
      onError(err?.message || 'Error activating route');
    }
  };

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
      let res: { ok: boolean; error?: string; preview?: RoutePreview };
      if (api?.get_route_preview) {
        res = await api.get_route_preview(routeId);
      } else {
        res = await mockGetRoutePreview(routeId);
      }

      if (res.ok && res.preview) {
        setPreviewData(res.preview);
      } else {
        onError(res.error || 'Failed to load route preview');
        setPreviewRouteId(null);
      }
    } catch (err: any) {
      onError(err?.message || 'Error loading preview');
      setPreviewRouteId(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDeleteRoute = async (route: RouteInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeId === route.id && routes.length > 1) {
      const confirmDelete = window.confirm(
        `${t.routesDeleteConfirm} «${route.name}»?`
      );
      if (!confirmDelete) return;
    }

    setDissolvingId(route.id);

    try {
      setTimeout(async () => {
        const api = await getPywebviewApi();
        let res;
        if (api?.delete_route) {
          res = await api.delete_route(route.id);
        } else {
          res = await mockDeleteRoute(route.id);
        }

        if (res.ok) {
          setRoutes((prev) => prev.filter((r) => r.id !== route.id));
          if (activeId === route.id) {
            setActiveId(null);
          }
          if (previewRouteId === route.id) {
            setPreviewRouteId(null);
            setPreviewData(null);
          }
          onToast({
            type: 'info',
            message: `${route.name} removed`,
          });
        } else {
          onError(res?.error || 'Failed to delete route');
          fetchRoutes();
        }
      }, 360);
    } catch (err: any) {
      setTimeout(() => {
        setDissolvingId(null);
        onError(err?.message || 'Error deleting route');
        fetchRoutes();
      }, 360);
    }
  };

  return (
    <div className={`flex-1 flex flex-row gap-2.5 min-h-0 w-full h-full select-none overflow-hidden ${
      isDark ? 'text-zinc-300' : 'text-slate-700'
    }`}>
      {/* =========================================================================
          Left Column (Compact Sidebar)
          ========================================================================= */}
      <aside className={`w-32 sm:w-36 md:w-40 shrink-0 flex flex-col justify-between border-r pr-2 pb-1 gap-2 ${
        isDark ? 'border-zinc-800/80' : 'border-slate-200'
      }`}>
        <div className="flex flex-col gap-2">
          {/* Header Title + Count Badge */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <h3 className={`text-xs font-mono font-black uppercase tracking-wider truncate ${
              isDark ? 'text-zinc-100' : 'text-slate-900'
            }`}>
              {t.navRoutes}
            </h3>
            <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-mono font-black border shrink-0 ${
              isDark
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                : 'bg-cyan-50 text-cyan-800 border-cyan-300'
            }`}>
              {routes.length}
            </span>
          </div>

          {/* Record Route Button */}
          <button
            type="button"
            onClick={() => {
              if (isBotRunning) {
                onError(t.routesRecordDisabledBotRunning);
                return;
              }
              setIsRecordModalOpen(true);
            }}
            disabled={isBotRunning}
            className={`w-full py-2 px-2 rounded-lg text-[10.5px] font-mono font-bold tracking-wide border flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isBotRunning
                ? isDark
                  ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500'
                  : 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                : isDark
                ? 'bg-gradient-to-r from-[#091522] via-[#0b1d30] to-[#091522] border-cyan-500/60 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.18)] hover:shadow-[0_0_22px_rgba(6,182,212,0.35)]'
                : 'bg-white border-cyan-600/50 hover:border-cyan-500 text-cyan-800 hover:bg-cyan-50 shadow-xs'
            }`}
            title={isBotRunning ? t.routesRecordDisabledBotRunning : t.routesRecordTooltip}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{t.routesRecordBtn}</span>
          </button>
        </div>

        {/* Minimal info note at bottom of sidebar */}
        <div className={`p-1.5 rounded-lg border text-[8.5px] font-mono leading-tight ${
          isDark
            ? 'bg-[#05070c] border-zinc-850 text-zinc-500'
            : 'bg-slate-50 border-slate-200 text-slate-500'
        }`}>
          {t.routesActiveHint}
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
              language={language}
              theme={theme}
            />
          </div>
        )}

        {/* Full Route Preview Panel (when eye icon is toggled) */}
        {previewRouteId && (
          <div className={`shrink-0 p-2 rounded-xl border relative overflow-hidden animate-fadeIn ${
            isDark
              ? 'bg-[#040812] border-cyan-700/60'
              : 'bg-slate-50 border-cyan-300 shadow-sm'
          }`}>
            <div className={`flex items-center justify-between pb-1.5 border-b mb-1.5 ${
              isDark ? 'border-zinc-800/80' : 'border-slate-200'
            }`}>
              <span className={`text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                isDark ? 'text-cyan-300' : 'text-cyan-800'
              }`}>
                <Eye className="w-3 h-3 text-cyan-500" />
                {t.routesMapPreview}
              </span>
              <button
                type="button"
                onClick={() => setPreviewRouteId(null)}
                className={`p-0.5 transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
                }`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {loadingPreview ? (
              <div className="h-28 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 text-cyan-500 animate-spin" />
                <span className={`text-[10px] font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {t.routesTrajectoryLoading}
                </span>
              </div>
            ) : previewData ? (
              <div className={`h-28 w-full rounded-lg overflow-hidden border ${
                isDark ? 'border-cyan-950' : 'border-slate-200 bg-white'
              }`}>
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
              <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
              <span className={`text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                {t.routesListLoading}
              </span>
            </div>
          ) : routes.length === 0 ? (
            <div className={`p-4 text-center rounded-xl border space-y-1.5 my-auto ${
              isDark
                ? 'bg-[#06080d] border-zinc-800/70'
                : 'bg-white border-slate-200 shadow-sm'
            }`}>
              <FolderOpen className={`w-6 h-6 mx-auto ${isDark ? 'text-zinc-600' : 'text-slate-400'}`} />
              <p className={`text-xs font-mono font-bold ${isDark ? 'text-zinc-300' : 'text-slate-800'}`}>
                {t.routesEmptyTitle}
              </p>
              <p className={`text-[9.5px] max-w-xs mx-auto ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
                {t.routesEmptyDesc}
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
                          ? isDark
                            ? 'bg-[#090d16] border-cyan-500/70 shadow-[0_0_18px_rgba(6,182,212,0.18)] ring-1 ring-cyan-500/30'
                            : 'bg-cyan-50/50 border-cyan-500 shadow-xs ring-1 ring-cyan-400/30'
                          : isDark
                          ? 'bg-[#06080d] border-zinc-800/90 hover:border-zinc-750 hover:bg-[#070a10]'
                          : 'bg-white border-slate-200/90 hover:border-slate-300 hover:bg-slate-50/60 shadow-xs'
                      }`}
                    >
                      {/* Left: 3D Isometric Terrain Island Thumbnail */}
                      <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl border overflow-hidden shrink-0 relative shadow-inner ${
                        isDark ? 'bg-[#03060c] border-cyan-950/60' : 'bg-slate-100 border-slate-200'
                      }`}>
                        <RouteIslandThumbnail
                          points={route.thumb && route.thumb.length > 0 ? route.thumb : []}
                          loop={route.loop}
                        />
                      </div>

                      {/* Middle: Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs sm:text-sm font-mono font-bold truncate ${
                            isDark ? 'text-zinc-100' : 'text-slate-900'
                          }`}>
                            {route.name}
                          </h4>
                          {route.loop ? (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0 border ${
                              isDark
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/50'
                                : 'bg-cyan-50 text-cyan-800 border-cyan-300'
                            }`}>
                              {t.routesLoop}
                            </span>
                          ) : (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold shrink-0 border ${
                              isDark
                                ? 'bg-purple-950/70 text-purple-300 border-purple-700/50'
                                : 'bg-purple-50 text-purple-800 border-purple-300'
                            }`}>
                              {t.routesBackForth}
                            </span>
                          )}
                        </div>

                        {/* Telemetry subtitle */}
                        <div className={`flex items-center gap-2 text-[10px] font-mono ${
                          isDark ? 'text-zinc-400' : 'text-slate-500'
                        }`}>
                          <span className={`font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                            ≈{route.length_s} {t.routesRunSeconds}
                          </span>
                          <span className={isDark ? 'text-zinc-600' : 'text-slate-300'}>•</span>
                          <span>
                            <strong className={isDark ? 'text-zinc-200' : 'text-slate-800'}>
                              {route.points}
                            </strong>{' '}
                            {t.routesPoints}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions [✓ Основной] [🗑] [👁] */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetActive(route.id)}
                          className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 ${
                            isSelected
                              ? isDark
                                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                : 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                              : isDark
                              ? 'bg-[#080b12] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                              : 'bg-white border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-400 shadow-xs'
                          }`}
                          title={t.routesActiveBadge}
                        >
                          {isSelected ? (
                            <CheckCircle className="w-3 h-3 text-cyan-400 fill-current" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          <span>{isSelected ? t.routesActiveBadge : t.routesSetActive}</span>
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoute(route, e)}
                          disabled={isDissolving}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-50 ${
                            isDark
                              ? 'bg-[#080b12] border-zinc-800 text-zinc-400 hover:border-rose-500/70 hover:text-rose-400'
                              : 'bg-white border-slate-300 text-slate-400 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 shadow-xs'
                          }`}
                          title={t.routesDeleteTooltip}
                        >
                          {isDissolving ? (
                            <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                        </button>

                        {/* Preview Eye button */}
                        <button
                          type="button"
                          onClick={() => handleTogglePreview(route.id)}
                          className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                            isPreviewing
                              ? isDark
                                ? 'bg-[#091522] border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                                : 'bg-cyan-100 border-cyan-500 text-cyan-800 shadow-xs'
                              : isDark
                              ? 'bg-[#080b12] border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-800'
                              : 'bg-white border-slate-300 text-slate-500 hover:text-cyan-700 hover:border-cyan-400 shadow-xs'
                          }`}
                          title={t.routesPreviewTooltip}
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
        language={language}
        theme={theme}
        onRouteSaved={(newRoute, terrain) => {
          setIsRecordModalOpen(false);
          setPendingRoute({ id: newRoute.id, name: newRoute.name });

          if (terrain && onTerrainStatus) {
            onTerrainStatus(newRoute.name, terrain);
          }

          onToast({
            type: 'success',
            message: `${newRoute.name}: ${t.keySaved}`,
          });

          fetchRoutes();
        }}
        onToast={onToast}
      />
    </div>
  );
};
