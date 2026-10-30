import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Trash2, Check, Plus } from 'lucide-react';
import { RouteItem } from './StealthHUDLeftSidebar';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

interface LineSidebarRouteListProps {
  routes: RouteItem[];
  activeRouteId: string;
  onSelectRoute: (id: string) => void;
  onDeleteRoute?: (id: string) => void;
  onRecordRoute?: () => void;
  onSaveRecording?: (id: string) => void;
  onCancelRecording?: (id: string) => void;
  language?: 'ru' | 'en';
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const LineSidebarRouteList: React.FC<LineSidebarRouteListProps> = ({
  routes,
  activeRouteId,
  onSelectRoute,
  onDeleteRoute,
  onRecordRoute,
  onSaveRecording,
  onCancelRecording,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Proximity displacement offsets for each route item (index -> px shift)
  const [proximityOffsets, setProximityOffsets] = useState<Record<string, number>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Active line indicator position
  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number; opacity: number }>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  // Calculate active indicator position
  const updateActiveIndicator = useCallback(() => {
    if (!activeRouteId || routes.length === 0) {
      setIndicatorStyle({ top: 0, height: 0, opacity: 0 });
      return;
    }
    const activeEl = itemsRef.current.get(activeRouteId);
    const container = containerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        top: elRect.top - containerRect.top,
        height: elRect.height,
        opacity: 1,
      });
    } else {
      setIndicatorStyle({ top: 0, height: 0, opacity: 0 });
    }
  }, [activeRouteId, routes.length]);

  useEffect(() => {
    updateActiveIndicator();
    const handleResize = () => updateActiveIndicator();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateActiveIndicator, routes]);

  // Cursor proximity handler inspired by React Bits Line Sidebar
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;

    const mouseY = e.clientY;
    const newOffsets: Record<string, number> = {};
    const proximityRadius = 90; // px threshold for proximity effect

    routes.forEach((route) => {
      const el = itemsRef.current.get(route.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const itemCenterY = rect.top + rect.height / 2;
      const dist = Math.abs(mouseY - itemCenterY);

      if (dist < proximityRadius) {
        const strength = 1 - dist / proximityRadius;
        newOffsets[route.id] = Math.round(strength * 8);
      } else {
        newOffsets[route.id] = 0;
      }
    });

    setProximityOffsets(newOffsets);
  };

  const handleMouseLeave = () => {
    setProximityOffsets({});
    setHoveredId(null);
  };

  const getRouteDisplayName = (name: string) => {
    if (name.startsWith('Маршрут ') && !isRu) {
      return name.replace('Маршрут ', 'Route ');
    }
    if (name.startsWith('Route ') && isRu) {
      return name.replace('Route ', 'Маршрут ');
    }
    return name;
  };

  return (
    <SpecularCard className="w-full rounded-2xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent shadow-none p-4 sm:p-5 2xl:p-7 select-none transition-all duration-200">
      {/* Title / Section Header (minimal sentence-case, borderless) */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-transparent">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.3)] dark:shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
          <h2 className="text-xs sm:text-sm font-mono font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            {isRu ? 'Маршруты' : 'Routes'}
          </h2>
        </div>

        {onRecordRoute && (
          <SpecularButton
            onClick={() => {
              soundFx.playClick();
              onRecordRoute();
            }}
            className="h-8 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08] text-xs font-mono text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all active:scale-95 shadow-none"
          >
            <Plus className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white" />
            <span>{isRu ? 'Записать маршрут' : 'Record Route'}</span>
          </SpecularButton>
        )}
      </div>

      {/* React Bits Line Sidebar Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex flex-col py-2 pl-4 pr-2"
      >
        {/* Continuous Guide Line Rail (hidden when routes is empty) */}
        {routes.length > 0 && (
          <div className="absolute left-[7px] top-1 bottom-1 w-[1px] bg-black/[0.12] dark:bg-white/[0.1]" />
        )}

        {/* Dynamic Sliding Active Line Indicator (hidden when routes is empty) */}
        {routes.length > 0 && indicatorStyle.opacity > 0 && (
          <div
            className="absolute left-[6.5px] w-[2px] bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] dark:shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-250 ease-out pointer-events-none"
            style={{
              transform: `translateY(${indicatorStyle.top}px)`,
              height: `${indicatorStyle.height}px`,
              opacity: indicatorStyle.opacity,
            }}
          />
        )}

        {/* Empty state when no routes exist */}
        {routes.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-zinc-500 dark:text-zinc-500">
            {isRu ? 'Нет маршрутов' : 'No routes available'}
          </div>
        ) : (
          /* Route Items List */
          <div className="flex flex-col gap-1.5 sm:gap-2 relative z-10">
            {routes.map((route) => {
              const isActive = route.id === activeRouteId;
              const isHovered = hoveredId === route.id;
              const isCreating = route.isCreating;
              const offset = proximityOffsets[route.id] || 0;
              const displayName = getRouteDisplayName(route.name);

              return (
                <div
                  key={route.id}
                  ref={(el) => {
                    if (el) itemsRef.current.set(route.id, el);
                    else itemsRef.current.delete(route.id);
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() => !isCreating && onSelectRoute(route.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isCreating) {
                      e.preventDefault();
                      onSelectRoute(route.id);
                    }
                  }}
                  onMouseEnter={() => setHoveredId(route.id)}
                  className="group relative flex items-center justify-between h-10 sm:h-11 2xl:h-12 w-full pl-5 pr-3 text-left transition-all duration-150 ease-out cursor-pointer outline-none bg-transparent"
                  style={{
                    transform: `translateX(${offset}px)`,
                  }}
                >
                  {/* Horizontal Tick from line rail */}
                  <span
                    className={`absolute left-[-9px] h-[1px] transition-all duration-200 ${
                      isActive
                        ? 'w-3.5 bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.3)] dark:shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                        : isHovered
                        ? 'w-3 bg-zinc-700 dark:bg-zinc-300'
                        : 'w-2 bg-black/20 dark:bg-white/20'
                    }`}
                  />

                  {route.isRecording || isCreating ? (
                    /* Route recording / creation loading state directly next to route name */
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-ping" />
                        <span className="font-mono text-xs sm:text-sm 2xl:text-base text-zinc-950 dark:text-white font-medium">
                          {displayName}
                        </span>
                        <span className="text-[10px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 ml-1">
                          <Loader2 className="w-3 h-3 animate-spin text-zinc-500 dark:text-zinc-400" />
                          <span>{isRu ? 'идёт запись...' : 'recording...'}</span>
                          {route.recordingSeconds != null && route.recordingSeconds > 0 && (
                            <span className="text-zinc-400 font-mono">({formatSeconds(route.recordingSeconds)})</span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 ml-auto">
                        {onSaveRecording && route.isRecording && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSaveRecording(route.id);
                            }}
                            className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer active:scale-95 shadow-sm"
                          >
                            {isRu ? 'Сохранить' : 'Save'}
                          </button>
                        )}
                        {onCancelRecording && route.isRecording && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancelRecording(route.id);
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-mono text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                          >
                            {isRu ? 'Отмена' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      {/* Route Name */}
                      <span
                        className={`font-mono text-xs sm:text-sm 2xl:text-base tracking-wide transition-colors duration-150 ${
                          isActive
                            ? 'text-zinc-950 dark:text-white font-semibold'
                            : isHovered
                            ? 'text-zinc-800 dark:text-zinc-200'
                            : 'text-zinc-500'
                        }`}
                      >
                        {displayName}
                      </span>

                      {/* Right actions: White Checkmark for active route + Delete icon */}
                      <div className="flex items-center gap-2 ml-auto">
                        {isActive && (
                          <Check className="w-4 h-4 text-zinc-950 dark:text-white stroke-[2.5] drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" />
                        )}

                        {onDeleteRoute && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRoute(route.id);
                            }}
                            className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors p-1.5 rounded"
                            title={isRu ? 'Удалить' : 'Delete'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SpecularCard>
  );
};
