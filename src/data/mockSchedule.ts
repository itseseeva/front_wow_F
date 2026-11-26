import {
  ScheduleSettings,
  ScheduleStatus,
  SchedulePhase,
  DaySchedule,
  ScheduleStyle,
  ScheduleStyleId,
  DailySpread,
  SchedulePreview,
  SchedulePreviewSegment,
  WeekdayKey,
} from '../types';

export const WEEKDAY_KEYS: WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DEFAULT_SCHEDULE_STYLES: ScheduleStyle[] = [
  {
    id: 'careful',
    title: 'Осторожный',
    description: 'Короткие сессии, частые паузы, реалистичный человеческий ритм',
    sessionMinutes: [25, 60],
    shortBreakMinutes: [5, 15],
    longBreakMinutes: [40, 90],
    longBreakEvery: [2, 3],
  },
  {
    id: 'normal',
    title: 'Обычный',
    description: 'Оптимальный баланс фарма и отдыха (рекомендуется)',
    sessionMinutes: [45, 90],
    shortBreakMinutes: [4, 10],
    longBreakMinutes: [30, 60],
    longBreakEvery: [2, 4],
  },
  {
    id: 'heavy',
    title: 'Интенсивный',
    description: 'Длинные забеги, редкие паузы для максимального профита',
    sessionMinutes: [75, 150],
    shortBreakMinutes: [2, 6],
    longBreakMinutes: [20, 45],
    longBreakEvery: [3, 5],
  },
];

function parseDailyHoursAndSpread(rawDailyHours: any, rawDailySpread: any): { dailyHours: number; dailySpread: DailySpread } {
  let spread: DailySpread = ['low', 'mid', 'high'].includes(rawDailySpread) ? rawDailySpread : 'mid';
  let hours = 4;
  if (Array.isArray(rawDailyHours) && rawDailyHours.length === 2) {
    hours = (Number(rawDailyHours[0]) + Number(rawDailyHours[1])) / 2;
    spread = 'mid';
  } else if (typeof rawDailyHours === 'number') {
    hours = rawDailyHours;
  }
  hours = Math.max(0.5, Math.min(12, Math.round(hours * 2) / 2));
  return { dailyHours: hours, dailySpread: spread };
}

export function createDefaultDaySchedule(styleId: ScheduleStyleId = 'normal'): DaySchedule {
  const preset = DEFAULT_SCHEDULE_STYLES.find((s) => s.id === styleId) || DEFAULT_SCHEDULE_STYLES[1];
  return {
    enabled: true,
    windows: [{ start: '10:00', end: '02:00' }],
    style: styleId,
    dailyHours: 4,
    dailySpread: 'mid',
    sessionMinutes: [...preset.sessionMinutes],
    shortBreakMinutes: [...preset.shortBreakMinutes],
    longBreaks: true,
    longBreakMinutes: [...preset.longBreakMinutes],
    longBreakEvery: [...preset.longBreakEvery],
    longBreakLogout: true,
  };
}

export function createDefaultDaysRecord(): Record<WeekdayKey, DaySchedule> {
  const days = {} as Record<WeekdayKey, DaySchedule>;
  for (const k of WEEKDAY_KEYS) {
    days[k] = createDefaultDaySchedule('normal');
  }
  return days;
}

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  enabled: true,
  offDayPercent: 0,
  days: createDefaultDaysRecord(),
};

/**
 * Normalizes any loaded schedule object (handles missing schedule, or legacy flat format)
 */
export function normalizeScheduleSettings(raw: any): ScheduleSettings {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_SCHEDULE_SETTINGS;
  }

  const enabled = raw.enabled ?? true;
  const offDayPercent = typeof raw.offDayPercent === 'number' ? Math.max(0, Math.min(50, raw.offDayPercent)) : 0;

  // Check if legacy flat schedule (no days object)
  if (!raw.days || typeof raw.days !== 'object') {
    const legacyWindow = {
      start: typeof raw.windowStart === 'string' && raw.windowStart.includes(':') ? raw.windowStart : '10:00',
      end: typeof raw.windowEnd === 'string' && raw.windowEnd.includes(':') ? raw.windowEnd : '02:00',
    };
    const { dailyHours, dailySpread } = parseDailyHoursAndSpread(raw.dailyHours, raw.dailySpread);
    const legacyDay: DaySchedule = {
      enabled: true,
      windows: [legacyWindow],
      style: 'normal',
      dailyHours,
      dailySpread,
      sessionMinutes: Array.isArray(raw.sessionMinutes) && raw.sessionMinutes.length === 2 ? raw.sessionMinutes : [45, 90],
      shortBreakMinutes: Array.isArray(raw.shortBreakMinutes) && raw.shortBreakMinutes.length === 2 ? raw.shortBreakMinutes : [4, 10],
      longBreaks: raw.longBreaks ?? true,
      longBreakMinutes: Array.isArray(raw.longBreakMinutes) && raw.longBreakMinutes.length === 2 ? raw.longBreakMinutes : [30, 60],
      longBreakEvery: Array.isArray(raw.longBreakEvery) && raw.longBreakEvery.length === 2 ? raw.longBreakEvery : [2, 4],
      longBreakLogout: raw.longBreakLogout ?? true,
    };

    const days = {} as Record<WeekdayKey, DaySchedule>;
    for (const k of WEEKDAY_KEYS) {
      days[k] = JSON.parse(JSON.stringify(legacyDay));
    }

    return {
      enabled,
      offDayPercent,
      days,
    };
  }

  // Modern format with days
  const days = {} as Record<WeekdayKey, DaySchedule>;
  for (const k of WEEKDAY_KEYS) {
    const rawDay = raw.days[k];
    if (rawDay && typeof rawDay === 'object') {
      const windows = Array.isArray(rawDay.windows) && rawDay.windows.length > 0
        ? rawDay.windows.slice(0, 4).map((w: any) => ({
            start: typeof w.start === 'string' && w.start.includes(':') ? w.start : '10:00',
            end: typeof w.end === 'string' && w.end.includes(':') ? w.end : '02:00',
          }))
        : [{ start: '10:00', end: '02:00' }];

      const { dailyHours, dailySpread } = parseDailyHoursAndSpread(rawDay.dailyHours, rawDay.dailySpread);

      days[k] = {
        enabled: rawDay.enabled ?? true,
        windows,
        style: ['careful', 'normal', 'heavy', 'custom'].includes(rawDay.style) ? rawDay.style : 'normal',
        dailyHours,
        dailySpread,
        sessionMinutes: Array.isArray(rawDay.sessionMinutes) && rawDay.sessionMinutes.length === 2 ? rawDay.sessionMinutes : [45, 90],
        shortBreakMinutes: Array.isArray(rawDay.shortBreakMinutes) && rawDay.shortBreakMinutes.length === 2 ? rawDay.shortBreakMinutes : [4, 10],
        longBreaks: rawDay.longBreaks ?? true,
        longBreakMinutes: Array.isArray(rawDay.longBreakMinutes) && rawDay.longBreakMinutes.length === 2 ? rawDay.longBreakMinutes : [30, 60],
        longBreakEvery: Array.isArray(rawDay.longBreakEvery) && rawDay.longBreakEvery.length === 2 ? rawDay.longBreakEvery : [2, 4],
        longBreakLogout: rawDay.longBreakLogout ?? true,
      };
    } else {
      days[k] = createDefaultDaySchedule('normal');
    }
  }

  return {
    enabled,
    offDayPercent,
    days,
  };
}

/**
 * Convert "HH:MM" to minutes from midnight (0..1439).
 * Игровой день — от первого окна дня (без фиксированной границы 05:00).
 */
export function parseClockMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = ((parseInt(hStr, 10) || 0) % 24 + 24) % 24;
  const m = ((parseInt(mStr, 10) || 0) % 60 + 60) % 60;
  return h * 60 + m;
}

/**
 * Duration of a window "start–end" in minutes:
 * ((end - start) mod 1440) || 1440.
 * If end < start, it crosses midnight into the next day.
 * If end === start, it equals a full 24h (1440 min).
 */
export function getWindowDurationMinutes(start: string, end: string): number {
  const s = parseClockMinutes(start);
  const e = parseClockMinutes(end);
  const diff = (((e - s) % 1440) + 1440) % 1440;
  return diff === 0 ? 1440 : diff;
}

/**
 * Minutes from midnight (0..1439) for a clock string "HH:MM".
 * Игровой день — от первого окна дня.
 */
export function getGameDayMinutes(timeStr: string, _isEnd = false): number {
  return parseClockMinutes(timeStr);
}

function formatClockFromMinutes(totalMin: number): string {
  const m = ((totalMin % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const DAY_NAMES_RU: Record<WeekdayKey, string> = {
  mon: 'Пн',
  tue: 'Вт',
  wed: 'Ср',
  thu: 'Чт',
  fri: 'Пт',
  sat: 'Сб',
  sun: 'Вс',
};

/**
 * Validates whole week schedule settings according to contract
 */
export function validateScheduleSettings(settings: ScheduleSettings, isRu = true): string | null {
  if (!settings.enabled) return null;

  if (settings.offDayPercent < 0 || settings.offDayPercent > 50) {
    return isRu
      ? 'Расписание: шанс случайного выходного должен быть от 0 до 50%'
      : 'Schedule: random day off chance must be 0–50%';
  }

  for (const dayKey of WEEKDAY_KEYS) {
    const day = settings.days[dayKey];
    if (!day || !day.enabled) continue;

    const dayName = isRu ? DAY_NAMES_RU[dayKey] : dayKey.toUpperCase();

    if (!day.windows || day.windows.length === 0) {
      return isRu
        ? `Расписание: ${dayName}: добавьте хотя бы одно окно часов`
        : `Schedule: ${dayName}: add at least one time window`;
    }

    if (day.windows.length > 4) {
      return isRu
        ? `Расписание: ${dayName}: максимум 4 окна часов`
        : `Schedule: ${dayName}: maximum 4 time windows allowed`;
    }

    // Validate window minimum duration (>= 10 min); overnight and overlapping windows are valid
    for (const w of day.windows) {
      const durMin = getWindowDurationMinutes(w.start, w.end);
      if (durMin < 10) {
        return isRu
          ? `Расписание: ${dayName}: окно ${w.start}–${w.end} короче 10 мин`
          : `Schedule: ${dayName}: window ${w.start}–${w.end} shorter than 10 min`;
      }
    }

    // Validate sliders
    if (typeof day.dailyHours !== 'number' || day.dailyHours < 0.5 || day.dailyHours > 12) {
      return isRu
        ? `Расписание: ${dayName}: норма в день должна быть 0.5–12 ч`
        : `Schedule: ${dayName}: daily hours must be 0.5–12 hrs`;
    }

    const [sMin, sMax] = day.sessionMinutes;
    if (sMin < 10 || sMax > 180 || sMin > sMax) {
      return isRu
        ? `Расписание: ${dayName}: длина сессии должна быть 10–180 мин (от ≤ до)`
        : `Schedule: ${dayName}: session duration must be 10–180 min (min ≤ max)`;
    }

    const [sbMin, sbMax] = day.shortBreakMinutes;
    if (sbMin < 1 || sbMax > 60 || sbMin > sbMax) {
      return isRu
        ? `Расписание: ${dayName}: короткий перерыв должен быть 1–60 мин (от ≤ до)`
        : `Schedule: ${dayName}: short break must be 1–60 min (min ≤ max)`;
    }

    if (day.longBreaks !== false) {
      const [lbMin, lbMax] = day.longBreakMinutes;
      if (lbMin < 10 || lbMax > 240 || lbMin > lbMax) {
        return isRu
          ? `Расписание: ${dayName}: длинный перерыв должен быть 10–240 мин (от ≤ до)`
          : `Schedule: ${dayName}: long break must be 10–240 min (min ≤ max)`;
      }

      // Constraint: shortBreakMinutes[1] <= longBreakMinutes[0]
      if (sbMax > lbMin) {
        return isRu
          ? `Расписание: ${dayName}: короткий перерыв (до ${sbMax}м) не может быть длиннее длинного перерыва (от ${lbMin}м)`
          : `Schedule: ${dayName}: short break (up to ${sbMax}m) cannot be longer than long break (from ${lbMin}m)`;
      }

      const [lbeMin, lbeMax] = day.longBreakEvery;
      if (lbeMin < 1 || lbeMax > 10 || lbeMin > lbeMax) {
        return isRu
          ? `Расписание: ${dayName}: частота длинного перерыва должна быть 1–10 сессий (от ≤ до)`
          : `Schedule: ${dayName}: long break frequency must be 1–10 sessions (min ≤ max)`;
      }
    }
  }

  return null;
}

/**
 * Mock implementation of get_schedule_styles
 */
export async function mockGetScheduleStyles(): Promise<{ ok: boolean; styles: ScheduleStyle[] }> {
  return {
    ok: true,
    styles: DEFAULT_SCHEDULE_STYLES,
  };
}

/**
 * Pseudo-random generator with seed
 */
function seededRandom(seed: number) {
  let s = Math.sin(seed++) * 10000;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Mock implementation of preview_schedule_day
 */
export async function mockPreviewScheduleDay(
  configJson: string,
  weekday: number,
  seed: number
): Promise<SchedulePreview> {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const tz = 'UTC+03:00';

  let configObj: any = null;
  try {
    configObj = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
  } catch (e) {
    return {
      ok: false,
      error: 'Ошибка разбора конфигурации',
      date: dateStr,
      off: false,
      daily_hours: null,
      windows: [],
      segments: [],
      sessions: 0,
      farm_s: 0,
      start_ms: null,
      end_ms: null,
      timezone: tz,
    };
  }

  const scheduleSettings = normalizeScheduleSettings(configObj?.schedule);
  const dayKey = WEEKDAY_KEYS[weekday] || 'mon';
  const day = scheduleSettings.days[dayKey];

  if (!scheduleSettings.enabled || !day || !day.enabled) {
    return {
      ok: true,
      date: dateStr,
      off: true,
      daily_hours: null,
      windows: [],
      segments: [],
      sessions: 0,
      farm_s: 0,
      start_ms: null,
      end_ms: null,
      timezone: tz,
    };
  }

  const valError = validateScheduleSettings(scheduleSettings, true);
  if (valError) {
    return {
      ok: false,
      error: valError,
      date: dateStr,
      off: false,
      daily_hours: null,
      windows: [],
      segments: [],
      sessions: 0,
      farm_s: 0,
      start_ms: null,
      end_ms: null,
      timezone: tz,
    };
  }

  const rng = seededRandom(seed || 42);

  // Base timestamp for 00:00 today (игровой день — от первого окна дня)
  const base00 = new Date(d);
  base00.setHours(0, 0, 0, 0);
  const baseMs = base00.getTime();

  // Sort raw windows by start (minutes from midnight) and merge overlaps
  const notes: string[] = [];
  const rawSpans = day.windows
    .map((w) => {
      const s = parseClockMinutes(w.start);
      const e = s + getWindowDurationMinutes(w.start, w.end);
      return { s, e, start: w.start, end: w.end };
    })
    .sort((a, b) => a.s - b.s);

  const mergedSpans: { s: number; e: number }[] = [];
  for (const span of rawSpans) {
    const prev = mergedSpans[mergedSpans.length - 1];
    if (prev && span.s <= prev.e) {
      const prevStr = `${formatClockFromMinutes(prev.s)}–${formatClockFromMinutes(prev.e)}`;
      prev.e = Math.max(prev.e, span.e);
      const mergedStr = `${formatClockFromMinutes(prev.s)}–${formatClockFromMinutes(prev.e)}`;
      if (span.s < prev.e) {
        notes.push(`склеил ${prevStr} и ${span.start}–${span.end} в ${mergedStr}`);
      }
    } else {
      mergedSpans.push({ s: span.s, e: span.e });
    }
  }

  // Trim tail extending past next enabled weekday's first window start
  const nextWeekdayIdx = (weekday + 1) % 7;
  const nextDayKey = WEEKDAY_KEYS[nextWeekdayIdx];
  const nextDay = scheduleSettings.days[nextDayKey];
  if (nextDay && nextDay.enabled && nextDay.windows.length > 0 && mergedSpans.length > 0) {
    const nextFirstStart = Math.min(...nextDay.windows.map((w) => parseClockMinutes(w.start)));
    const nextLimit = 1440 + nextFirstStart;
    for (const sp of mergedSpans) {
      if (sp.e > nextLimit) {
        const origStr = `${formatClockFromMinutes(sp.s)}–${formatClockFromMinutes(sp.e)}`;
        const cutStr = formatClockFromMinutes(nextLimit);
        sp.e = Math.max(sp.s + 10, nextLimit);
        notes.push(
          `окно ${origStr} обрезано до ${cutStr}: там начинается окно дня «${DAY_NAMES_RU[nextDayKey]}»`
        );
      }
    }
  }

  // Convert merged windows to start_ms and end_ms
  const windowsMs = mergedSpans.map((sp) => ({
    start_ms: baseMs + sp.s * 60 * 1000,
    end_ms: baseMs + sp.e * 60 * 1000,
  }));

  // Calculate spread bounds based on dailySpread
  let spreadRatio = 0.25;
  if (day.dailySpread === 'low') spreadRatio = 0.12;
  else if (day.dailySpread === 'high') spreadRatio = 0.4;

  const dhMin = Math.max(0.5, Math.round(day.dailyHours * (1 - spreadRatio) * 10) / 10);
  const dhMax = Math.min(12, Math.round(day.dailyHours * (1 + spreadRatio) * 10) / 10);
  const spreadRange: [number, number] = [dhMin, Math.max(dhMin, dhMax)];

  const targetDailyHours = spreadRange[0] + rng() * (spreadRange[1] - spreadRange[0]);
  const targetDailyMin = Math.round(targetDailyHours * 60);

  const segments: SchedulePreviewSegment[] = [];
  let remainingFarmMin = targetDailyMin;
  let sessionCounter = 0;
  let longBreakEveryCounter = Math.round(day.longBreakEvery[0] + rng() * (day.longBreakEvery[1] - day.longBreakEvery[0]));

  for (let wIdx = 0; wIdx < windowsMs.length; wIdx++) {
    const win = windowsMs[wIdx];
    let curMs = win.start_ms;

    // If there's a gap between windows
    if (wIdx > 0) {
      const prevWin = windowsMs[wIdx - 1];
      if (win.start_ms > prevWin.end_ms) {
        segments.push({
          kind: 'wait_window',
          start_ms: prevWin.end_ms,
          end_ms: win.start_ms,
          minutes: Math.round((win.start_ms - prevWin.end_ms) / 60000),
        });
      }
    }

    while (curMs < win.end_ms && remainingFarmMin > 5) {
      sessionCounter++;
      const sMin = Math.round(
        day.sessionMinutes[0] + rng() * (day.sessionMinutes[1] - day.sessionMinutes[0])
      );
      const farmDurMin = Math.min(
        remainingFarmMin,
        sMin,
        Math.max(5, Math.floor((win.end_ms - curMs) / 60000))
      );

      const farmEndMs = curMs + farmDurMin * 60000;
      segments.push({
        kind: 'farm',
        start_ms: curMs,
        end_ms: farmEndMs,
        minutes: farmDurMin,
      });

      remainingFarmMin -= farmDurMin;
      curMs = farmEndMs;

      if (remainingFarmMin <= 0 || curMs >= win.end_ms) break;

      // Break segment
      const isLongBreak = day.longBreaks !== false && sessionCounter % longBreakEveryCounter === 0;
      let breakMin = 0;
      let kind: 'short_break' | 'long_break' = 'short_break';

      if (isLongBreak) {
        kind = 'long_break';
        breakMin = Math.round(
          day.longBreakMinutes[0] + rng() * (day.longBreakMinutes[1] - day.longBreakMinutes[0])
        );
        longBreakEveryCounter = Math.round(day.longBreakEvery[0] + rng() * (day.longBreakEvery[1] - day.longBreakEvery[0]));
      } else {
        kind = 'short_break';
        breakMin = Math.round(
          day.shortBreakMinutes[0] + rng() * (day.shortBreakMinutes[1] - day.shortBreakMinutes[0])
        );
      }

      breakMin = Math.min(breakMin, Math.max(1, Math.floor((win.end_ms - curMs) / 60000)));
      if (breakMin > 0) {
        segments.push({
          kind,
          start_ms: curMs,
          end_ms: curMs + breakMin * 60000,
          minutes: breakMin,
        });
        curMs += breakMin * 60000;
      }
    }
  }

  const farmSegments = segments.filter((s) => s.kind === 'farm');
  const farmMinutes = farmSegments.reduce((acc, s) => acc + s.minutes, 0);

  return {
    ok: true,
    date: dateStr,
    off: false,
    daily_hours: spreadRange,
    windows: windowsMs,
    segments,
    sessions: farmSegments.length,
    farm_s: farmMinutes * 60,
    start_ms: segments[0]?.start_ms || null,
    end_ms: segments[segments.length - 1]?.end_ms || null,
    timezone: tz,
    ...(notes.length > 0 ? { notes } : {}),
  };
}

/**
 * Returns mock ScheduleStatus for HUD / main screen
 */
export function getMockScheduleStatus(isBotRunning: boolean, settings: ScheduleSettings): ScheduleStatus {
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = Date.now();
  const tz = 'UTC+03:00';

  const jsDay = d.getDay();
  const weekdayIdx = jsDay === 0 ? 6 : jsDay - 1;
  const currentKey = WEEKDAY_KEYS[weekdayIdx];
  const daySchedule = settings.days[currentKey] || createDefaultDaySchedule();

  const base00 = new Date(d);
  base00.setHours(0, 0, 0, 0);
  const baseMs = base00.getTime();

  const windowsMs = [...(daySchedule.windows || [])]
    .sort((a, b) => parseClockMinutes(a.start) - parseClockMinutes(b.start))
    .map((w) => {
      const sMin = parseClockMinutes(w.start);
      const eMin = sMin + getWindowDurationMinutes(w.start, w.end);
      return {
        start_ms: baseMs + sMin * 60 * 1000,
        end_ms: baseMs + eMin * 60 * 1000,
      };
    });

  const start_ms = windowsMs[0]?.start_ms || baseMs + 10 * 60 * 60 * 1000;
  const end_ms = windowsMs[windowsMs.length - 1]?.end_ms || baseMs + 26 * 60 * 60 * 1000;

  if (!settings.enabled || !daySchedule.enabled) {
    return {
      ok: true,
      enabled: false,
      active: false,
      phase: 'off_day',
      phase_until_ms: null,
      in_world: true,
      note: 'Сегодня выходной день по расписанию',
      timezone: tz,
      today: {
        date: todayStr,
        off: true,
        budget_s: 0,
        played_s: 0,
        sessions: 0,
        start_ms,
        end_ms,
        windows: windowsMs,
      },
    };
  }

  if (!isBotRunning) {
    return {
      ok: true,
      enabled: true,
      active: false,
      phase: 'idle',
      phase_until_ms: null,
      in_world: true,
      note: 'Бот остановлен. Ожидание запуска',
      timezone: tz,
      today: {
        date: todayStr,
        off: false,
        budget_s: 14400,
        played_s: 4800,
        sessions: 2,
        start_ms,
        end_ms,
        windows: windowsMs,
      },
    };
  }

  return {
    ok: true,
    enabled: true,
    active: true,
    phase: 'farm',
    phase_until_ms: now + 45 * 60 * 1000,
    in_world: true,
    note: 'Сессия 2 из 3 перед длинным перерывом',
    timezone: tz,
    today: {
      date: todayStr,
      off: false,
      budget_s: 14400,
      played_s: 4800,
      sessions: 2,
      start_ms,
      end_ms,
      windows: windowsMs,
    },
  };
}
