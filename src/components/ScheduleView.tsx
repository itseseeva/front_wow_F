import React, { useState, useMemo } from 'react';
import {
  Clock,
  CalendarClock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Dice5,
  LogOut,
  Sliders,
  Sun,
  Moon,
  Coffee,
  Swords,
} from 'lucide-react';
import { ScheduleSettings, ScheduleStatus } from '../types';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { DEFAULT_SCHEDULE_SETTINGS, getGameDayMinutes } from '../data/mockSchedule';
import { soundFx } from '../utils/audio';

interface ScheduleViewProps {
  scheduleSettings: ScheduleSettings;
  onScheduleSettingsChange: (settings: ScheduleSettings) => void;
  scheduleStatus: ScheduleStatus | null;
  scheduleError: string | null;
  language: 'ru' | 'en';
  onToast?: (msg: string) => void;
}

// Preset Archetypes
interface SchedulePreset {
  id: string;
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  settings: Partial<ScheduleSettings>;
}

const PRESETS: SchedulePreset[] = [
  {
    id: 'balanced',
    nameRu: 'Сбалансированный',
    nameEn: 'Balanced',
    descRu: 'Оптимальное сочетание фарма и перерывов (по умолчанию)',
    descEn: 'Optimal balance of farming and breaks (default)',
    settings: {
      sessionMinutes: [40, 110],
      shortBreakMinutes: [4, 15],
      longBreakMinutes: [30, 90],
      longBreakEvery: [2, 3],
      dailyHours: [3, 5],
      offDayPercent: 15,
      windowStart: '10:00',
      windowEnd: '02:00',
      startJitterMinutes: 45,
      longBreakLogout: true,
    },
  },
  {
    id: 'stealth',
    nameRu: 'Скрытный / Человек',
    nameEn: 'Human Stealth',
    descRu: 'Короткие сессии, частые паузы, реалистичный человеческий ритм',
    descEn: 'Short sessions, frequent pauses, ultra-realistic human rhythm',
    settings: {
      sessionMinutes: [25, 60],
      shortBreakMinutes: [6, 18],
      longBreakMinutes: [45, 110],
      longBreakEvery: [2, 2],
      dailyHours: [2, 3.5],
      offDayPercent: 25,
      windowStart: '12:00',
      windowEnd: '23:30',
      startJitterMinutes: 60,
      longBreakLogout: true,
    },
  },
  {
    id: 'hardcore',
    nameRu: 'Интенсивный фарм',
    nameEn: 'Hardcore Grind',
    descRu: 'Длинные забеги, редкие паузы для максимального профита',
    descEn: 'Long grind sessions, short pauses for maximum yield',
    settings: {
      sessionMinutes: [75, 160],
      shortBreakMinutes: [3, 8],
      longBreakMinutes: [20, 50],
      longBreakEvery: [3, 5],
      dailyHours: [6, 9],
      offDayPercent: 5,
      windowStart: '08:00',
      windowEnd: '03:00',
      startJitterMinutes: 20,
      longBreakLogout: true,
    },
  },
  {
    id: 'night',
    nameRu: 'Ночной фармер',
    nameEn: 'Night Shift',
    descRu: 'Фарм в тихие ночные часы с минимальной конкуренцией',
    descEn: 'Farm during quiet night hours with minimal competition',
    settings: {
      sessionMinutes: [45, 95],
      shortBreakMinutes: [5, 12],
      longBreakMinutes: [30, 60],
      longBreakEvery: [2, 3],
      dailyHours: [3.5, 6],
      offDayPercent: 15,
      windowStart: '22:00',
      windowEnd: '05:00',
      startJitterMinutes: 30,
      longBreakLogout: true,
    },
  },
];

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleSettings,
  onScheduleSettingsChange,
  scheduleStatus: _scheduleStatus,
  scheduleError,
  language,
  onToast,
}) => {
  const isRu = language === 'ru';
  const [simulationSeed, setSimulationSeed] = useState<number>(1);

  const updateSetting = <K extends keyof ScheduleSettings>(key: K, val: ScheduleSettings[K]) => {
    onScheduleSettingsChange({
      ...scheduleSettings,
      [key]: val,
    });
  };

  const applyPreset = (preset: SchedulePreset) => {
    soundFx.playClick();
    onScheduleSettingsChange({
      ...scheduleSettings,
      ...preset.settings,
      enabled: true,
    });
    if (onToast) {
      onToast(isRu ? `Профиль «${preset.nameRu}» применён` : `Preset "${preset.nameEn}" applied`);
    }
  };

  const handleReset = () => {
    soundFx.playClick();
    onScheduleSettingsChange({ ...DEFAULT_SCHEDULE_SETTINGS });
    if (onToast) {
      onToast(isRu ? 'Расписание сброшено' : 'Schedule reset');
    }
  };

  // 24h Game Window calculations
  const startOffsetMin = getGameDayMinutes(scheduleSettings.windowStart, false);
  const endOffsetMin = getGameDayMinutes(scheduleSettings.windowEnd, true);
  const windowDurationMin = Math.max(0, endOffsetMin - startOffsetMin);
  const windowHours = (windowDurationMin / 60).toFixed(1);

  // Generate simulated day based on current settings & seed
  const simulatedDay = useMemo(() => {
    // Deterministic pseudo-random helper
    let seed = simulationSeed * 9301 + 49297;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const [sMin, sMax] = scheduleSettings.sessionMinutes;
    const [sbMin, sbMax] = scheduleSettings.shortBreakMinutes;
    const [lbMin, lbMax] = scheduleSettings.longBreakMinutes;
    const [lbeMin, lbeMax] = scheduleSettings.longBreakEvery;
    const [dhMin, dhMax] = scheduleSettings.dailyHours;

    // Daily budget
    const targetDailyMin = Math.round((dhMin + rnd() * (dhMax - dhMin)) * 60);
    const jitter = Math.round((rnd() * 2 - 1) * scheduleSettings.startJitterMinutes);

    // Compute start time
    const [sh, sm] = scheduleSettings.windowStart.split(':').map(Number);
    let currentMin = (sh || 10) * 60 + (sm || 0) + jitter;

    const timeline: {
      type: 'farm' | 'short_break' | 'long_break';
      startMin: number;
      durationMin: number;
      sessionNum?: number;
      label: string;
    }[] = [];

    let playedMin = 0;
    let sessionCount = 0;
    let nextLongBreakAt = Math.round(lbeMin + rnd() * (lbeMax - lbeMin));

    while (playedMin < targetDailyMin && sessionCount < 12) {
      sessionCount++;
      const sessionDur = Math.min(
        targetDailyMin - playedMin,
        Math.round(sMin + rnd() * (sMax - sMin))
      );

      timeline.push({
        type: 'farm',
        startMin: currentMin,
        durationMin: sessionDur,
        sessionNum: sessionCount,
        label: isRu ? `Фарм #${sessionCount}` : `Farm #${sessionCount}`,
      });

      playedMin += sessionDur;
      currentMin += sessionDur;

      if (playedMin >= targetDailyMin) break;

      // Break time
      if (sessionCount >= nextLongBreakAt) {
        const lbDur = Math.round(lbMin + rnd() * (lbMax - lbMin));
        timeline.push({
          type: 'long_break',
          startMin: currentMin,
          durationMin: lbDur,
          label: isRu ? 'Длинный перерыв' : 'Long break',
        });
        currentMin += lbDur;
        sessionCount = 0;
        nextLongBreakAt = Math.round(lbeMin + rnd() * (lbeMax - lbeMin));
      } else {
        const sbDur = Math.round(sbMin + rnd() * (sbMax - sbMin));
        timeline.push({
          type: 'short_break',
          startMin: currentMin,
          durationMin: sbDur,
          label: isRu ? 'Пауза' : 'Pause',
        });
        currentMin += sbDur;
      }
    }

    const formatM = (min: number) => {
      const normalized = ((min % 1440) + 1440) % 1440;
      const h = String(Math.floor(normalized / 60)).padStart(2, '0');
      const m = String(normalized % 60).padStart(2, '0');
      return `${h}:${m}`;
    };

    return {
      startTime: formatM(currentMin - playedMin),
      endTime: formatM(currentMin),
      totalPlayedHrs: (playedMin / 60).toFixed(1),
      sessionsTotal: timeline.filter((t) => t.type === 'farm').length,
      timeline,
      formatM,
    };
  }, [scheduleSettings, simulationSeed, isRu]);

  return (
    <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-12 flex flex-col justify-start overflow-y-auto animate-assemble text-zinc-900 dark:text-zinc-100 font-sans select-none">
      <div className="w-full max-w-5xl 2xl:max-w-7xl mx-auto flex flex-col gap-5">
        {/* =========================================================================
            HEADER & MASTER TOGGLE
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-black/10 dark:border-white/[0.08] gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              <h1 className="text-base sm:text-lg font-mono font-semibold text-zinc-950 dark:text-white tracking-wide flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                <span>{isRu ? 'Расписание фарма' : 'Farm Schedule'}</span>
              </h1>
            </div>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              {isRu
                ? 'Человекоподобные сессии, адаптивные перерывы и суточные окна работы'
                : 'Human-like session timings, adaptive breaks, and daily play window'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SpecularButton
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
              title={isRu ? 'Сбросить параметры' : 'Reset parameters'}
            >
              <RotateCcw className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
              <span>{isRu ? 'По умолчанию' : 'Defaults'}</span>
            </SpecularButton>

            {/* Master Toggle Button */}
            <button
              type="button"
              onClick={() => updateSetting('enabled', !scheduleSettings.enabled)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono font-semibold cursor-pointer transition-all duration-200 ${
                scheduleSettings.enabled
                  ? 'border-zinc-950 dark:border-white bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                  : 'border-black/15 dark:border-white/15 bg-transparent text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  scheduleSettings.enabled
                    ? 'bg-white dark:bg-zinc-950 animate-pulse'
                    : 'bg-zinc-400 dark:bg-zinc-600'
                }`}
              />
              <span>{scheduleSettings.enabled ? (isRu ? 'АКТИВНО' : 'ENABLED') : (isRu ? 'ВЫКЛЮЧЕНО' : 'DISABLED')}</span>
            </button>
          </div>
        </div>

        {/* Schedule Validation Error Banner */}
        {scheduleError && (
          <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-mono text-xs flex items-center gap-3 animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span className="leading-snug">{scheduleError}</span>
          </div>
        )}

        {/* =========================================================================
            QUICK ARCHETYPE PRESETS (One-Click Setup)
            ========================================================================= */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRu ? 'Готовые профили поведения' : 'Behavior Profiles'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESETS.map((p) => (
              <SpecularCard
                key={p.id}
                onClick={() => applyPreset(p)}
                className="p-3 rounded-xl border border-black/10 dark:border-white/[0.08] hover:border-black/25 dark:hover:border-white/20 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm cursor-pointer transition-all duration-150 hover:-translate-y-0.5 group"
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="font-mono text-xs font-semibold text-zinc-950 dark:text-white group-hover:underline">
                    {isRu ? p.nameRu : p.nameEn}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono line-clamp-2 leading-relaxed">
                  {isRu ? p.descRu : p.descEn}
                </p>
              </SpecularCard>
            ))}
          </div>
        </div>

        {/* =========================================================================
            SECTION: INTERACTIVE 24-HOUR TIME WINDOW TRACK
            ========================================================================= */}
        <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white flex items-center gap-2">
                  <Sun className="w-4 h-4 text-zinc-500" />
                  <span>{isRu ? 'Окно игровых часов' : 'Playtime Window'}</span>
                  <span className="text-[11px] font-normal text-zinc-400 font-mono">
                    ({windowHours} {isRu ? 'ч окно' : 'hrs window'})
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {isRu
                    ? 'Игровой день с 05:00 до 05:00. Бот начинает и завершает работу только внутри этого окна.'
                    : 'Game day 05:00 to 05:00. Bot operates exclusively within this window.'}
                </p>
              </div>

              {/* Time Inputs */}
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-zinc-500">{isRu ? 'с' : 'from'}</span>
                <input
                  type="time"
                  value={scheduleSettings.windowStart}
                  onChange={(e) => updateSetting('windowStart', e.target.value || '10:00')}
                  className="h-8 px-2.5 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                />
                <span className="text-zinc-500">{isRu ? 'до' : 'to'}</span>
                <input
                  type="time"
                  value={scheduleSettings.windowEnd}
                  onChange={(e) => updateSetting('windowEnd', e.target.value || '02:00')}
                  className="h-8 px-2.5 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-center text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                />
              </div>
            </div>

            {/* Visual 24-Hour Game Timeline Bar */}
            <div className="flex flex-col gap-1.5 mt-2">
              <div className="relative w-full h-8 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 overflow-hidden flex items-center">
                {/* Active Window Fill */}
                <div
                  className="absolute top-0 bottom-0 bg-zinc-950/20 dark:bg-white/20 border-x border-zinc-950 dark:border-white transition-all duration-200"
                  style={{
                    left: `${(startOffsetMin / 1440) * 100}%`,
                    width: `${(windowDurationMin / 1440) * 100}%`,
                  }}
                />

                {/* Left Jitter Shading Zone */}
                {scheduleSettings.startJitterMinutes > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-black/10 dark:bg-white/10 border-r border-dashed border-zinc-500 transition-all duration-200"
                    style={{
                      left: `${(startOffsetMin / 1440) * 100}%`,
                      width: `${(scheduleSettings.startJitterMinutes / 1440) * 100}%`,
                    }}
                    title={isRu ? `Случайный сдвиг старта: до +${scheduleSettings.startJitterMinutes} мин` : `Start jitter`}
                  />
                )}

                {/* Right Jitter Shading Zone */}
                {scheduleSettings.startJitterMinutes > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-black/10 dark:bg-white/10 border-l border-dashed border-zinc-500 transition-all duration-200"
                    style={{
                      left: `${Math.max(0, (endOffsetMin - scheduleSettings.startJitterMinutes) / 1440) * 100}%`,
                      width: `${(scheduleSettings.startJitterMinutes / 1440) * 100}%`,
                    }}
                    title={isRu ? `Случайный сдвиг окончания: до -${scheduleSettings.startJitterMinutes} мин` : `End jitter`}
                  />
                )}

                {/* Hour Markers */}
                <div className="absolute inset-0 flex justify-between px-2 items-center pointer-events-none text-[9px] font-mono text-zinc-400">
                  <span>05:00</span>
                  <span>10:00</span>
                  <span>15:00</span>
                  <span>20:00</span>
                  <span>01:00</span>
                  <span>05:00</span>
                </div>
              </div>

              {/* Jitter Slider & Explanation */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-500">
                    {isRu ? 'Случайный сдвиг окна (джиттер):' : 'Window jitter:'}
                  </span>
                  <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                    ±{scheduleSettings.startJitterMinutes} {isRu ? 'мин' : 'min'}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-1 max-w-xs">
                  <input
                    type="range"
                    min={0}
                    max={120}
                    step={5}
                    value={scheduleSettings.startJitterMinutes}
                    onChange={(e) => updateSetting('startJitterMinutes', Number(e.target.value))}
                    className="w-full accent-zinc-950 dark:accent-white cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </SpecularCard>

        {/* =========================================================================
            SECTION: INTERACTIVE SLIDERS FOR SESSIONS & BREAKS
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Длина сессии (sessionMinutes 10..240) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Swords className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                    {isRu ? 'Длина сессии' : 'Session Duration'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-950 dark:text-white">
                  {scheduleSettings.sessionMinutes[0]} – {scheduleSettings.sessionMinutes[1]} {isRu ? 'мин' : 'min'}
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu ? 'Случайная длительность непрерывного фарма между паузами' : 'Random farming duration before taking a break'}
              </p>
            </div>

            {/* Dual Slider Controls */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                <input
                  type="range"
                  min={10}
                  max={scheduleSettings.sessionMinutes[1]}
                  step={5}
                  value={scheduleSettings.sessionMinutes[0]}
                  onChange={(e) =>
                    updateSetting('sessionMinutes', [Number(e.target.value), scheduleSettings.sessionMinutes[1]])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.sessionMinutes[0]}м</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                <input
                  type="range"
                  min={scheduleSettings.sessionMinutes[0]}
                  max={240}
                  step={5}
                  value={scheduleSettings.sessionMinutes[1]}
                  onChange={(e) =>
                    updateSetting('sessionMinutes', [scheduleSettings.sessionMinutes[0], Number(e.target.value)])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.sessionMinutes[1]}м</span>
              </div>
            </div>
          </SpecularCard>

          {/* Card 2: Короткий перерыв (shortBreakMinutes 1..60) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                    {isRu ? 'Короткий перерыв' : 'Short Break'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-950 dark:text-white">
                  {scheduleSettings.shortBreakMinutes[0]} – {scheduleSettings.shortBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu ? 'короткий перерыв — персонаж стоит на месте' : 'short break — character stays in place'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                <input
                  type="range"
                  min={1}
                  max={scheduleSettings.shortBreakMinutes[1]}
                  step={1}
                  value={scheduleSettings.shortBreakMinutes[0]}
                  onChange={(e) =>
                    updateSetting('shortBreakMinutes', [Number(e.target.value), scheduleSettings.shortBreakMinutes[1]])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.shortBreakMinutes[0]}м</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                <input
                  type="range"
                  min={scheduleSettings.shortBreakMinutes[0]}
                  max={60}
                  step={1}
                  value={scheduleSettings.shortBreakMinutes[1]}
                  onChange={(e) =>
                    updateSetting('shortBreakMinutes', [scheduleSettings.shortBreakMinutes[0], Number(e.target.value)])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.shortBreakMinutes[1]}м</span>
              </div>
            </div>
          </SpecularCard>

          {/* Card 3: Длинный перерыв (longBreakMinutes 10..240) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                    {isRu ? 'Длинный перерыв' : 'Long Break'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-950 dark:text-white">
                  {scheduleSettings.longBreakMinutes[0]} – {scheduleSettings.longBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu ? 'Длительный отдых для еды или отдыха игрока' : 'Extended resting period for meal or human activities'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                <input
                  type="range"
                  min={10}
                  max={scheduleSettings.longBreakMinutes[1]}
                  step={5}
                  value={scheduleSettings.longBreakMinutes[0]}
                  onChange={(e) =>
                    updateSetting('longBreakMinutes', [Number(e.target.value), scheduleSettings.longBreakMinutes[1]])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.longBreakMinutes[0]}м</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                <input
                  type="range"
                  min={scheduleSettings.longBreakMinutes[0]}
                  max={240}
                  step={5}
                  value={scheduleSettings.longBreakMinutes[1]}
                  onChange={(e) =>
                    updateSetting('longBreakMinutes', [scheduleSettings.longBreakMinutes[0], Number(e.target.value)])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.longBreakMinutes[1]}м</span>
              </div>
            </div>
          </SpecularCard>

          {/* Card 4: Частота длинного перерыва (longBreakEvery 1..10) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                    {isRu ? 'Частота длинного перерыва' : 'Long Break Frequency'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-zinc-950 dark:text-white">
                  {scheduleSettings.longBreakEvery[0]} – {scheduleSettings.longBreakEvery[1]} {isRu ? 'сессий' : 'sessions'}
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu ? 'После каждых N сессий наступает большой перерыв' : 'Trigger extended rest after every N sessions'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                <input
                  type="range"
                  min={1}
                  max={scheduleSettings.longBreakEvery[1]}
                  step={1}
                  value={scheduleSettings.longBreakEvery[0]}
                  onChange={(e) =>
                    updateSetting('longBreakEvery', [Number(e.target.value), scheduleSettings.longBreakEvery[1]])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.longBreakEvery[0]} с.</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                <input
                  type="range"
                  min={scheduleSettings.longBreakEvery[0]}
                  max={10}
                  step={1}
                  value={scheduleSettings.longBreakEvery[1]}
                  onChange={(e) =>
                    updateSetting('longBreakEvery', [scheduleSettings.longBreakEvery[0], Number(e.target.value)])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-12 text-right font-semibold">{scheduleSettings.longBreakEvery[1]} с.</span>
              </div>
            </div>
          </SpecularCard>
        </div>

        {/* =========================================================================
            SECTION: DAILY BUDGET, OFF-DAY CHANCE & LOGOUT SWITCH
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Hours (0.5..12 hrs) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                  {isRu ? 'Норма в день' : 'Daily Playtime'}
                </span>
                <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white">
                  {scheduleSettings.dailyHours[0]} – {scheduleSettings.dailyHours[1]} {isRu ? 'ч' : 'hrs'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu ? 'Суммарный лимит игры за сутки' : 'Total daily budget limit'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1 font-mono text-xs">
              <div className="flex items-center gap-2">
                <span className="w-7 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                <input
                  type="range"
                  min={0.5}
                  max={scheduleSettings.dailyHours[1]}
                  step={0.5}
                  value={scheduleSettings.dailyHours[0]}
                  onChange={(e) =>
                    updateSetting('dailyHours', [Number(e.target.value), scheduleSettings.dailyHours[1]])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-8 text-right font-semibold">{scheduleSettings.dailyHours[0]}ч</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-7 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                <input
                  type="range"
                  min={scheduleSettings.dailyHours[0]}
                  max={12}
                  step={0.5}
                  value={scheduleSettings.dailyHours[1]}
                  onChange={(e) =>
                    updateSetting('dailyHours', [scheduleSettings.dailyHours[0], Number(e.target.value)])
                  }
                  className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
                />
                <span className="w-8 text-right font-semibold">{scheduleSettings.dailyHours[1]}ч</span>
              </div>
            </div>
          </SpecularCard>

          {/* Off Day Chance (0..50%) */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                  {isRu ? 'Шанс выходного' : 'Day Off Chance'}
                </span>
                <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white">
                  {scheduleSettings.offDayPercent}%
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                {isRu
                  ? `Вероятность пропуска дня (~${Math.round((scheduleSettings.offDayPercent / 100) * 7)} дн/нед)`
                  : `Probability of skipping a day (~${Math.round((scheduleSettings.offDayPercent / 100) * 7)} days/wk)`}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2 font-mono text-xs">
              <input
                type="range"
                min={0}
                max={50}
                step={5}
                value={scheduleSettings.offDayPercent}
                onChange={(e) => updateSetting('offDayPercent', Number(e.target.value))}
                className="flex-1 accent-zinc-950 dark:accent-white cursor-pointer"
              />
              <span className="w-10 text-right font-semibold">{scheduleSettings.offDayPercent}%</span>
            </div>
          </SpecularCard>

          {/* Logout on Long Break Switch */}
          <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white flex items-center gap-1.5">
                  <LogOut className="w-4 h-4 text-zinc-500" />
                  <span>{isRu ? 'Выход в меню' : 'Menu Logout'}</span>
                </span>

                <button
                  type="button"
                  onClick={() => updateSetting('longBreakLogout', !scheduleSettings.longBreakLogout)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                    scheduleSettings.longBreakLogout ? 'bg-zinc-950 dark:bg-white' : 'bg-black/15 dark:bg-white/15'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 shadow-sm transform transition-transform duration-200 ${
                      scheduleSettings.longBreakLogout ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[11px] text-zinc-500 font-mono mt-1 leading-relaxed">
                {isRu
                  ? 'Выход в меню персонажей на длинный перерыв и конец дня; в мир бот входит сам (Enter).'
                  : 'Logout to character menu on long break & day end; bot auto-enters world.'}
              </p>
            </div>

            <span className="text-[10px] text-zinc-400 font-mono italic">
              * {isRu ? 'нужна английская раскладка в игре' : 'English game layout required'}
            </span>
          </SpecularCard>
        </div>

        {/* =========================================================================
            SECTION: LIVE DAY SIMULATION TIMELINE (Tactile visual preview)
            ========================================================================= */}
        <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-black/10 dark:border-white/[0.08] bg-transparent flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              <h3 className="text-xs sm:text-sm font-mono font-semibold text-zinc-950 dark:text-white">
                {isRu ? 'Симуляция сгенерированного дня' : 'Simulated Day Preview'}
              </h3>
              <span className="text-[11px] text-zinc-500 font-mono">
                ({simulatedDay.sessionsTotal} {isRu ? 'сессий' : 'sessions'}, ~{simulatedDay.totalPlayedHrs} {isRu ? 'ч игры' : 'hrs'})
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setSimulationSeed((s) => s + 1);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-black/10 dark:border-white/10 text-xs font-mono text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer"
              title={isRu ? 'Сгенерировать другой случайный день' : 'Roll another day simulation'}
            >
              <Dice5 className="w-3.5 h-3.5" />
              <span>{isRu ? 'Другой вариант' : 'Shuffle'}</span>
            </button>
          </div>

          <p className="text-[11px] text-zinc-500 font-mono">
            {isRu
              ? 'Наглядный пример того, как алгоритм распределит сессии и паузы в течение дня при текущих настройках:'
              : 'Example of how the scheduling engine will distribute sessions and breaks today with current settings:'}
          </p>

          {/* Segmented Timeline */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="w-full flex h-8 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 p-0.5 gap-0.5 bg-black/5 dark:bg-white/5">
              {simulatedDay.timeline.map((item, idx) => (
                <div
                  key={idx}
                  style={{ flexGrow: Math.max(1, item.durationMin) }}
                  className={`relative flex items-center justify-center rounded-lg text-[10px] font-mono font-semibold transition-all group overflow-hidden ${
                    item.type === 'farm'
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                      : item.type === 'long_break'
                      ? 'bg-zinc-400 dark:bg-zinc-700 text-white'
                      : 'bg-black/15 dark:bg-white/15 text-zinc-600 dark:text-zinc-300'
                  }`}
                  title={`${item.label}: ${item.durationMin} мин (${simulatedDay.formatM(item.startMin)} – ${simulatedDay.formatM(item.startMin + item.durationMin)})`}
                >
                  <span className="truncate px-1 opacity-90 group-hover:opacity-100">
                    {item.durationMin}м
                  </span>
                </div>
              ))}
            </div>

            {/* Timeline Legend */}
            <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-500 gap-2 pt-1">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-zinc-950 dark:bg-white" />
                  <span>{isRu ? 'Фарм' : 'Farm'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-black/20 dark:bg-white/20" />
                  <span>{isRu ? 'Короткая пауза (на месте)' : 'Short break'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded bg-zinc-400 dark:bg-zinc-700" />
                  <span>{isRu ? 'Длинный перерыв (меню)' : 'Long break (menu)'}</span>
                </span>
              </div>

              <span>
                {isRu ? 'Примерное время:' : 'Est. time:'} <strong>{simulatedDay.startTime}</strong> – <strong>{simulatedDay.endTime}</strong>
              </span>
            </div>
          </div>
        </SpecularCard>
      </div>
    </div>
  );
};
