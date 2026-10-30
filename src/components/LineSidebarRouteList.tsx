import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { RouteItem } from './StealthHUDLeftSidebar';
import { SpecularCard } from './ui/Specular';

interface LineSidebarRouteListProps {
  routes: RouteItem[];
  activeRouteId: string;
  onSelectRoute: (id: string) => void;
  onDeleteRoute?: (id: string) => void;
  language?: 'ru' | 'en';
}

export const LineSidebarRouteList: React.FC<LineSidebarRouteListProps> = ({
  routes,
  activeRouteId,
  onSelectRoute,
  onDeleteRoute,
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
    }
  }, [activeRouteId]);

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
      </div>

      {/* React Bits Line Sidebar Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex flex-col py-2 pl-4 pr-2"
      >
        {/* Continuous Guide Line Rail */}
        <div className="absolute left-[7px] top-1 bottom-1 w-[1px] bg-black/[0.12] dark:bg-white/[0.1]" />

        {/* Dynamic Sliding Active Line Indicator */}
        <div
          className="absolute left-[6.5px] w-[2px] bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.35)] dark:shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-250 ease-out pointer-events-none"
          style={{
            transform: `translateY(${indicatorStyle.top}px)`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity,
          }}
        />

        {/* Route Items List */}
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
                className="group relative flex items-center justify-between h-10 sm:h-11 2xl:h-12 w-full pl-5 pr-3 text-left transition-transform duration-150 ease-out cursor-pointer outline-none rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent"
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

                {isCreating ? (
                  /* Route creation loading state directly at the table insertion position */
                  <div className="flex items-center gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white animate-ping" />
                    <span className="font-mono text-xs sm:text-sm 2xl:text-base text-zinc-950 dark:text-white font-medium animate-pulse">
                      {displayName}
                    </span>
                    <span className="text-[10px] sm:text-xs font-mono text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 ml-2">
                      <Loader2 className="w-3 h-3 animate-spin text-zinc-600 dark:text-zinc-300" />
                      <span>{isRu ? 'создание...' : 'creating...'}</span>
                    </span>
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

                    {/* Delete Icon on the far right end */}
                    {routes.length > 1 && onDeleteRoute && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRoute(route.id);
                        }}
                        className="text-zinc-400 hover:text-red-500 dark:hover:text-red-400 cursor-pointer transition-colors p-1.5 rounded ml-auto"
                        title={isRu ? 'Удалить' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </SpecularCard>
  );
};
