import React from 'react';
import {
  Route,
  Crosshair,
  SlidersHorizontal,
  BarChart3,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { SessionSummaryData } from '../types';
import { StealthHUDSessionSummary } from './StealthHUDSessionSummary';

export type NavTab = 'routes' | 'rotation' | 'summary' | 'settings';

export interface RouteItem {
  id: string;
  name: string;
  type: string;
  duration: string;
  points: number;
  active: boolean;
  isCreating?: boolean;
  isRecording?: boolean;
  recordingSeconds?: number;
}

interface StealthHUDLeftSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  routes: RouteItem[];
  onSelectRoute: (id: string) => void;
  onDeleteRoute: (id: string) => void;
  onRecordRouteClick?: () => void;
  sessionSummary?: SessionSummaryData | null;
  onResetSessionSummary?: () => void;
  language: 'ru' | 'en';
  theme?: 'dark' | 'light';
}

export const StealthHUDLeftSidebar: React.FC<StealthHUDLeftSidebarProps> = ({
  activeTab,
  onTabChange,
  onRecordRouteClick,
  sessionSummary,
  onResetSessionSummary,
  language,
}) => {
  const isRu = language === 'ru';

  return (
    <aside
      className="relative flex flex-col justify-between select-none border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] rounded-2xl transition-all duration-200 h-[calc(100vh-20px)] sm:h-[calc(100vh-28px)] xl:h-[calc(100vh-36px)] m-2.5 sm:m-3.5 xl:m-4.5 w-[230px] sm:w-[245px] md:w-[260px] lg:w-[275px] xl:w-[290px] 2xl:w-[305px] shrink-0 bg-transparent shadow-none"
    >
      {/* Top Section */}
      <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 overflow-y-auto">
        {/* 1. Minimalist Monochrome Logo Lockup */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-white font-mono">
              EZF
            </span>
            <span className="text-[10px] text-zinc-500 font-medium tracking-wider font-mono">
              WOW FOREVER
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">
            v2.4
          </span>
        </div>

        {/* 2. Strict Segmented Control Navigation (Routes, Rotation, Summary, Settings) */}
        <nav className="bg-transparent p-0.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] flex items-center gap-1 transition-all duration-200">
          {/* Tab 1: Routes */}
          <button
            type="button"
            onClick={() => onTabChange('routes')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'routes'
                ? 'text-zinc-950 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
            title={isRu ? 'Маршруты' : 'Routes'}
          >
            <Route className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'routes' && (
              <span className="w-1 h-1 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)] dark:shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 2: Rotation */}
          <button
            type="button"
            onClick={() => onTabChange('rotation')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'rotation'
                ? 'text-zinc-950 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
            title={isRu ? 'Боевая ротация' : 'Combat Rotation'}
          >
            <Crosshair className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'rotation' && (
              <span className="w-1 h-1 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)] dark:shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 3: Session Summary / Analytics */}
          <button
            type="button"
            onClick={() => onTabChange('summary')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'summary'
                ? 'text-zinc-950 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
            title={isRu ? 'Итоги сессии' : 'Session Summary'}
          >
            <BarChart3 className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'summary' && (
              <span className="w-1 h-1 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)] dark:shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>

          {/* Tab 4: Settings */}
          <button
            type="button"
            onClick={() => onTabChange('settings')}
            className={`flex-1 h-9 rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'text-zinc-950 dark:text-white font-semibold'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
            title={isRu ? 'Настройки' : 'Settings'}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
            {activeTab === 'settings' && (
              <span className="w-1 h-1 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.4)] dark:shadow-[0_0_6px_rgba(255,255,255,0.9)] absolute bottom-1" />
            )}
          </button>
        </nav>

        {/* Dynamic Sidebar Content */}

        {/* 1. Routes Tab Overview */}
        {activeTab === 'routes' && (
          <div className="flex flex-col gap-2.5 sm:gap-3 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 pt-1">
              {isRu ? 'Навигация и фарм' : 'Navigation & Farming'}
            </span>

            {/* Description Text */}
            <div className="p-3 bg-transparent border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] rounded-lg text-xs space-y-2 text-zinc-600 dark:text-zinc-400 transition-all">
              <p className="leading-relaxed">
                {isRu
                  ? 'Автоматический выбор узлов фарма на основе радиуса обзора и оптимизации времени круга.'
                  : 'Automated farming node navigation based on radar detection and route loop optimization.'}
              </p>
            </div>
          </div>
        )}

        {/* 2. Rotation Sidebar Overview */}
        {activeTab === 'rotation' && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 pt-1">
              {isRu ? 'Боевая ротация' : 'Combat Rotation'}
            </span>
            <div className="p-3 bg-transparent border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] rounded-lg text-xs space-y-2 text-zinc-600 dark:text-zinc-500 transition-all">
              <p className="leading-relaxed">
                {isRu
                  ? 'Справа открыт редактор ротации. Настройте шаги заклинаний, тайминги каста и привязку клавиш.'
                  : 'Rotation editor is open on the right. Configure spell sequence, cast timings, and keybindings.'}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-transparent text-zinc-600 dark:text-zinc-400">
                <span>{isRu ? 'Режим:' : 'Mode:'}</span>
                <span className="font-mono text-zinc-950 dark:text-zinc-200 font-semibold">{isRu ? 'Сбор' : 'Gather'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Session Summary / Analytics in Left Panel */}
        {activeTab === 'summary' && (
          <StealthHUDSessionSummary
            data={sessionSummary || null}
            language={language}
            onReset={onResetSessionSummary}
          />
        )}

        {/* 4. Settings Sidebar Overview */}
        {activeTab === 'settings' && (
          <div className="flex flex-col gap-2.5 animate-fadeIn">
            <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 pt-1">
              {isRu ? 'Настройки' : 'Settings'}
            </span>
            <div className="p-3 bg-transparent border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] rounded-lg text-xs space-y-2 text-zinc-600 dark:text-zinc-500 transition-all">
              <p className="leading-relaxed">
                {isRu
                  ? 'Справа доступны системные параметры горячих клавиш: захват цели, взаимодействие и экстренная пауза.'
                  : 'System hotkey parameters are open on the right: target selection, interact, and emergency pause.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
