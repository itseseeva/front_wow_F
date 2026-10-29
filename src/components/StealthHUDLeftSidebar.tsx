import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Route,
  Crosshair,
  Layers,
  SlidersHorizontal,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

export type NavTab = 'routes' | 'rotation' | 'gather' | 'settings';

export interface RouteItem {
  id: string;
  name: string;
  type: string;
  duration: string;
  points: number;
  active: boolean;
}

export interface ResourceFilterItem {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  enabled: boolean;
}

interface StealthHUDLeftSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  routes: RouteItem[];
  onSelectRoute: (id: string) => void;
  onDeleteRoute: (id: string) => void;
  isRouteVisible: boolean;
  onToggleRouteVisible: () => void;
  onRecordRouteClick: () => void;
  resourceFilters: ResourceFilterItem[];
  onToggleResource: (id: string) => void;
  language: 'ru' | 'en';
}

export const StealthHUDLeftSidebar: React.FC<StealthHUDLeftSidebarProps> = ({
  activeTab,
  onTabChange,
  routes,
  onSelectRoute,
  onDeleteRoute,
  isRouteVisible,
  onToggleRouteVisible,
  onRecordRouteClick,
  resourceFilters,
  onToggleResource,
  language,
}) => {
  const isRu = language === 'ru';

  // Refs for tracking positions to animate the sliding active line indicator
  const routesContainerRef = useRef<HTMLDivElement | null>(null);
  const routeItemsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const activeRoute = routes.find((r) => r.active);
  const activeRouteId = activeRoute?.id || (routes[0] ? routes[0].id : '');

  const [indicatorStyle, setIndicatorStyle] = useState<{ top: number; height: number; opacity: number }>({
    top: 0,
    height: 0,
    opacity: 0,
  });

  const updateActiveIndicator = useCallback(() => {
    const activeEl = routeItemsRef.current.get(activeRouteId);
    const container = routesContainerRef.current;
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
  }, [updateActiveIndicator, routes, activeTab]);

  return (
    <aside
      className="fixed top-0 left-0 z-20 flex flex-col justify-between select-none border border-transparent hover:border-white/[0.08] rounded-xl transition-all duration-200"
      style={{
        width: '300px',
        height: 'calc(100vh - 40px)',
        margin: '20px',
        background: 'transparent',
        boxShadow: 'none',
      }}
    >
      {/* Top Section */}
      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        {/* 1. Minimalist Monochrome Logo Lockup */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-white font-mono">
              EZF
            </span>
            <span className="text-[10px] text-zinc-500 font-medium tracking-wider font-mono">
              BOT CLIENT
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
            v2.4
          </span>
        </div>

        {/* 2. Strict Segmented Control Navigation (Borderless in Idle) */}
        <nav className="bg-transparent p-0.5 rounded-xl border border-transparent hover:border-white/[0.08] flex items-center gap-1 transition-all duration-200">
          {/* Tab 1: Routes */}
          <button
            type="button"
            onClick={() => onTabChange('routes')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'routes'
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isRu ? 'Маршруты' : 'Routes'}
          >
            <Route className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'routes' && (
              <span className="w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 2: Rotation */}
          <button
            type="button"
            onClick={() => onTabChange('rotation')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'rotation'
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isRu ? 'Боевая ротация' : 'Combat Rotation'}
          >
            <Crosshair className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'rotation' && (
              <span className="w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 3: Resource Filters */}
          <button
            type="button"
            onClick={() => onTabChange('gather')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'gather'
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isRu ? 'Фильтры ресурсов' : 'Resource Filters'}
          >
            <Layers className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'gather' && (
              <span className="w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 4: Settings */}
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'text-white'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={isRu ? 'Настройки' : 'Settings'}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'settings' && (
              <span className="w-1 h-1 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>
        </nav>

        {/* Dynamic Sidebar Content */}

        {/* 1. Routes View with Line-Sidebar Rail */}
        {activeTab === 'routes' && (
          <div className="flex flex-col gap-3 animate-fadeIn">
            {/* Header: Маршруты фарма (N) */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-mono font-medium text-zinc-400">
                {isRu ? 'Список маршрутов' : 'Route List'}
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                {routes.length}
              </span>
            </div>

            {/* Button: + Записать маршрут (Ghost Button) */}
            <SpecularButton
              onClick={() => {
                soundFx.playClick();
                onRecordRouteClick();
              }}
              className="w-full h-9 rounded-lg flex items-center justify-center gap-2 cursor-pointer border border-transparent hover:border-white/[0.08] bg-transparent text-xs text-zinc-400 hover:text-white transition-all"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isRu ? 'Записать маршрут' : 'Record Route'}</span>
            </SpecularButton>

            {/* Routes List in Line-Sidebar Rail Style */}
            <div
              ref={routesContainerRef}
              className="relative flex flex-col gap-1.5 py-1 pl-4"
            >
              {/* Continuous Guide Line Rail */}
              <div className="absolute left-[7px] top-1.5 bottom-1.5 w-[1px] bg-white/[0.1]" />

              {/* Dynamic Sliding Active Line Indicator (Smoothly glides between routes) */}
              <div
                className="absolute left-[6.5px] w-[2px] bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] rounded-full transition-all duration-250 ease-out pointer-events-none z-20"
                style={{
                  transform: `translateY(${indicatorStyle.top}px)`,
                  height: `${indicatorStyle.height}px`,
                  opacity: indicatorStyle.opacity,
                }}
              />

              {routes.map((route) => {
                const isActive = route.active;
                return (
                  <SpecularCard
                    key={route.id}
                    ref={(el: HTMLDivElement | null) => {
                      if (el) routeItemsRef.current.set(route.id, el);
                      else routeItemsRef.current.delete(route.id);
                    }}
                    onClick={() => onSelectRoute(route.id)}
                    className="group relative p-2.5 pl-3 rounded-lg flex flex-col gap-1.5 transition-all cursor-pointer border border-transparent hover:border-white/[0.08] bg-transparent"
                  >
                    {/* Horizontal Tick from vertical line rail into this item */}
                    <span
                      className={`absolute left-[-9px] top-4 h-[1px] transition-all duration-200 pointer-events-none ${
                        isActive
                          ? 'w-3.5 bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                          : 'w-2 bg-white/20 group-hover:w-3 group-hover:bg-zinc-300'
                      }`}
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm tracking-wide transition-colors ${
                            isActive
                              ? 'text-white font-semibold'
                              : 'text-zinc-400 group-hover:text-zinc-200'
                          }`}
                        >
                          {route.name}
                        </span>
                        {/* Unboxed Route Type Badge */}
                        <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400 transition-colors">
                          {route.type}
                        </span>
                      </div>

                      {/* Status Indicator */}
                      {isActive ? (
                        <span className="text-[11px] font-mono text-zinc-200 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                          {isRu ? 'Активен' : 'Active'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {isRu ? 'Готов' : 'Ready'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-0.5">
                      <span className="text-xs text-zinc-500 font-mono tabular-nums">
                        {route.duration}
                      </span>

                      <div className="flex items-center gap-2 text-zinc-500">
                        {routes.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRoute(route.id);
                            }}
                            className="hover:text-red-400 cursor-pointer transition-colors p-1"
                            title={isRu ? 'Удалить' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            soundFx.playClick();
                            onToggleRouteVisible();
                          }}
                          className="hover:text-white cursor-pointer transition-colors p-1"
                          title={
                            isRouteVisible
                              ? isRu
                                ? 'Скрыть'
                                : 'Hide'
                              : isRu
                              ? 'Показать'
                              : 'Show'
                          }
                        >
                          {isRouteVisible ? (
                            <EyeOff className="w-3.5 h-3.5" />
                          ) : (
                            <Eye className="w-3.5 h-3.5 text-zinc-200" />
                          )}
                        </button>
                      </div>
                    </div>
                  </SpecularCard>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Resource Filters View */}
        {activeTab === 'gather' && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-400 pt-1">
              {isRu ? 'Фильтры ресурсов' : 'Resource Filters'}
            </span>

            <div className="space-y-1.5">
              {resourceFilters.map((res, idx) => (
                <SpecularCard
                  key={res.id}
                  onClick={() => onToggleResource(res.id)}
                  className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-all border border-transparent hover:border-white/[0.08] bg-transparent ${
                    res.enabled ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        idx === 0
                          ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                          : idx === 1
                          ? 'bg-zinc-300'
                          : idx === 2
                          ? 'bg-zinc-400'
                          : idx === 3
                          ? 'bg-zinc-500'
                          : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-xs text-zinc-300 font-medium">
                      {isRu ? res.name : res.nameEn}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-mono ${
                      res.enabled
                        ? 'text-white font-semibold'
                        : 'text-zinc-600'
                    }`}
                  >
                    {res.enabled ? (isRu ? 'ВКЛ' : 'ON') : (isRu ? 'ВЫКЛ' : 'OFF')}
                  </span>
                </SpecularCard>
              ))}
            </div>
          </div>
        )}

        {/* 3. Rotation Sidebar Overview */}
        {activeTab === 'rotation' && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-400 pt-1">
              {isRu ? 'Боевая ротация' : 'Combat Rotation'}
            </span>
            <div className="p-3 bg-transparent border border-transparent hover:border-white/[0.08] rounded-lg text-xs space-y-2 text-zinc-500 transition-all">
              <p className="leading-relaxed">
                {isRu
                  ? 'Справа открыт редактор ротации. Настройте шаги заклинаний, тайминги каста и привязку клавиш.'
                  : 'Rotation editor is active on the right. Configure spells, cast times, and keybindings.'}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-transparent text-zinc-400">
                <span>{isRu ? 'Режим:' : 'Mode:'}</span>
                <span className="font-mono text-zinc-200 font-semibold">{isRu ? 'Сбор' : 'Gather'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Settings Sidebar Overview */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-400 pt-1">
              {isRu ? 'Настройки' : 'Settings'}
            </span>
            <div className="p-3 bg-transparent border border-transparent hover:border-white/[0.08] rounded-lg text-xs space-y-2 text-zinc-500 transition-all">
              <p className="leading-relaxed">
                {isRu
                  ? 'Справа доступны системные параметры горячих клавиш: захват цели и зум миникарты.'
                  : 'System hotkey parameters are active on the right: previous target and minimap zoom.'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Section */}
      <div className="p-4 border-t border-transparent">
        <p className="text-[11px] text-zinc-600 leading-normal">
          {isRu
            ? 'Автоматический выбор узлов фарма на основе радиуса обзора и оптимизации времени круга.'
            : 'Automated harvesting waypoint selection based on radar range and lap efficiency.'}
        </p>
      </div>
    </aside>
  );
};
