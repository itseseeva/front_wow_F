import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  AlertTriangle,
  Sparkles,
  Sliders,
  Plus,
  Trash2,
  Check,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Shield,
  Copy,
  Moon,
  Swords,
  Coffee,
  Merge,
} from 'lucide-react';
import {
  ScheduleSettings,
  ScheduleStatus,
  DaySchedule,
  ScheduleStyle,
  ScheduleStyleId,
  DailySpread,
  WeekdayKey,
  SchedulePreview,
  SchedulePreviewSegment,
} from '../types';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { SpecularTimePicker } from './SpecularTimePicker';
import {
  DEFAULT_SCHEDULE_SETTINGS,
  DEFAULT_SCHEDULE_STYLES,
  WEEKDAY_KEYS,
  getGameDayMinutes,
  mockGetScheduleStyles,
  mockPreviewScheduleDay,
} from '../data/mockSchedule';
import { soundFx } from '../utils/audio';
import { getPywebviewApi } from '../utils/pywebviewBridge';

interface ScheduleViewProps {
  scheduleSettings: ScheduleSettings;
  onScheduleSettingsChange: (settings: ScheduleSettings) => void;
  scheduleStatus: ScheduleStatus | null;
  scheduleError: string | null;
  language: 'ru' | 'en';
  onToast?: (msg: string) => void;
}

const DAY_LABELS: Record<WeekdayKey, { shortRu: string; shortEn: string; fullRu: string; fullEn: string }> = {
  mon: { shortRu: 'Пн', shortEn: 'Mon', fullRu: 'Понедельник', fullEn: 'Monday' },
  tue: { shortRu: 'Вт', shortEn: 'Tue', fullRu: 'Вторник', fullEn: 'Tuesday' },
  wed: { shortRu: 'Ср', shortEn: 'Wed', fullRu: 'Среда', fullEn: 'Wednesday' },
  thu: { shortRu: 'Чт', shortEn: 'Thu', fullRu: 'Четверг', fullEn: 'Thursday' },
  fri: { shortRu: 'Пт', shortEn: 'Fri', fullRu: 'Пятница', fullEn: 'Friday' },
  sat: { shortRu: 'Сб', shortEn: 'Sat', fullRu: 'Суббота', fullEn: 'Saturday' },
  sun: { shortRu: 'Вс', shortEn: 'Sun', fullRu: 'Воскресенье', fullEn: 'Sunday' },
};

function getTodayWeekdayKey(): WeekdayKey {
  const day = new Date().getDay();
  const idx = day === 0 ? 6 : day - 1;
  return WEEKDAY_KEYS[idx] || 'mon';
}

function formatMinutesToHours(min: number): string {
  const h = (min / 60).toFixed(1);
  return h.endsWith('.0') ? `${Math.round(min / 60)}` : h;
}

function formatMsToTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '--:--';
  const d = new Date(ms);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function getWindowDurationMinutes(start: string, end: string): number {
  const sMin = getGameDayMinutes(start, false);
  const eMin = getGameDayMinutes(end, true);
  if (eMin > sMin) {
    return eMin - sMin;
  }
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const s = (sh || 0) * 60 + (sm || 0);
  let e = (eh || 0) * 60 + (em || 0);
  if (e <= s) e += 24 * 60;
  return Math.max(0, e - s);
}

function toClock(gameMin: number): string {
  const m = (((gameMin + 300) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({
  scheduleSettings,
  onScheduleSettingsChange,
  scheduleStatus,
  scheduleError,
  language,
}) => {
  const isRu = language === 'ru';
  const todayKey = useMemo(() => getTodayWeekdayKey(), []);

  const [selectedDayKey, setSelectedDayKey] = useState<WeekdayKey>(todayKey);
  const [isFineTuneOpen, setIsFineTuneOpen] = useState<boolean>(false);

  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [copyTargetDays, setCopyTargetDays] = useState<Record<WeekdayKey, boolean>>({
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false,
    sun: false,
  });
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [styles, setStyles] = useState<ScheduleStyle[]>(DEFAULT_SCHEDULE_STYLES);

  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [previewSeed, setPreviewSeed] = useState<number>(() => Math.floor(Math.random() * 10000));
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number | null>(null);

  const [mergingIdx, setMergingIdx] = useState<number | null>(null);
  const [justMergedOrigIndex, setJustMergedOrigIndex] = useState<number | null>(null);

  const currentDay = scheduleSettings.days[selectedDayKey] || scheduleSettings.days.mon;
  const isLongBreaksEnabled = currentDay.longBreaks !== false;

  const updateCurrentDay = (patch: Partial<DaySchedule>) => {
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: {
        ...scheduleSettings.days,
        [selectedDayKey]: {
          ...currentDay,
          ...patch,
        },
      },
    });
  };

  const toggleDayEnabled = (dayKey: WeekdayKey, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    soundFx.playClick();
    const day = scheduleSettings.days[dayKey];
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: {
        ...scheduleSettings.days,
        [dayKey]: {
          ...day,
          enabled: !day.enabled,
        },
      },
    });
  };

  useEffect(() => {
    let cancelled = false;
    const loadStyles = async () => {
      try {
        const api = await getPywebviewApi();
        if (api?.get_schedule_styles) {
          const res = await api.get_schedule_styles();
          if (!cancelled && res && res.ok && Array.isArray(res.styles) && res.styles.length > 0) {
            setStyles(res.styles);
            return;
          }
        }
        const mockRes = await mockGetScheduleStyles();
        if (!cancelled && mockRes.ok) {
          setStyles(mockRes.styles);
        }
      } catch (err) {
        console.warn('get_schedule_styles error:', err);
      }
    };
    loadStyles();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced preview_schedule_day call (~300ms)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const weekdayIdx = WEEKDAY_KEYS.indexOf(selectedDayKey);
        const configJson = JSON.stringify({ schedule: scheduleSettings });
        const api = await getPywebviewApi();
        if (api?.preview_schedule_day) {
          const res = await api.preview_schedule_day(configJson, weekdayIdx, previewSeed);
          if (!cancelled && res) {
            setPreview(res);
            return;
          }
        }
        const mockRes = await mockPreviewScheduleDay(configJson, weekdayIdx, previewSeed);
        if (!cancelled) {
          setPreview(mockRes);
        }
      } catch (err) {
        console.warn('preview_schedule_day error:', err);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scheduleSettings, selectedDayKey, previewSeed]);

  const windowDurationsMinutes = useMemo(() => {
    return currentDay.windows.map((w) => getWindowDurationMinutes(w.start, w.end));
  }, [currentDay.windows]);

  // Sort windows by game day start time (starting at 05:00)
  const sortedWindows = useMemo(() => {
    return currentDay.windows
      .map((win, originalIndex) => ({ ...win, originalIndex }))
      .sort((a, b) => getGameDayMinutes(a.start, false) - getGameDayMinutes(b.start, false));
  }, [currentDay.windows]);

  // Что между соседними окнами (по порядку игрового дня с 05:00): перерыв, стык вплотную или пересечение.
  // Конец окна = начало + длительность: так окно через полночь (22:00–02:00) считается правильно.
  // between[i] — то, что стоит после окна i и перед окном i + 1.
  const windowBetween = useMemo(() => {
    const spans = sortedWindows.map((w) => {
      const s = getGameDayMinutes(w.start, false);
      return { s, e: s + getWindowDurationMinutes(w.start, w.end) };
    });
    const between: { kind: 'gap' | 'touch' | 'overlap'; from: string; to: string }[] = [];
    for (let i = 0; i < spans.length - 1; i++) {
      const prev = spans[i];
      const next = spans[i + 1];
      if (next.s > prev.e) {
        between.push({ kind: 'gap', from: toClock(prev.e), to: toClock(next.s) });
      } else if (next.s === prev.e) {
        between.push({ kind: 'touch', from: toClock(prev.e), to: toClock(next.s) });
      } else {
        between.push({ kind: 'overlap', from: toClock(next.s), to: toClock(Math.min(prev.e, next.e)) });
      }
    }
    return between;
  }, [sortedWindows]);

  // Окна, задетые пересечением, — подсветить; бэкенд такие окна всё равно не примет.
  const overlappingIdx = useMemo(() => {
    const set = new Set<number>();
    windowBetween.forEach((b, i) => {
      if (b.kind === 'overlap') {
        set.add(i);
        set.add(i + 1);
      }
    });
    return set;
  }, [windowBetween]);

  const totalWindowsMinutes = useMemo(() => {
    return windowDurationsMinutes.reduce((sum, dur) => sum + dur, 0);
  }, [windowDurationsMinutes]);

  const M = useMemo(() => {
    return Math.round((totalWindowsMinutes / 60) * 10) / 10;
  }, [totalWindowsMinutes]);

  const maxDailyHours = useMemo(() => {
    return Math.max(0.5, Math.min(12, M));
  }, [M]);

  useEffect(() => {
    if (currentDay.dailyHours > maxDailyHours) {
      updateCurrentDay({ dailyHours: maxDailyHours });
    }
  }, [maxDailyHours, currentDay.dailyHours]);

  const handleAddWindow = () => {
    if (currentDay.windows.length >= 4) return;
    soundFx.playClick();
    const windows = [...currentDay.windows];
    const lastWindow = windows[windows.length - 1];

    let newStart = '14:00';
    let newEnd = '18:00';

    if (lastWindow) {
      const lastEndMin = getGameDayMinutes(lastWindow.end, true);
      if (lastEndMin <= 780) {
        newStart = '14:00';
        newEnd = '18:00';
      } else if (lastEndMin <= 1080) {
        newStart = '19:00';
        newEnd = '23:00';
      } else {
        newStart = '09:00';
        newEnd = '12:00';
      }
    }

    windows.push({ start: newStart, end: newEnd });
    updateCurrentDay({ windows });
  };

  const handleRemoveWindow = (index: number) => {
    if (currentDay.windows.length <= 1) return;
    soundFx.playClick();
    const windows = currentDay.windows.filter((_, idx) => idx !== index);
    updateCurrentDay({ windows });
  };

  const handleUpdateWindow = (index: number, field: 'start' | 'end', val: string) => {
    const windows = currentDay.windows.map((w, idx) => {
      if (idx !== index) return w;
      return { ...w, [field]: val };
    });
    updateCurrentDay({ windows });
  };

  const handleMergeWindows = (idx: number) => {
    soundFx.playClick();
    const w1 = sortedWindows[idx];
    const w2 = sortedWindows[idx + 1];
    if (!w1 || !w2) return;

    const s1 = getGameDayMinutes(w1.start, false);
    const e1 = s1 + getWindowDurationMinutes(w1.start, w1.end);
    const s2 = getGameDayMinutes(w2.start, false);
    const e2 = s2 + getWindowDurationMinutes(w2.start, w2.end);

    const mergedStart = toClock(Math.min(s1, s2));
    const mergedEnd = toClock(Math.max(e1, e2));

    const newWindows: { start: string; end: string }[] = [];
    currentDay.windows.forEach((w, origIdx) => {
      if (origIdx === w1.originalIndex) {
        newWindows.push({ start: mergedStart, end: mergedEnd });
      } else if (origIdx === w2.originalIndex) {
        // merged into w1
      } else {
        newWindows.push(w);
      }
    });

    setMergingIdx(idx);
    setTimeout(() => {
      updateCurrentDay({ windows: newWindows });
      setJustMergedOrigIndex(w1.originalIndex);
      setMergingIdx(null);
      setTimeout(() => {
        setJustMergedOrigIndex(null);
      }, 700);
    }, 180);
  };

  const handleSelectStyle = (styleId: ScheduleStyleId) => {
    soundFx.playClick();
    if (styleId === 'custom') {
      updateCurrentDay({ style: 'custom' });
      return;
    }
    const stylePreset = styles.find((s) => s.id === styleId);
    if (!stylePreset) return;

    updateCurrentDay({
      style: styleId,
      sessionMinutes: [...stylePreset.sessionMinutes],
      shortBreakMinutes: [...stylePreset.shortBreakMinutes],
      longBreakMinutes: [...stylePreset.longBreakMinutes],
      longBreakEvery: [...stylePreset.longBreakEvery],
    });
  };

  const handleFineTuneChange = <K extends keyof DaySchedule>(key: K, val: DaySchedule[K]) => {
    const patch: Partial<DaySchedule> = {
      [key]: val,
      style: 'custom',
    };

    if (key === 'shortBreakMinutes') {
      const sb = val as [number, number];
      if (sb[1] > currentDay.longBreakMinutes[0]) {
        patch.longBreakMinutes = [sb[1], Math.max(sb[1], currentDay.longBreakMinutes[1])];
      }
    } else if (key === 'longBreakMinutes') {
      const lb = val as [number, number];
      if (lb[0] < currentDay.shortBreakMinutes[1]) {
        patch.shortBreakMinutes = [Math.min(currentDay.shortBreakMinutes[0], lb[0]), lb[0]];
      }
    }

    updateCurrentDay(patch);
  };

  const handleOpenCopyModal = () => {
    soundFx.playClick();
    const initialTargets: Record<WeekdayKey, boolean> = {
      mon: false,
      tue: false,
      wed: false,
      thu: false,
      fri: false,
      sat: false,
      sun: false,
    };
    for (const k of WEEKDAY_KEYS) {
      if (k !== selectedDayKey) initialTargets[k] = true;
    }
    setCopyTargetDays(initialTargets);
    setIsCopyModalOpen(true);
  };

  const handleApplyCopy = () => {
    soundFx.playClick();
    const newDays = { ...scheduleSettings.days };
    let count = 0;
    for (const k of WEEKDAY_KEYS) {
      if (k !== selectedDayKey && copyTargetDays[k]) {
        newDays[k] = JSON.parse(JSON.stringify(currentDay));
        count++;
      }
    }
    onScheduleSettingsChange({
      ...scheduleSettings,
      days: newDays,
    });
    setIsCopyModalOpen(false);
    setCopyFeedback(
      isRu
        ? `Скопировано на ${count} ${count === 1 ? 'день' : count < 5 ? 'дня' : 'дней'}`
        : `Copied to ${count} days`
    );
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  const handleShuffleSeed = () => {
    soundFx.playClick();
    setPreviewSeed(Math.floor(Math.random() * 100000) + 1);
  };

  const timezoneStr = scheduleStatus?.timezone || 'UTC+03:00';
  const isHighLoadWarning = currentDay.dailyHours > 0.75 * M;

  const fineTuneSummary = isLongBreaksEnabled
    ? (isRu
        ? `Сессия ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}м · Пауза ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}м · Длинный ${currentDay.longBreakMinutes[0]}–${currentDay.longBreakMinutes[1]}м каждые ${currentDay.longBreakEvery[0]}–${currentDay.longBreakEvery[1]} с.`
        : `Session ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}m · Short ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}m · Long ${currentDay.longBreakMinutes[0]}–${currentDay.longBreakMinutes[1]}m every ${currentDay.longBreakEvery[0]}–${currentDay.longBreakEvery[1]} s.`)
    : (isRu
        ? `Сессия ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}м · Пауза ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}м · Без длинных перерывов`
        : `Session ${currentDay.sessionMinutes[0]}–${currentDay.sessionMinutes[1]}m · Short ${currentDay.shortBreakMinutes[0]}–${currentDay.shortBreakMinutes[1]}m · No long breaks`);

  return (
    <div className="relative w-full h-full p-4 sm:p-6 2xl:p-10 pt-16 sm:pt-20 pb-20 flex flex-col justify-start overflow-y-auto animate-assemble text-white font-sans select-none bg-black">
      <div className="w-full max-w-5xl 2xl:max-w-7xl mx-auto flex flex-col gap-5">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
              <h1 className="text-base sm:text-lg font-mono font-semibold text-white tracking-wide flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-white" strokeWidth={1.5} />
                <span>{isRu ? 'Расписание фарма' : 'Farm Schedule'}</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 font-mono">
              <span>{isRu ? 'График игры по дням недели' : 'Weekly farm schedule'}</span>
              <span>•</span>
              <span className="text-zinc-500">
                {isRu ? `время компьютера · ${timezoneStr}` : `local time · ${timezoneStr}`}
              </span>
            </div>
          </div>
        </div>

        {/* WEEK SELECTOR STRIP (7 Days) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
              {isRu ? 'Дни недели' : 'Days of the Week'}
            </span>

            <SpecularButton
              onClick={handleOpenCopyModal}
              className="px-2.5 py-1 rounded-lg border border-transparent hover:border-white/10 bg-transparent text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
            >
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>{isRu ? 'Скопировать день' : 'Copy day'}</span>
            </SpecularButton>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {WEEKDAY_KEYS.map((dayKey) => {
              const day = scheduleSettings.days[dayKey];
              const isSelected = selectedDayKey === dayKey;
              const isToday = todayKey === dayKey;
              const isEnabled = day?.enabled ?? true;

              return (
                <SpecularCard
                  key={dayKey}
                  onClick={() => {
                    soundFx.playClick();
                    setSelectedDayKey(dayKey);
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'border-white bg-white/5 ring-1 ring-white/40 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]'
                      : 'border-white/15 hover:border-white/30 bg-zinc-950/60 text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                      <span>{isRu ? DAY_LABELS[dayKey].shortRu : DAY_LABELS[dayKey].shortEn}</span>
                      {isToday && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-white text-black font-mono font-bold">
                          {isRu ? 'сегодня' : 'today'}
                        </span>
                      )}
                    </span>

                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] animate-pulse shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono">
                    {isEnabled ? (
                      <>
                        <span className="text-zinc-300">
                          ~{day?.dailyHours ?? 6} {isRu ? 'ч' : 'h'}
                        </span>
                        <span className="text-zinc-500">
                          {day?.windows?.length ?? 1} {isRu ? 'ок' : 'win'}
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-500 italic">
                        {isRu ? 'Выходной' : 'Day off'}
                      </span>
                    )}
                  </div>
                </SpecularCard>
              );
            })}
          </div>
        </div>

        {/* Copy Modal Dialog */}
        {isCopyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl border border-white/20 bg-black p-5 shadow-2xl flex flex-col gap-4 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="font-semibold text-sm text-white flex items-center gap-2">
                  <Copy className="w-4 h-4 text-zinc-400" />
                  <span>
                    {isRu
                      ? `Скопировать настройки: ${DAY_LABELS[selectedDayKey].fullRu}`
                      : `Copy settings: ${DAY_LABELS[selectedDayKey].fullEn}`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsCopyModalOpen(false)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-zinc-400 text-[11px]">
                {isRu
                  ? 'Выберите дни недели для копирования текущих окон и параметров:'
                  : 'Select days to duplicate current schedule settings:'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<WeekdayKey, boolean> = {
                      mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true,
                    };
                    all[selectedDayKey] = false;
                    setCopyTargetDays(all);
                  }}
                  className="px-2.5 py-1 rounded bg-black border border-white/20 hover:border-white text-zinc-300 hover:text-white cursor-pointer"
                >
                  {isRu ? 'Вся неделя' : 'All week'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetDays({
                      mon: selectedDayKey !== 'mon',
                      tue: selectedDayKey !== 'tue',
                      wed: selectedDayKey !== 'wed',
                      thu: selectedDayKey !== 'thu',
                      fri: selectedDayKey !== 'fri',
                      sat: false,
                      sun: false,
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-black border border-white/20 hover:border-white text-zinc-300 hover:text-white cursor-pointer"
                >
                  {isRu ? 'Будни (Пн–Пт)' : 'Weekdays'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCopyTargetDays({
                      mon: false,
                      tue: false,
                      wed: false,
                      thu: false,
                      fri: false,
                      sat: selectedDayKey !== 'sat',
                      sun: selectedDayKey !== 'sun',
                    });
                  }}
                  className="px-2.5 py-1 rounded bg-black border border-white/20 hover:border-white text-zinc-300 hover:text-white cursor-pointer"
                >
                  {isRu ? 'Выходные (Сб–Вс)' : 'Weekends'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {WEEKDAY_KEYS.map((k) => {
                  if (k === selectedDayKey) return null;
                  const isChecked = copyTargetDays[k];
                  return (
                    <label
                      key={k}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 cursor-pointer hover:border-white/30 text-zinc-300 hover:text-white"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setCopyTargetDays((prev) => ({
                            ...prev,
                            [k]: e.target.checked,
                          }))
                        }
                        className="accent-white"
                      />
                      <span>{isRu ? DAY_LABELS[k].fullRu : DAY_LABELS[k].fullEn}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <SpecularButton
                  onClick={() => setIsCopyModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white"
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </SpecularButton>
                <SpecularButton
                  onClick={handleApplyCopy}
                  className="px-4 py-1.5 rounded-lg bg-white text-black font-semibold shadow-sm hover:bg-zinc-200"
                >
                  {isRu ? 'Применить' : 'Apply'}
                </SpecularButton>
              </div>
            </div>
          </div>
        )}

        {/* PLAY STYLE PRESETS (Стиль поведения) - прямо под днями недели */}
        <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-mono font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-white" />
              <span>{isRu ? 'Стиль поведения' : 'Play Style'}</span>
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-black text-white border border-white/20 uppercase">
              {currentDay.style}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {styles.map((s) => {
              const isSelected = currentDay.style === s.id;
              const isRecommended = s.id === 'normal';

              return (
                <SpecularCard
                  key={s.id}
                  onClick={() => handleSelectStyle(s.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-white bg-black ring-1 ring-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.08)]'
                      : 'border-white/10 hover:border-white/25 bg-black text-zinc-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-mono text-xs font-bold text-white">
                      {s.title}
                    </span>
                    {isRecommended && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-black font-mono font-bold">
                        {isRu ? 'рекомендуем' : 'recommended'}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {s.description}
                  </p>
                </SpecularCard>
              );
            })}

            <SpecularCard
              onClick={() => handleSelectStyle('custom')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                currentDay.style === 'custom'
                  ? 'border-white bg-black ring-1 ring-white/30 text-white shadow-[0_0_12px_rgba(255,255,255,0.08)]'
                  : 'border-white/10 hover:border-white/25 bg-black text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between pb-1">
                <span className="font-mono text-xs font-bold text-white">
                  {isRu ? 'Свой' : 'Custom'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 font-mono">
                {isRu ? 'Ручная настройка таймингов' : 'Custom timing parameters'}
              </p>
            </SpecularCard>
          </div>
        </SpecularCard>

        {/* DAY CONFIGURATION */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-mono font-bold text-white">
                {isRu ? DAY_LABELS[selectedDayKey].fullRu : DAY_LABELS[selectedDayKey].fullEn}
              </h2>
              {todayKey === selectedDayKey && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-black font-mono font-bold">
                  {isRu ? 'Сегодня' : 'Today'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => toggleDayEnabled(selectedDayKey)}
              className={`flex items-center gap-2 px-3 py-1 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-colors ${
                currentDay.enabled
                  ? 'border-white bg-white/10 text-white'
                  : 'border-white/20 bg-transparent text-zinc-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  currentDay.enabled ? 'bg-white' : 'bg-zinc-600'
                }`}
              />
              <span>{currentDay.enabled ? (isRu ? 'День активен' : 'Day enabled') : (isRu ? 'Выходной день' : 'Day off')}</span>
            </button>
          </div>

          {!currentDay.enabled ? (
            <SpecularCard className="p-8 rounded-2xl border border-white/10 bg-black text-center flex flex-col items-center justify-center gap-3">
              <Moon className="w-8 h-8 text-zinc-500" strokeWidth={1.5} />
              <div className="flex flex-col gap-1">
                <span className="font-mono text-sm font-semibold text-white">
                  {isRu ? 'В этот день бот отдыхает' : 'The bot will rest on this day'}
                </span>
                <span className="font-mono text-xs text-zinc-400">
                  {isRu
                    ? 'День выключен в расписании. Сессии фарма не запускаются.'
                    : 'This day is disabled in schedule. No farming sessions will run.'}
                </span>
              </div>
              <SpecularButton
                onClick={() => toggleDayEnabled(selectedDayKey)}
                className="mt-2 px-4 py-1.5 rounded-lg border border-white/20 bg-white text-black font-mono text-xs font-semibold hover:bg-zinc-200"
              >
                {isRu ? 'Включить день' : 'Enable day'}
              </SpecularButton>
            </SpecularCard>
          ) : (
            <>
              {/* UNIFIED CARD: «Когда и сколько играть» */}
              <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-5">
                {/* 1. Окна часов */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-white" />
                      <h3 className="text-xs sm:text-sm font-mono font-semibold text-white">
                        {isRu ? 'Когда и сколько играть' : 'Playtime & Schedule'}
                      </h3>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        ({currentDay.windows.length} {isRu ? 'из 4' : 'of 4'})
                      </span>
                    </div>

                    {currentDay.windows.length < 4 && (
                      <SpecularButton
                        onClick={handleAddWindow}
                        className="px-3 py-1 rounded-xl bg-black text-white hover:bg-zinc-900 border border-white/20 hover:border-white font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 text-white" />
                        <span>{isRu ? 'Добавить ещё время' : 'Add more time'}</span>
                      </SpecularButton>
                    )}
                  </div>

                  {/* Windows List - sorted by game day starting at 05:00 */}
                  <div className="flex flex-col gap-2">
                    {sortedWindows.map((win, idx) => {
                      const durMin = getWindowDurationMinutes(win.start, win.end);
                      const durHours = (durMin / 60).toFixed(1).replace(/\.0$/, '');

                      const between = windowBetween[idx];
                      const overlaps = overlappingIdx.has(idx);
                      const isMergingNext = mergingIdx === idx;
                      const isBeingMerged = mergingIdx !== null && mergingIdx + 1 === idx;
                      const isJustMerged = justMergedOrigIndex === win.originalIndex;

                      return (
                        <React.Fragment key={win.originalIndex}>
                        <div
                          className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-black border transition-all duration-300 font-mono text-xs ${
                            isJustMerged
                              ? 'border-white ring-2 ring-white/50 shadow-[0_0_20px_rgba(255,255,255,0.3)] scale-[1.01]'
                              : overlaps
                              ? 'border-white border-dashed'
                              : 'border-white/10 hover:border-white/25'
                          } ${
                            isBeingMerged
                              ? 'opacity-0 scale-95 -translate-y-2 max-h-0 py-0 overflow-hidden pointer-events-none'
                              : 'opacity-100 scale-100 translate-y-0'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded bg-black text-white border border-white/20 font-bold text-[11px]">
                              #{idx + 1}
                            </span>
                            <div className="flex items-center gap-2 text-zinc-300">
                              <span className="text-zinc-400">{isRu ? 'с' : 'from'}</span>
                              <SpecularTimePicker
                                value={win.start}
                                onChange={(val) => handleUpdateWindow(win.originalIndex, 'start', val)}
                                ariaLabel={isRu ? `Окно #${idx + 1} начало` : `Window #${idx + 1} start`}
                              />
                              <span className="text-zinc-400">{isRu ? 'до' : 'to'}</span>
                              <SpecularTimePicker
                                value={win.end}
                                onChange={(val) => handleUpdateWindow(win.originalIndex, 'end', val)}
                                ariaLabel={isRu ? `Окно #${idx + 1} конец` : `Window #${idx + 1} end`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs text-white font-semibold">
                              {durHours} {isRu ? 'ч' : 'h'}
                            </span>
                            {currentDay.windows.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveWindow(win.originalIndex)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                title={isRu ? 'Удалить окно' : 'Remove window'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Разделитель между этим окном и следующим */}
                        {between?.kind === 'gap' && (
                          <div className="flex items-center gap-2 px-3 py-1 text-zinc-400 font-mono text-[11px]">
                            <Coffee className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {isRu
                                ? `Не играет ${between.from}–${between.to}`
                                : `Not playing ${between.from}–${between.to}`}
                            </span>
                          </div>
                        )}
                        {between?.kind === 'touch' && (
                          <div className="px-3 py-1 text-zinc-500 font-mono text-[11px]">
                            {isRu
                              ? `Окна стыкуются в ${between.from} — можно объединить в одно`
                              : `Windows meet at ${between.from} — can be merged into one`}
                          </div>
                        )}
                        {between?.kind === 'overlap' && (
                          <div
                            className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-2.5 rounded-xl border border-white/40 border-dashed text-white font-mono text-xs transition-all duration-300 ${
                              isMergingNext
                                ? 'opacity-0 max-h-0 py-0 scale-95 overflow-hidden'
                                : 'opacity-100 max-h-32 scale-100'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-white" />
                              <span>
                                {isRu
                                  ? `Окна пересекаются ${between.from}–${between.to} — сдвиньте время или объедините в одно. Пока так, расписание не сохранится.`
                                  : `Windows overlap ${between.from}–${between.to} — shift the time or merge them. The schedule won't save until fixed.`}
                              </span>
                            </div>
                            <SpecularButton
                              type="button"
                              onClick={() => handleMergeWindows(idx)}
                              className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/40 hover:border-white text-white font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                              title={isRu ? 'Объединить эти окна' : 'Merge these windows'}
                            >
                              <Merge className="w-3.5 h-3.5 text-white" />
                              <span className="text-white font-bold">{isRu ? 'Объединить' : 'Merge'}</span>
                            </SpecularButton>
                          </div>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-1 text-[11px] text-zinc-400 font-mono">
                    <p className="text-zinc-300">
                      {isRu
                        ? 'Например, утро и вечер — между окнами бот не играет.'
                        : 'For example, morning and evening — the bot does not play between windows.'}
                    </p>
                    <p className="text-zinc-500">
                      {isRu
                        ? 'Начало и конец окон каждый день немного плавают.'
                        : 'Window start and end times drift slightly each day.'}
                    </p>
                  </div>
                </div>

                {/* 2. Норма */}
                <div className="flex flex-col gap-3 pt-4 border-t border-white/10 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-semibold text-xs sm:text-sm">
                        {isRu
                          ? `В эти часы играет около ${currentDay.dailyHours} ч из ${M} ч`
                          : `Plays about ${currentDay.dailyHours} hrs out of ${M} hrs`}
                      </span>
                      {preview?.daily_hours && (
                        <span className="text-zinc-400 text-xs">
                          ({isRu ? `от ${preview.daily_hours[0]} до ${preview.daily_hours[1]} ч` : `from ${preview.daily_hours[0]} to ${preview.daily_hours[1]} hrs`})
                        </span>
                      )}
                    </div>

                    <span className="text-white font-bold px-2 py-0.5 rounded bg-black border border-white/20 text-xs">
                      {currentDay.dailyHours} {isRu ? 'ч' : 'h'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-zinc-400 text-[11px] shrink-0">0.5 ч</span>

                    <div className="relative flex-1 flex items-center h-6">
                      <div className="absolute inset-x-0 h-1.5 rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-white rounded-full pointer-events-none"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                maxDailyHours > 0.5
                                  ? ((currentDay.dailyHours - 0.5) / (maxDailyHours - 0.5)) * 100
                                  : 100
                              )
                            )}%`,
                          }}
                        />
                      </div>

                      <input
                        type="range"
                        min={0.5}
                        max={maxDailyHours}
                        step={0.5}
                        value={Math.min(currentDay.dailyHours, maxDailyHours)}
                        onChange={(e) =>
                          updateCurrentDay({
                            dailyHours: Number(e.target.value),
                          })
                        }
                        className="relative w-full accent-white cursor-pointer z-10 h-6 opacity-0"
                      />

                      <div
                        className="absolute w-4 h-4 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] border border-zinc-300 pointer-events-none -ml-2 transition-all duration-75"
                        style={{
                          left: `${Math.max(
                            0,
                            Math.min(
                              100,
                              maxDailyHours > 0.5
                                ? ((currentDay.dailyHours - 0.5) / (maxDailyHours - 0.5)) * 100
                                : 100
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    <span className="text-zinc-400 text-[11px] shrink-0">{maxDailyHours} ч</span>
                  </div>

                  {isHighLoadWarning && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black border border-white/20 text-white font-mono text-xs">
                      <AlertTriangle className="w-4 h-4 text-white shrink-0" />
                      <span>
                        {isRu
                          ? 'Почти без отдыха — так человек не играет, рискованно.'
                          : 'Almost no rest — human players do not play like this, risky.'}
                      </span>
                    </div>
                  )}
                </div>
              </SpecularCard>

              {/* CARD: «Перерывы и выходные» (Блок из 3 галочек) */}
              <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-3 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-white" />
                  <span className="font-semibold text-xs sm:text-sm text-white">
                    {isRu ? 'Перерывы и выходные' : 'Breaks & Days Off'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  {/* Галочка 1: «Длинные перерывы» */}
                  <div
                    onClick={() => {
                      soundFx.playClick();
                      updateCurrentDay({ longBreaks: !isLongBreaksEnabled });
                    }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-black border border-white/10 hover:border-white/25 cursor-pointer transition-all select-none"
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                        isLongBreaksEnabled
                          ? 'bg-white border-white text-black'
                          : 'border-zinc-600 bg-transparent text-transparent'
                      }`}
                    >
                      {isLongBreaksEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-xs">
                        {isRu ? 'Длинные перерывы' : 'Long Breaks'}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {isRu
                          ? 'Раз в несколько сессий — отдых 30–90 минут'
                          : 'Every few sessions — 30–90 minute rest'}
                      </span>
                    </div>
                  </div>

                  {/* Галочка 2: «Выходить в меню на длинном перерыве» */}
                  <div
                    onClick={() => {
                      if (!isLongBreaksEnabled) return;
                      soundFx.playClick();
                      updateCurrentDay({ longBreakLogout: !currentDay.longBreakLogout });
                    }}
                    className={`flex items-start gap-3 p-3 rounded-xl bg-black border border-white/10 transition-all select-none ${
                      !isLongBreaksEnabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-white/25 cursor-pointer'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                        isLongBreaksEnabled && currentDay.longBreakLogout
                          ? 'bg-white border-white text-black'
                          : 'border-zinc-600 bg-transparent text-transparent'
                      }`}
                    >
                      {isLongBreaksEnabled && currentDay.longBreakLogout && (
                        <Check className="w-3 h-3 stroke-[3]" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-xs">
                        {isRu ? 'Выходить в меню на длинном перерыве' : 'Logout to menu on long break'}
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        {isRu
                          ? 'Персонаж выходит в меню на время отдыха'
                          : 'Character logs out to select screen during rest'}
                      </span>
                    </div>
                  </div>

                  {/* Галочка 3: «Случайные выходные» (общая на неделю, 10 или 0) */}
                  <div
                    onClick={() => {
                      soundFx.playClick();
                      const nextVal = scheduleSettings.offDayPercent === 10 ? 0 : 10;
                      onScheduleSettingsChange({
                        ...scheduleSettings,
                        offDayPercent: nextVal,
                      });
                    }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-black border border-white/10 hover:border-white/25 cursor-pointer transition-all select-none"
                  >
                    <div
                      className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border transition-all ${
                        scheduleSettings.offDayPercent === 10
                          ? 'bg-white border-white text-black'
                          : 'border-zinc-600 bg-transparent text-transparent'
                      }`}
                    >
                      {scheduleSettings.offDayPercent === 10 && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {isRu ? 'Случайные выходные' : 'Random Days Off'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-400 font-mono">
                          {isRu ? 'на всю неделю' : 'all week'}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {isRu
                          ? 'Примерно раз в 10 дней бот не играет весь день'
                          : 'About once every 10 days the bot does not play all day'}
                      </span>
                    </div>
                  </div>
                </div>
              </SpecularCard>

              {/* CARD: «Тонкая настройка сессий и перерывов» */}
              <SpecularCard className="p-4 sm:p-5 rounded-2xl border border-white/10 bg-black flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setIsFineTuneOpen(!isFineTuneOpen)}
                  className="w-full flex items-center justify-between text-left cursor-pointer outline-none"
                >
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-white" />
                    <div>
                      <span className="text-xs sm:text-sm font-mono font-semibold text-white">
                        {isRu ? 'Тонкая настройка сессий и перерывов' : 'Fine-Tuning Sessions & Breaks'}
                      </span>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {fineTuneSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-zinc-400">
                    <span className="text-[10px] font-mono">
                      {isFineTuneOpen ? (isRu ? 'Скрыть' : 'Collapse') : (isRu ? 'Настроить' : 'Expand')}
                    </span>
                    {isFineTuneOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isFineTuneOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-white/10 animate-fadeIn font-mono text-xs">
                    {/* 1. Разброс нормы по дням */}
                    <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-black border border-white/10">
                      <div className="flex flex-col gap-1 max-w-xl">
                        <span className="font-bold text-white text-xs">
                          {isRu ? 'Разброс нормы по дням' : 'Daily norm variance'}
                        </span>
                        <p className="text-[11px] text-zinc-400 leading-normal">
                          {isRu
                            ? 'Каждый день бот играет чуть больше или меньше на выбранный процент, имитируя живого человека.'
                            : 'Every day play time varies slightly within the selected percentage so that behavior looks natural.'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                        {[
                          { id: 'low' as DailySpread, label: '±10%' },
                          { id: 'mid' as DailySpread, label: '±25%' },
                        ].map((sp) => {
                          const currentSpread = currentDay.dailySpread === 'low' ? 'low' : 'mid';
                          const isSelected = currentSpread === sp.id;
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                updateCurrentDay({ dailySpread: sp.id });
                              }}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-white bg-white text-black shadow-sm'
                                  : 'border-white/15 bg-black hover:border-white/30 text-zinc-400 hover:text-white'
                              }`}
                            >
                              {sp.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Сессия фарма */}
                    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-2">
                          <Swords className="w-4 h-4 text-white" />
                          <span>{isRu ? 'Сессия фарма' : 'Farm Session'}</span>
                        </span>
                        <span className="text-white font-bold">
                          {currentDay.sessionMinutes[0]} – {currentDay.sessionMinutes[1]} {isRu ? 'мин' : 'min'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={10}
                            max={currentDay.sessionMinutes[1]}
                            step={5}
                            value={currentDay.sessionMinutes[0]}
                            onChange={(e) =>
                              handleFineTuneChange('sessionMinutes', [Number(e.target.value), currentDay.sessionMinutes[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-10 text-right text-white font-mono">{currentDay.sessionMinutes[0]}м</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.sessionMinutes[0]}
                            max={180}
                            step={5}
                            value={currentDay.sessionMinutes[1]}
                            onChange={(e) =>
                              handleFineTuneChange('sessionMinutes', [currentDay.sessionMinutes[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-10 text-right text-white font-mono">{currentDay.sessionMinutes[1]}м</span>
                        </div>
                      </div>
                    </div>

                    {/* Короткая пауза */}
                    <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-black border border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white flex items-center gap-2">
                          <Coffee className="w-4 h-4 text-white" />
                          <span>{isRu ? 'Короткая пауза' : 'Short Pause'}</span>
                        </span>
                        <span className="text-white font-bold">
                          {currentDay.shortBreakMinutes[0]} – {currentDay.shortBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                          <input
                            type="range"
                            min={1}
                            max={currentDay.shortBreakMinutes[1]}
                            step={1}
                            value={currentDay.shortBreakMinutes[0]}
                            onChange={(e) =>
                              handleFineTuneChange('shortBreakMinutes', [Number(e.target.value), currentDay.shortBreakMinutes[1]])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-10 text-right text-white font-mono">{currentDay.shortBreakMinutes[0]}м</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                          <input
                            type="range"
                            min={currentDay.shortBreakMinutes[0]}
                            max={Math.min(60, currentDay.longBreakMinutes[0])}
                            step={1}
                            value={currentDay.shortBreakMinutes[1]}
                            onChange={(e) =>
                              handleFineTuneChange('shortBreakMinutes', [currentDay.shortBreakMinutes[0], Number(e.target.value)])
                            }
                            className="flex-1 accent-white cursor-pointer"
                          />
                          <span className="w-10 text-right text-white font-mono">{currentDay.shortBreakMinutes[1]}м</span>
                        </div>
                      </div>
                    </div>

                    {/* Длинный перерыв: показывается только если галочка «Длинные перерывы» включена */}
                    {isLongBreaksEnabled && (
                      <>
                        {/* Длительность длинного перерыва */}
                        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-black border border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2">
                              <Moon className="w-4 h-4 text-white" />
                              <span>{isRu ? 'Длинный перерыв' : 'Long Break Duration'}</span>
                            </span>
                            <span className="font-bold text-white">
                              {currentDay.longBreakMinutes[0]} – {currentDay.longBreakMinutes[1]} {isRu ? 'мин' : 'min'}
                            </span>
                          </div>

                          <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                            <div className="flex items-center gap-2">
                              <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                              <input
                                type="range"
                                min={10}
                                max={currentDay.longBreakMinutes[1]}
                                step={5}
                                value={currentDay.longBreakMinutes[0]}
                                onChange={(e) =>
                                  handleFineTuneChange('longBreakMinutes', [Number(e.target.value), currentDay.longBreakMinutes[1]])
                                }
                                className="flex-1 accent-white cursor-pointer"
                              />
                              <span className="w-10 text-right text-white font-mono">{currentDay.longBreakMinutes[0]}м</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                              <input
                                type="range"
                                min={currentDay.longBreakMinutes[0]}
                                max={240}
                                step={5}
                                value={currentDay.longBreakMinutes[1]}
                                onChange={(e) =>
                                  handleFineTuneChange('longBreakMinutes', [currentDay.longBreakMinutes[0], Number(e.target.value)])
                                }
                                className="flex-1 accent-white cursor-pointer"
                              />
                              <span className="w-10 text-right text-white font-mono">{currentDay.longBreakMinutes[1]}м</span>
                            </div>
                          </div>
                        </div>

                        {/* Частота длинного перерыва (longBreakEvery 1..10) */}
                        <div className="flex flex-col gap-3 p-3.5 rounded-xl bg-black border border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white flex items-center gap-2">
                              <Sliders className="w-4 h-4 text-white" />
                              <span>{isRu ? 'Частота длинного перерыва' : 'Long Break Frequency'}</span>
                            </span>
                            <span className="font-bold text-white">
                              {currentDay.longBreakEvery[0]} – {currentDay.longBreakEvery[1]} {isRu ? 'сессий' : 'sessions'}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400">
                            {isRu ? 'После каждых N сессий наступает большой перерыв' : 'Extended rest after every N sessions'}
                          </p>

                          <div className="flex flex-col gap-2 text-[11px] text-zinc-300">
                            <div className="flex items-center gap-2">
                              <span className="w-8 text-zinc-400">{isRu ? 'От:' : 'Min:'}</span>
                              <input
                                type="range"
                                min={1}
                                max={currentDay.longBreakEvery[1]}
                                step={1}
                                value={currentDay.longBreakEvery[0]}
                                onChange={(e) =>
                                  handleFineTuneChange('longBreakEvery', [Number(e.target.value), currentDay.longBreakEvery[1]])
                                }
                                className="flex-1 accent-white cursor-pointer"
                              />
                              <span className="w-10 text-right text-white font-mono">{currentDay.longBreakEvery[0]} с.</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="w-8 text-zinc-400">{isRu ? 'До:' : 'Max:'}</span>
                              <input
                                type="range"
                                min={currentDay.longBreakEvery[0]}
                                max={10}
                                step={1}
                                value={currentDay.longBreakEvery[1]}
                                onChange={(e) =>
                                  handleFineTuneChange('longBreakEvery', [currentDay.longBreakEvery[0], Number(e.target.value)])
                                }
                                className="flex-1 accent-white cursor-pointer"
                              />
                              <span className="w-10 text-right text-white font-mono">{currentDay.longBreakEvery[1]} с.</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </SpecularCard>
            </>
          )}
        </div>
      </div>

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-2 max-w-sm w-full px-4">
        {copyFeedback && (
          <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-black border border-white/30 text-white shadow-2xl backdrop-blur-xl font-mono text-xs animate-fadeIn">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span className="font-semibold text-white">{copyFeedback}</span>
          </div>
        )}
      </div>
    </div>
  );
};
