import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RouteItem } from './StealthHUDLeftSidebar';
import { SpecularCard } from './ui/Specular';

interface LineSidebarRouteListProps {
  routes: RouteItem[];
  activeRouteId: string;
  onSelectRoute: (id: string) => void;
  language?: 'ru' | 'en';
}

export const LineSidebarRouteList: React.FC<LineSidebarRouteListProps> = ({
  routes,
  activeRouteId,
  onSelectRoute,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  return (
    <SpecularCard className="w-full rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent shadow-none p-5 select-none transition-all duration-200">
      {/* Title / Section Header (minimal sentence-case, borderless) */}
      <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-transparent">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
          <h2 className="text-xs font-mono font-medium text-zinc-300 uppercase tracking-wider">
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
        <div className="absolute left-[7px] top-1 bottom-1 w-[1px] bg-white/[0.1]" />

        {/* Dynamic Sliding Active Line Indicator */}
        <div
          className="absolute left-[6.5px] w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-250 ease-out pointer-events-none"
          style={{
            transform: `translateY(${indicatorStyle.top}px)`,
            height: `${indicatorStyle.height}px`,
            opacity: indicatorStyle.opacity,
          }}
        />

        {/* Route Items List */}
        <div className="flex flex-col gap-1.5 relative z-10">
          {routes.map((route) => {
            const isActive = route.id === activeRouteId;
            const isHovered = hoveredId === route.id;
            const offset = proximityOffsets[route.id] || 0;

            return (
              <button
                key={route.id}
                ref={(el) => {
                  if (el) itemsRef.current.set(route.id, el);
                  else itemsRef.current.delete(route.id);
                }}
                type="button"
                onClick={() => onSelectRoute(route.id)}
                onMouseEnter={() => setHoveredId(route.id)}
                className="group relative flex items-center h-10 w-full pl-5 pr-3 text-left transition-transform duration-150 ease-out cursor-pointer outline-none rounded-lg border border-transparent hover:border-white/[0.08] bg-transparent"
                style={{
                  transform: `translateX(${offset}px)`,
                }}
              >
                {/* Horizontal Tick from line rail */}
                <span
                  className={`absolute left-[-9px] h-[1px] transition-all duration-200 ${
                    isActive
                      ? 'w-3.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                      : isHovered
                      ? 'w-3 bg-zinc-300'
                      : 'w-2 bg-white/20'
                  }`}
                />

                {/* Route Name Only */}
                <span
                  className={`font-mono text-xs sm:text-sm tracking-wide transition-colors duration-150 ${
                    isActive
                      ? 'text-white font-semibold'
                      : isHovered
                      ? 'text-zinc-200'
                      : 'text-zinc-500'
                  }`}
                >
                  {route.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </SpecularCard>
  );
};
