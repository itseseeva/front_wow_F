import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronUp,
  ChevronDown,
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

  // Scroll and pagination state for max 2 visible routes
  const [startIndex, setStartIndex] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'down' | 'up' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const lastWheelTime = useRef<number>(0);
  const touchStartY = useRef<number | null>(null);

  const canScrollUp = startIndex > 0;
  const canScrollDown = routes.length > 2 && startIndex < routes.length - 2;

  const handleScrollUp = useCallback(() => {
    setStartIndex((prev) => {
      if (prev <= 0) return 0;
      setScrollDirection('up');
      setAnimKey((k) => k + 1);
      return prev - 1;
    });
  }, []);

  const handleScrollDown = useCallback(() => {
    setStartIndex((prev) => {
      if (prev >= routes.length - 2) return prev;
      setScrollDirection('down');
      setAnimKey((k) => k + 1);
      return prev + 1;
    });
  }, [routes.length]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (routes.length <= 2) return;
    const now = Date.now();
    // 1 physical scroll tick advances 1 route with direction animation
    if (now - lastWheelTime.current < 280) {
      return;
    }
    if (Math.abs(e.deltaY) < 12) return;

    if (e.deltaY > 0) {
      if (startIndex < routes.length - 2) {
        handleScrollDown();
        lastWheelTime.current = now;
      }
    } else if (e.deltaY < 0) {
      if (startIndex > 0) {
        handleScrollUp();
        lastWheelTime.current = now;
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartY.current === null || routes.length <= 2) return;
    const diff = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 28) {
      if (diff > 0) {
        handleScrollDown();
      } else {
        handleScrollUp();
      }
    }
    touchStartY.current = null;
  };

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

  // Clamp startIndex when routes change
  useEffect(() => {
    if (routes.length <= 2) {
      setStartIndex(0);
    } else if (startIndex > routes.length - 2) {
      setStartIndex(Math.max(0, routes.length - 2));
    }
  }, [routes.length, startIndex]);

  // Bring active route into view if it is currently off-screen
  useEffect(() => {
    if (activeId && routes.length > 2) {
      const activeIdx = routes.findIndex((r) => r.id === activeId);
      if (activeIdx !== -1) {
        if (activeIdx < startIndex) {
          setStartIndex(activeIdx);
        } else if (activeIdx > startIndex + 1) {
          setStartIndex(Math.min(activeIdx, routes.length - 2));
        }
      }
    }
  }, [activeId, routes, startIndex]);

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
        isDark ? 'border-[#5a4422]' : 'border-[#bfa57a]'
      }`}>
        <div className="flex flex-col gap-2">
          {/* Header Title + Count Badge */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <h3 className={`text-xs font-fantasy font-black uppercase tracking-wider truncate text-wow-gold`}>
              {t.navRoutes}
            </h3>
            <span className={`w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-fantasy font-black border shrink-0 ${
              isDark
                ? 'bg-[#2b1a1d] text-[#f5d17f] border-[#c89b3c] shadow-inner'
                : 'bg-[#ebdcc0] text-[#785a28] border-[#785a28]'
            }`}>
              {routes.length}
            </span>
          </div>

          {/* Record Route Button: Ruby Red Action Button */}
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
            className={`btn-wow-ruby w-full py-2 px-2 rounded-lg text-[10.5px] font-fantasy font-bold tracking-wider border-2 border-[#c89b3c] flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 ${
              isBotRunning
                ? 'opacity-40 cursor-not-allowed filter grayscale'
                : 'hover:border-[#f0b232] shadow-[0_2px_8px_rgba(0,0,0,0.8)]'
            }`}
            title={isBotRunning ? t.routesRecordDisabledBotRunning : t.routesRecordTooltip}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5] text-[#fef08a]" />
            <span>{t.routesRecordBtn}</span>
          </button>
        </div>

        {/* Parchment info scroll at bottom of sidebar */}
        <div className={`p-2 rounded-lg border text-[9px] font-fantasy leading-snug shadow-md ${
          isDark
            ? 'bg-wow-parchment border-[#785a28] text-[#2c1708]'
            : 'bg-[#f5ecdc] border-[#c7b28a] text-[#3d240f]'
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



        {/* Scroll Up Button - Warcraft Chiseled Bracket without rounding */}
        {routes.length > 2 && (
          <div className="flex items-center justify-center my-2 shrink-0 z-10 select-none animate-fadeIn">
            <button
              type="button"
              onClick={handleScrollUp}
              disabled={!canScrollUp}
              className={`group w-full max-w-[260px] h-5 flex items-center justify-center gap-2 border transition-all duration-200 cursor-pointer ${
                canScrollUp
                  ? isDark
                    ? 'border-[#5a4422]/70 hover:border-[#c89b3c] bg-[#181216]/70 hover:bg-[#25181e] text-[#c7b28a] hover:text-[#f5d17f] hover:shadow-[0_0_10px_rgba(200,155,60,0.35)] active:translate-y-[-1px]'
                    : 'border-[#bfa57a]/80 hover:border-[#785a28] bg-[#f8f2e6]/80 hover:bg-[#f1e5cf] text-[#785a28] hover:text-[#422206] shadow-xs active:translate-y-[-1px]'
                  : isDark
                  ? 'border-[#3d2c18]/25 bg-[#120f13]/30 text-[#5a4422]/30 cursor-not-allowed opacity-30 pointer-events-none'
                  : 'border-[#d9c8a9]/30 bg-slate-100/40 text-slate-300 cursor-not-allowed opacity-30 pointer-events-none'
              }`}
              title={t.scrollUp}
            >
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#785a28]/40 to-[#c89b3c]/60 group-hover:via-[#c89b3c]/80" />
              <div className="flex items-center gap-1.5 px-2">
                <ChevronUp className="w-3.5 h-3.5 stroke-[2.5] transition-transform group-hover:-translate-y-0.5" />
                <span className="text-[8.5px] uppercase tracking-widest font-fantasy opacity-70 group-hover:opacity-100">
                  ▲
                </span>
              </div>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#785a28]/40 to-[#c89b3c]/60 group-hover:via-[#c89b3c]/80" />
            </button>
          </div>
        )}

        {/* Route list (Max 2 visible at once, wheel/touch/click triggers directional 60fps animations) */}
        <div
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="space-y-2 select-none min-h-[174px] sm:min-h-[190px] overflow-hidden"
        >
          {loading ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-[#c89b3c] animate-spin" />
              <span className={`text-xs font-fantasy ${isDark ? 'text-wow-parchment' : 'text-slate-600'}`}>
                {t.routesListLoading}
              </span>
            </div>
          ) : routes.length === 0 ? (
            <div className={`p-4 text-center rounded-xl border-2 space-y-1.5 my-auto ${
              isDark
                ? 'bg-[#181316] border-[#5a4422] shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]'
                : 'bg-white border-[#d9c8a9] shadow-sm'
            }`}>
              <FolderOpen className={`w-6 h-6 mx-auto ${isDark ? 'text-[#a89274]' : 'text-slate-400'}`} />
              <p className={`text-xs font-fantasy font-bold tracking-wide ${isDark ? 'text-wow-gold' : 'text-slate-800'}`}>
                {t.routesEmptyTitle}
              </p>
              <p className={`text-[9.5px] max-w-xs mx-auto font-fantasy ${isDark ? 'text-wow-parchment' : 'text-slate-600'}`}>
                {t.routesEmptyDesc}
              </p>
            </div>
          ) : (
            (routes.length > 2 ? routes.slice(startIndex, startIndex + 2) : routes).map((route, idxInVisible) => {
              const isSelected = activeId === route.id;
              const isDissolving = dissolvingId === route.id;
              const isJustAdded = justAddedId === route.id;
              const isPreviewing = previewRouteId === route.id;

              // Directional cool appearance animation when scrolling:
              // Scrolling DOWN: newly revealed bottom card (idxInVisible === 1) enters from bottom to top
              // Scrolling UP: newly revealed top card (idxInVisible === 0) enters from top to bottom
              const isNewlyAppearedFromBottom = scrollDirection === 'down' && idxInVisible === 1;
              const isNewlyAppearedFromTop = scrollDirection === 'up' && idxInVisible === 0;

              const animClass = isJustAdded
                ? 'animate-route-materialize ring-2 ring-[#f0b232] shadow-[0_0_25px_rgba(240,178,50,0.5)]'
                : isNewlyAppearedFromBottom
                ? 'animate-route-slide-from-bottom'
                : isNewlyAppearedFromTop
                ? 'animate-route-slide-from-top'
                : '';

              return (
                <div
                  key={`${route.id}-${animKey}`}
                  className={`route-slot ${isDissolving ? 'is-dissolving' : ''} ${animClass}`}
                >
                  <div className="route-slot-inner">
                    <div
                      className={`p-2.5 rounded-xl border-2 flex items-center justify-between gap-2.5 transition-all relative ${
                        isDissolving
                          ? 'route-curl-exit'
                          : isSelected
                          ? isDark
                            ? 'bg-gradient-to-r from-[#2a1818] via-[#231a20] to-[#201518] border-[#c89b3c] shadow-[inset_0_0_15px_rgba(0,0,0,0.9),0_0_18px_rgba(200,155,60,0.35)] ring-1 ring-[#f0b232]/50'
                            : 'bg-[#faf0df] border-[#c89b3c] shadow-sm ring-1 ring-[#c89b3c]/40'
                          : isDark
                          ? 'bg-gradient-to-r from-[#1c1619] via-[#1a1417] to-[#181215] border-[#5a4422] hover:border-[#785a28] hover:bg-[#221a1e] shadow-[inset_0_0_15px_rgba(0,0,0,0.85)]'
                          : 'bg-white border-[#d9c8a9] hover:border-[#bfa57a] hover:bg-slate-50/60 shadow-xs'
                      }`}
                    >
                      {/* Left: 3D Isometric Terrain Island Thumbnail in Spell Slot Frame */}
                      <div className={`slot-wow-spell w-16 h-16 sm:w-18 sm:h-18 rounded-lg overflow-hidden shrink-0 relative ${
                        isDark ? 'bg-[#0c090c] border-[#5a4422]' : 'bg-[#e2d8c3] border-[#785a28]'
                      }`}>
                        <RouteIslandThumbnail
                          points={route.thumb && route.thumb.length > 0 ? route.thumb : []}
                          loop={route.loop}
                        />
                      </div>

                      {/* Middle: Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 py-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className={`text-xs sm:text-sm font-fantasy font-black tracking-wide truncate ${
                            isDark ? 'text-[#f5d17f] drop-shadow-sm' : 'text-[#422206]'
                          }`}>
                            {route.name}
                          </h4>
                          {route.loop ? (
                            <span className={`text-[8.5px] px-2 py-0.5 rounded font-fantasy font-bold shrink-0 border ${
                              isDark
                                ? 'bg-[#15321d] text-[#86efac] border-[#2ecc71]/60 shadow-[0_0_6px_rgba(46,204,113,0.3)]'
                                : 'bg-[#e6f7ec] text-[#166534] border-[#22c55e]'
                            }`}>
                              {t.routesLoop}
                            </span>
                          ) : (
                            <span className={`text-[8.5px] px-2 py-0.5 rounded font-fantasy font-bold shrink-0 border ${
                              isDark
                                ? 'bg-[#2e153b] text-[#e9d5ff] border-[#9333ea]/60'
                                : 'bg-purple-50 text-purple-900 border-purple-300'
                            }`}>
                              {t.routesBackForth}
                            </span>
                          )}
                        </div>

                        {/* Telemetry subtitle */}
                        <div className={`flex items-center gap-2 text-[10.5px] font-fantasy ${
                          isDark ? 'text-wow-parchment' : 'text-slate-600'
                        }`}>
                          <span className={`font-bold ${isDark ? 'text-wow-gold' : 'text-[#785a28]'}`}>
                            ≈{route.length_s} {t.routesRunSeconds}
                          </span>
                          <span className={isDark ? 'text-[#785a28]' : 'text-slate-300'}>•</span>
                          <span>
                            <strong className={isDark ? 'text-[#f5d17f]' : 'text-slate-800'}>
                              {route.points}
                            </strong>{' '}
                            {t.routesPoints}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions [✓ Основной] [🗑] [👁] */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetActive(route.id)}
                          className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10.5px] font-fantasy font-bold border-2 transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1.5 ${
                            isSelected
                              ? isDark
                                ? 'bg-gradient-to-b from-[#1c4b26] to-[#0e2714] border-[#2ecc71] text-[#a7f3d0] shadow-[0_0_12px_rgba(46,204,113,0.45)]'
                                : 'bg-[#1b6b33] text-white border-[#2ecc71] shadow-xs'
                              : isDark
                              ? 'bg-[#1a1418] border-[#5a4422] text-[#d9c8a9] hover:text-[#f5d17f] hover:border-[#c89b3c] shadow-inner'
                              : 'bg-white border-[#bfa57a] text-slate-700 hover:text-slate-900 hover:border-[#785a28] shadow-xs'
                          }`}
                          title={t.routesActiveBadge}
                        >
                          {isSelected ? (
                            <CheckCircle className="w-3.5 h-3.5 text-[#2ecc71] fill-current" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-[#c89b3c]" />
                          )}
                          <span>{isSelected ? t.routesActiveBadge : t.routesSetActive}</span>
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRoute(route, e)}
                          disabled={isDissolving}
                          className={`w-7.5 h-7.5 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer active:scale-90 disabled:opacity-50 ${
                            isDark
                              ? 'bg-[#161114] border-[#5a4422] text-[#a89274] hover:border-red-600 hover:text-red-300 hover:bg-[#2b1014] shadow-inner'
                              : 'bg-white border-[#d9c8a9] text-slate-500 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 shadow-xs'
                          }`}
                          title={t.routesDeleteTooltip}
                        >
                          {isDissolving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
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

        {/* Scroll Down Button - Warcraft Chiseled Bracket without rounding */}
        {routes.length > 2 && (
          <div className="flex items-center justify-center my-2 shrink-0 z-10 select-none animate-fadeIn">
            <button
              type="button"
              onClick={handleScrollDown}
              disabled={!canScrollDown}
              className={`group w-full max-w-[260px] h-5 flex items-center justify-center gap-2 border transition-all duration-200 cursor-pointer ${
                canScrollDown
                  ? isDark
                    ? 'border-[#5a4422]/70 hover:border-[#c89b3c] bg-[#181216]/70 hover:bg-[#25181e] text-[#c7b28a] hover:text-[#f5d17f] hover:shadow-[0_0_10px_rgba(200,155,60,0.35)] active:translate-y-[1px]'
                    : 'border-[#bfa57a]/80 hover:border-[#785a28] bg-[#f8f2e6]/80 hover:bg-[#f1e5cf] text-[#785a28] hover:text-[#422206] shadow-xs active:translate-y-[1px]'
                  : isDark
                  ? 'border-[#3d2c18]/25 bg-[#120f13]/30 text-[#5a4422]/30 cursor-not-allowed opacity-30 pointer-events-none'
                  : 'border-[#d9c8a9]/30 bg-slate-100/40 text-slate-300 cursor-not-allowed opacity-30 pointer-events-none'
              }`}
              title={t.scrollDown}
            >
              <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#785a28]/40 to-[#c89b3c]/60 group-hover:via-[#c89b3c]/80" />
              <div className="flex items-center gap-1.5 px-2">
                <ChevronDown className="w-3.5 h-3.5 stroke-[2.5] transition-transform group-hover:translate-y-0.5" />
                <span className="text-[8.5px] uppercase tracking-widest font-fantasy opacity-70 group-hover:opacity-100">
                  ▼
                </span>
              </div>
              <span className="h-px flex-1 bg-gradient-to-l from-transparent via-[#785a28]/40 to-[#c89b3c]/60 group-hover:via-[#c89b3c]/80" />
            </button>
          </div>
        )}
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
