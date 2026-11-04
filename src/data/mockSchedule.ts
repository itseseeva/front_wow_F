import { ScheduleSettings, ScheduleStatus, SchedulePhase } from '../types';

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  enabled: true,
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
};

// Convert "HH:MM" to minutes from 05:00 game day start (0..1440)
export function getGameDayMinutes(timeStr: string, isEnd = false): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;
  const totalMin = h * 60 + m;

  if (isEnd && h === 5 && m === 0) {
    return 1440;
  }

  if (totalMin >= 300) {
    // 05:00..23:59
    return totalMin - 300;
  } else {
    // 00:00..04:59 (after midnight)
    return totalMin + 1140;
  }
}

export function validateScheduleSettings(settings: ScheduleSettings, isRu = true): string | null {
  if (!settings.enabled) return null;

  const [sMin, sMax] = settings.sessionMinutes;
  if (sMin < 10 || sMax > 240 || sMin > sMax) {
    return isRu
      ? 'Расписание: длина сессии должна быть в диапазоне 10–240 мин (от ≤ до)'
      : 'Schedule: session length must be within 10–240 min (min ≤ max)';
  }

  const [sbMin, sbMax] = settings.shortBreakMinutes;
  if (sbMin < 1 || sbMax > 60 || sbMin > sbMax) {
    return isRu
      ? 'Расписание: короткий перерыв должен быть в диапазоне 1–60 мин (от ≤ до)'
      : 'Schedule: short break must be within 1–60 min (min ≤ max)';
  }

  const [lbMin, lbMax] = settings.longBreakMinutes;
  if (lbMin < 10 || lbMax > 240 || lbMin > lbMax) {
    return isRu
      ? 'Расписание: длинный перерыв должен быть в диапазоне 10–240 мин (от ≤ до)'
      : 'Schedule: long break must be within 10–240 min (min ≤ max)';
  }

  const [lbeMin, lbeMax] = settings.longBreakEvery;
  if (lbeMin < 1 || lbeMax > 10 || lbeMin > lbeMax) {
    return isRu
      ? 'Расписание: частота длинного перерыва должна быть 1–10 сессий (от ≤ до)'
      : 'Schedule: long break frequency must be 1–10 sessions (min ≤ max)';
  }

  const [dhMin, dhMax] = settings.dailyHours;
  if (dhMin < 0.5 || dhMax > 12 || dhMin > dhMax) {
    return isRu
      ? 'Расписание: норма в день должна быть 0.5–12 ч (от ≤ до)'
      : 'Schedule: daily hours must be 0.5–12 hrs (min ≤ max)';
  }

  if (settings.offDayPercent < 0 || settings.offDayPercent > 50) {
    return isRu
      ? 'Расписание: шанс выходного должен быть от 0 до 50%'
      : 'Schedule: day off chance must be from 0 to 50%';
  }

  if (settings.startJitterMinutes < 0 || settings.startJitterMinutes > 120) {
    return isRu
      ? 'Расписание: случайный сдвиг окна должен быть 0–120 мин'
      : 'Schedule: window jitter must be 0–120 min';
  }

  const startMin = getGameDayMinutes(settings.windowStart, false);
  const endMin = getGameDayMinutes(settings.windowEnd, true);

  if (endMin <= startMin) {
    return isRu
      ? 'Расписание: конец окна часов должен быть позже начала (в рамках игрового дня 05:00–05:00)'
      : 'Schedule: window end must be later than window start (within game day 05:00–05:00)';
  }

  const durationMin = endMin - startMin;
  const minRequired = 10 + 2 * settings.startJitterMinutes;
  if (durationMin < minRequired) {
    return isRu
      ? `Расписание: окно часов слишком узкое (минимум ${minRequired} мин с учётом сдвига ${settings.startJitterMinutes} мин)`
      : `Schedule: window too short (minimum ${minRequired} min required with jitter of ${settings.startJitterMinutes} min)`;
  }

  return null;
}

// In-memory mock schedule state for browser testing
let mockSchedulePhase: SchedulePhase = 'idle';
let mockPhaseUntilMs: number | null = null;
let mockPlayedSeconds = 4800; // 1h 20m
const mockBudgetSeconds = 14400; // 4h

export function getMockScheduleStatus(isBotRunning: boolean, settings: ScheduleSettings): ScheduleStatus {
  const now = Date.now();
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Calculate start_ms and end_ms for today based on settings
  const baseStart = new Date(d);
  const [sh, sm] = settings.windowStart.split(':').map(Number);
  baseStart.setHours(sh || 10, sm || 0, 0, 0);

  const baseEnd = new Date(d);
  const [eh, em] = settings.windowEnd.split(':').map(Number);
  if ((eh || 0) < 5) {
    baseEnd.setDate(baseEnd.getDate() + 1);
  }
  baseEnd.setHours(eh || 2, em || 0, 0, 0);

  const start_ms = baseStart.getTime() + settings.startJitterMinutes * 60 * 1000;
  const end_ms = baseEnd.getTime() - settings.startJitterMinutes * 60 * 1000;

  if (!settings.enabled) {
    return {
      ok: true,
      enabled: false,
      active: false,
      phase: 'idle',
      phase_until_ms: null,
      in_world: true,
      note: 'Расписание отключено в настройках',
      today: {
        date: todayStr,
        off: false,
        budget_s: mockBudgetSeconds,
        played_s: mockPlayedSeconds,
        sessions: 2,
        start_ms,
        end_ms,
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
      today: {
        date: todayStr,
        off: false,
        budget_s: mockBudgetSeconds,
        played_s: mockPlayedSeconds,
        sessions: 2,
        start_ms,
        end_ms,
      },
    };
  }

  // If bot is running and schedule is active
  if (!mockPhaseUntilMs || mockPhaseUntilMs < now) {
    mockSchedulePhase = 'farm';
    mockPhaseUntilMs = now + 45 * 60 * 1000; // 45 min farm session
  }

  return {
    ok: true,
    enabled: true,
    active: true,
    phase: mockSchedulePhase,
    phase_until_ms: mockPhaseUntilMs,
    in_world: mockSchedulePhase !== 'long_break' && mockSchedulePhase !== 'day_done',
    note: 'Сессия 2 из 3 перед длинным перерывом',
    today: {
      date: todayStr,
      off: false,
      budget_s: mockBudgetSeconds,
      played_s: mockPlayedSeconds,
      sessions: 2,
      start_ms,
      end_ms,
    },
  };
}
