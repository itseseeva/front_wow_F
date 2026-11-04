import React from 'react';
import {
  Route,
  Crosshair,
  SlidersHorizontal,
  BarChart3,
  CalendarClock,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { CalendarMonthResponse } from '../types';
import { CalendarMonthView } from './CalendarMonthView';

export type NavTab = 'routes' | 'rotation' | 'schedule' | 'summary' | 'settings';

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
  // Calendar integration props for summary tab
  selectedDate: string;
  onSelectDate: (date: string) => void;
  calendarMonthData: CalendarMonthResponse | null;
  calendarYear: number;
  calendarMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onRefreshCalendar: () => void;
  onExportCalendar: () => void;
  language: 'ru' | 'en';
  theme?: 'dark' | 'light';
}

export const StealthHUDLeftSidebar: React.FC<StealthHUDLeftSidebarProps> = ({
  activeTab,
  onTabChange,
  selectedDate,
  onSelectDate,
  calendarMonthData,
  calendarYear,
  calendarMonth,
  onPrevMonth,
  onNextMonth,
  onRefreshCalendar,
  onExportCalendar,
  language,
}) => {
  const isRu = language === 'ru';

  const NAV_ITEMS: {
    id: NavTab;
    labelRu: string;
    labelEn: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'routes', labelRu: 'Навигация и фарм', labelEn: 'Navigation & Farm', icon: Route },
    { id: 'rotation', labelRu: 'Бой / Ротация', labelEn: 'Combat / Rotation', icon: Crosshair },
    { id: 'schedule', labelRu: 'Расписание', labelEn: 'Schedule', icon: CalendarClock },
    { id: 'summary', labelRu: 'Статистика', labelEn: 'Statistics', icon: BarChart3 },
    { id: 'settings', labelRu: 'Настройки', labelEn: 'Settings', icon: SlidersHorizontal },
  ];

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

        {/* 2. Vertical Fixed Navigation (Sections with Text & White Active Indicator) */}
        <nav className="relative bg-transparent py-1 flex flex-col gap-1 transition-all duration-200 border-b border-black/10 dark:border-white/10 pb-3">
          <div className="px-2 pb-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              {isRu ? 'Разделы' : 'Sections'}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onTabChange(item.id);
                  }}
                  className={`group/item relative flex items-center h-10 w-full pl-2.5 pr-2 rounded-xl transition-all duration-150 cursor-pointer outline-none ${
                    isActive
                      ? 'text-zinc-950 dark:text-white bg-black/[0.04] dark:bg-white/[0.05]'
                      : 'text-zinc-400 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  }`}
                >
                  {/* Left White Accent Bar (Pure white in dark theme, replacing blue) */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_rgba(255,255,255,0.9)] transition-all duration-200" />
                  )}

                  {/* Icon Column (Icon + Glowing dot below when active) */}
                  <div className="flex flex-col items-center justify-center w-8 shrink-0 relative">
                    <Icon
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isActive
                          ? 'text-zinc-950 dark:text-white scale-105'
                          : 'text-zinc-400 dark:text-zinc-400 group-hover/item:text-zinc-800 dark:group-hover/item:text-zinc-200 group-hover/item:scale-105'
                      }`}
                      strokeWidth={isActive ? 2 : 1.75}
                    />
                    {/* Glowing dot underneath active icon */}
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(0,0,0,0.5)] dark:shadow-[0_0_8px_rgba(255,255,255,0.95)] mt-0.5 shrink-0" />
                    )}
                  </div>

                  {/* Text Label: Always visible and pinned */}
                  <div className="flex items-center ml-3 min-w-0">
                    <span
                      className={`font-mono text-sm tracking-wide whitespace-nowrap truncate transition-colors duration-150 ${
                        isActive
                          ? 'text-zinc-950 dark:text-white font-medium'
                          : 'text-zinc-500 dark:text-zinc-400 group-hover/item:text-zinc-900 dark:group-hover/item:text-zinc-100'
                      }`}
                    >
                      {isRu ? item.labelRu : item.labelEn}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
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

        {/* 3. Calendar Month View in Left Panel */}
        {activeTab === 'summary' && (
          <CalendarMonthView
            currentYear={calendarYear}
            currentMonth={calendarMonth}
            selectedDate={selectedDate}
            monthData={calendarMonthData}
            onSelectDate={onSelectDate}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
            onRefresh={onRefreshCalendar}
            onExport={onExportCalendar}
            language={language}
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
