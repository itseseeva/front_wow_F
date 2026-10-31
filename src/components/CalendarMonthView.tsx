import React, { useMemo } from 'react';
import { CalendarMonthResponse, CalendarDay } from '../types';
import { ChevronLeft, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

function toRoman(num: number): string {
  if (num <= 0) return '';
  const romanNumerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [val, sym] of romanNumerals) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

interface CalendarMonthViewProps {
  currentYear: number;
  currentMonth: number; // 1..12
  selectedDate: string; // 'YYYY-MM-DD'
  monthData: CalendarMonthResponse | null;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onRefresh: () => void;
  onExport: () => void;
  language: 'ru' | 'en';
}

const RU_MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const RU_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const EN_WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentYear,
  currentMonth,
  selectedDate,
  monthData,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onRefresh,
  onExport,
  language,
}) => {
  const isRu = language === 'ru';
  const monthName = isRu ? RU_MONTHS[currentMonth - 1] : EN_MONTHS[currentMonth - 1];
  const weekdays = isRu ? RU_WEEKDAYS : EN_WEEKDAYS;

  // Local ISO date for today (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Quick lookup of calendar days by date string
  const daysMap = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    if (monthData?.days) {
      for (const d of monthData.days) {
        map.set(d.date, d);
      }
    }
    return map;
  }, [monthData]);

  // Calendar matrix calculation (Monday start)
  const { totalDays, startOffset } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const offset = (firstDay.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    return { totalDays: daysInMonth, startOffset: offset };
  }, [currentYear, currentMonth]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const ym = `${currentYear}-${pad(currentMonth)}`;

  return (
    <div className="flex flex-col justify-between flex-1 select-none font-mono text-zinc-950 dark:text-zinc-100 animate-fadeIn">
      <div className="flex flex-col gap-2.5">
        {/* 1. Month Header & Month Navigation */}
        <div className="flex items-center justify-between pb-1 pt-0.5 border-b border-black/10 dark:border-white/10">
          <span className="text-xs font-semibold tracking-wider uppercase text-zinc-900 dark:text-zinc-100">
            {monthName} {currentYear}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onPrevMonth();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={isRu ? 'Предыдущий месяц' : 'Previous month'}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onNextMonth();
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={isRu ? 'Следующий месяц' : 'Next month'}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Compact Month Calendar Grid */}
        <div className="w-full">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center pb-1 text-[10px] text-zinc-500 font-medium">
            {weekdays.map((wd, i) => (
              <span key={i} className={i >= 5 ? 'text-zinc-400 dark:text-zinc-600' : ''}>
                {wd}
              </span>
            ))}
          </div>

          {/* Days cells */}
          <div className="grid grid-cols-7 gap-y-1 gap-x-0.5 text-center text-xs">
            {/* Empty slots before first day */}
            {Array.from({ length: startOffset }).map((_, idx) => (
              <div key={`empty-${idx}`} className="h-8" />
            ))}

            {/* Days of month */}
            {Array.from({ length: totalDays }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${ym}-${pad(dayNum)}`;
              const dayData = daysMap.get(dateStr);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const hasSessions = Boolean(dayData && dayData.sessions > 0);
              const routeCount = dayData?.routes?.length || (dayData?.sessions ? 1 : 0);

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onSelectDate(dateStr);
                  }}
                  className={`h-8 rounded flex flex-col items-center justify-center relative transition-all cursor-pointer border ${
                    isSelected
                      ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white font-bold'
                      : hasSessions
                      ? 'border-transparent hover:border-black/20 dark:hover:border-white/20 text-zinc-900 dark:text-zinc-200'
                      : 'border-transparent hover:border-black/10 dark:hover:border-white/10 text-zinc-400 dark:text-zinc-600'
                  }`}
                  title={
                    hasSessions
                      ? `${dateStr}: ${dayData?.sessions} ${isRu ? 'сессий' : 'sessions'}`
                      : `${dateStr}: ${isRu ? 'В этот день бот не работал' : 'No sessions on this day'}`
                  }
                >
                  {/* Day Number (underlined if today) */}
                  <span
                    className={`text-[11px] leading-none ${
                      isToday ? 'underline decoration-1 underline-offset-2' : ''
                    }`}
                  >
                    {dayNum}
                  </span>

                  {/* Roman numerals for route count & problem marker */}
                  <div className="flex items-center justify-center gap-0.5 mt-0.5 h-2">
                    {hasSessions && routeCount > 0 && (
                      <span className="text-[8.5px] font-mono leading-none tracking-tight text-zinc-700 dark:text-zinc-300 font-semibold select-none">
                        {toRoman(routeCount)}
                      </span>
                    )}
                    {dayData?.problem && (
                      <span className="w-1 h-1 rounded-full bg-red-500 shrink-0 animate-pulse ml-0.5" title="Problem" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Route Legend of the Month */}
        {monthData?.routes && monthData.routes.length > 0 && (
          <div className="pt-2 border-t border-black/10 dark:border-white/10 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              {isRu ? 'Маршруты месяца' : 'Month Routes'}
            </span>
            <div className="flex flex-col gap-1">
              {monthData.routes.map((r, rIdx) => {
                const cleanName = r.name.replace(/\s*\([^)]*\)/g, '').trim();
                return (
                  <div key={r.route_id} className="flex items-center gap-1.5 text-[10px] text-zinc-600 dark:text-zinc-400 truncate font-mono">
                    <span className="text-[9px] font-semibold text-zinc-500 dark:text-zinc-400 w-3 shrink-0">
                      {toRoman(rIdx + 1)}
                    </span>
                    <span className="truncate">{cleanName}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 5. Bottom Action Buttons: Экспорт & Обновить (retained at the bottom of the column) */}
      <div className="flex items-center gap-1.5 pt-3 pb-1 border-t border-black/10 dark:border-white/10 mt-2">
        <SpecularButton
          onClick={() => {
            soundFx.playClick();
            onExport();
          }}
          className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer border border-black/10 dark:border-white/10 bg-transparent text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all font-mono"
          title={isRu ? 'Экспорт данных' : 'Export data'}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isRu ? 'Экспорт' : 'Export'}</span>
        </SpecularButton>

        <SpecularButton
          onClick={() => {
            soundFx.playClick();
            onRefresh();
          }}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border border-black/10 dark:border-white/10 bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all"
          title={isRu ? 'Обновить календарь' : 'Refresh calendar'}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </SpecularButton>
      </div>
    </div>
  );
};
