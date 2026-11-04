import React, { useState, useEffect } from 'react';
import { Clock, UserX, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { ScheduleStatus, SchedulePhase } from '../types';

interface ScheduleHUDCardProps {
  scheduleStatus: ScheduleStatus | null;
  language: 'ru' | 'en';
  onOpenSchedule?: () => void;
  onOpenSettings?: () => void;
}

const PHASE_NAMES_RU: Record<SchedulePhase, string> = {
  farm: 'Фарм',
  short_break: 'Короткий перерыв',
  long_break: 'Длинный перерыв',
  wait_window: 'Ждёт окна часов',
  day_done: 'На сегодня всё',
  off_day: 'Выходной',
  idle: 'Остановлен',
};

const PHASE_NAMES_EN: Record<SchedulePhase, string> = {
  farm: 'Farming',
  short_break: 'Short break',
  long_break: 'Long break',
  wait_window: 'Waiting for window',
  day_done: 'Done for today',
  off_day: 'Day off',
  idle: 'Stopped',
};

function formatHoursMinutes(seconds: number, isRu: boolean): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hrs > 0) {
    return isRu ? `${hrs}ч ${mins}м` : `${hrs}h ${mins}m`;
  }
  return isRu ? `${mins}м` : `${mins}m`;
}

function formatClockTime(ms: number | null): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatCountdown(targetMs: number | null, nowMs: number): string | null {
  if (!targetMs || targetMs <= nowMs) return null;
  const diffSec = Math.floor((targetMs - nowMs) / 1000);
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const ScheduleHUDCard: React.FC<ScheduleHUDCardProps> = ({
  scheduleStatus,
  language,
  onOpenSchedule,
  onOpenSettings,
}) => {
  const isRu = language === 'ru';
  const handleOpen = onOpenSchedule || onOpenSettings;
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Update clock every second for exact countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!scheduleStatus) return null;

  const isEnabled = scheduleStatus.enabled !== false;
  const phase = scheduleStatus.phase || 'idle';
  const phaseName = isRu ? PHASE_NAMES_RU[phase] || phase : PHASE_NAMES_EN[phase] || phase;
  const today = scheduleStatus.today;
  const phaseUntil = scheduleStatus.phase_until_ms;

  // When schedule is disabled: collapsed card «Расписание выключено»
  if (!isEnabled) {
    return (
      <div
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all cursor-pointer select-none text-zinc-500 dark:text-zinc-400 font-mono text-[11px]"
        title={isRu ? 'Нажмите для настройки расписания' : 'Click to configure schedule'}
      >
        <Clock className="w-3 h-3 stroke-[1.5] text-zinc-400" />
        <span>{isRu ? 'Расписание выключено' : 'Schedule disabled'}</span>
      </div>
    );
  }

  // Countdown & Time string: «до 14:32, через 12:05»
  const untilTimeStr = formatClockTime(phaseUntil);
  const countdownStr = formatCountdown(phaseUntil, nowMs);
  const timingText = phaseUntil && countdownStr
    ? (isRu ? `до ${untilTimeStr}, через ${countdownStr}` : `until ${untilTimeStr}, in ${countdownStr}`)
    : (phaseUntil ? (isRu ? `до ${untilTimeStr}` : `until ${untilTimeStr}`) : null);

  // Progress calculations: played_s / budget_s
  const playedS = today?.played_s || 0;
  const budgetS = Math.max(1, today?.budget_s || 14400);
  const progressRatio = Math.min(1, playedS / budgetS);
  const progressPercent = Math.min(100, Math.round(progressRatio * 100));

  const playedStr = formatHoursMinutes(playedS, isRu);
  const budgetStr = formatHoursMinutes(budgetS, isRu);

  // Window string: start_ms–end_ms
  const windowStartStr = today?.start_ms ? formatClockTime(today.start_ms) : null;
  const windowEndStr = today?.end_ms ? formatClockTime(today.end_ms) : null;
  const windowText = windowStartStr && windowEndStr ? `${windowStartStr}–${windowEndStr}` : null;

  return (
    <div className="relative flex flex-col justify-center rounded-xl border border-black/10 dark:border-white/[0.08] bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md px-3 py-1.5 select-none transition-all duration-200 text-xs font-mono shadow-sm">
      {/* Top Header Row: Phase + Countdown + Expand/Collapse */}
      <div className="flex items-center justify-between gap-3 min-w-[210px] sm:min-w-[270px]">
        {/* Phase Pill */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              phase === 'farm'
                ? 'bg-zinc-950 dark:bg-white animate-pulse shadow-[0_0_6px_rgba(255,255,255,0.8)]'
                : phase === 'short_break' || phase === 'long_break'
                ? 'bg-zinc-500'
                : 'bg-zinc-400 dark:bg-zinc-600'
            }`}
          />
          <span className="font-semibold text-zinc-950 dark:text-white tracking-wide">
            {phaseName}
          </span>
          {scheduleStatus.in_world === false && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded border border-black/10 dark:border-white/10 text-[10px] text-zinc-500 dark:text-zinc-400 bg-black/[0.03] dark:bg-white/[0.03]"
              title={isRu ? 'Персонаж в меню персонажей' : 'Character in character selection'}
            >
              <UserX className="w-2.5 h-2.5" />
              <span>{isRu ? 'в меню персонажей' : 'in char menu'}</span>
            </span>
          )}
        </div>

        {/* Right side: Countdown and collapse toggle */}
        <div className="flex items-center gap-1.5 ml-auto text-right">
          {timingText && (
            <span className="text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
              {timingText}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded((prev) => !prev);
            }}
            className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-0.5 rounded cursor-pointer transition-colors"
            title={isExpanded ? (isRu ? 'Свернуть' : 'Collapse') : (isRu ? 'Развернуть' : 'Expand')}
          >
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Details Row: Progress Bar, Sessions, Day Window, Note */}
      {isExpanded && (
        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-black/5 dark:border-white/[0.05]">
          {/* Progress Bar & Played/Budget */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 gap-2">
            <span>
              {isRu ? 'сегодня:' : 'today:'} <strong className="text-zinc-900 dark:text-zinc-200">{playedStr}</strong> / {budgetStr}
            </span>
            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
              {progressPercent}%
            </span>
          </div>

          <div className="w-full h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-zinc-950 dark:bg-white transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Sessions Count & Day Window */}
          <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 gap-2 mt-0.5">
            <div className="flex items-center gap-2">
              {today?.sessions !== undefined && (
                <span>
                  {today.sessions} {isRu ? (today.sessions === 1 ? 'сессия' : today.sessions < 5 ? 'сессии' : 'сессий') : 'sessions'}
                </span>
              )}
              {windowText && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5 text-zinc-400" />
                  <span>{isRu ? `окно: ${windowText}` : `window: ${windowText}`}</span>
                </span>
              )}
            </div>

            {handleOpen && (
              <button
                type="button"
                onClick={handleOpen}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline cursor-pointer text-[10px]"
              >
                {isRu ? 'настроить' : 'config'}
              </button>
            )}
          </div>

          {/* Backend Note */}
          {scheduleStatus.note && (
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 italic truncate max-w-[280px] sm:max-w-[340px]">
              {scheduleStatus.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
