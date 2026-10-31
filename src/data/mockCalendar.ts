import {
  CalendarMonthResponse,
  DayResponse,
  SessionHeatmapResponse,
  CalendarRoute,
  DaySession,
  PassInfo,
  SessionSummaryData,
} from '../types';
import { generateMockHeatmapImage } from '../utils/mockHeatmap';

// Palette of 6 route colors requested by contract
export const ROUTE_PALETTE = [
  '#1D9E75', // 0: Emerald
  '#7F77DD', // 1: Violet
  '#D85A30', // 2: Amber/Rust
  '#378ADD', // 3: Blue
  '#D4537E', // 4: Rose
  '#BA7517', // 5: Golden
];

export const MOCK_CALENDAR_ROUTES: CalendarRoute[] = [
  { route_id: 'route_1', name: 'Маршрут 1', color_index: 0 },
  { route_id: 'route_2', name: 'Маршрут 2', color_index: 1 },
  { route_id: 'route_3', name: 'Маршрут 3', color_index: 2 },
];

/**
 * Returns mock month data with 9 days of sessions, 3 routes, and one problem day.
 */
export function getMockCalendarMonth(year: number, month: number): CalendarMonthResponse {
  // Use November 2026 or requested month
  const pad = (n: number) => String(n).padStart(2, '0');
  const ym = `${year}-${pad(month)}`;

  const daysData = [
    { day: 2, sessions: 2, dur: 3800, nodes: 74, routes: [MOCK_CALENDAR_ROUTES[0]], problem: false },
    { day: 4, sessions: 3, dur: 5400, nodes: 112, routes: [MOCK_CALENDAR_ROUTES[0], MOCK_CALENDAR_ROUTES[1]], problem: false },
    { day: 7, sessions: 2, dur: 6720, nodes: 146, routes: [MOCK_CALENDAR_ROUTES[2], MOCK_CALENDAR_ROUTES[0]], problem: false }, // Highlight day with 2 sessions & 7 passes
    { day: 9, sessions: 1, dur: 1800, nodes: 38, routes: [MOCK_CALENDAR_ROUTES[1]], problem: false },
    { day: 12, sessions: 2, dur: 4100, nodes: 88, routes: [MOCK_CALENDAR_ROUTES[2]], problem: false },
    { day: 15, sessions: 4, dur: 7800, nodes: 164, routes: [MOCK_CALENDAR_ROUTES[0], MOCK_CALENDAR_ROUTES[2]], problem: true }, // Problem day (death/stuck)
    { day: 18, sessions: 2, dur: 3600, nodes: 76, routes: [MOCK_CALENDAR_ROUTES[1]], problem: false },
    { day: 22, sessions: 3, dur: 5900, nodes: 128, routes: [MOCK_CALENDAR_ROUTES[0], MOCK_CALENDAR_ROUTES[1], MOCK_CALENDAR_ROUTES[2]], problem: false },
    { day: 26, sessions: 1, dur: 2100, nodes: 44, routes: [MOCK_CALENDAR_ROUTES[2]], problem: false },
  ];

  const days = daysData.map((d) => ({
    date: `${ym}-${pad(d.day)}`,
    sessions: d.sessions,
    duration_s: d.dur,
    nodes: d.nodes,
    routes: d.routes,
    problem: d.problem,
  }));

  const totalDur = days.reduce((acc, d) => acc + d.duration_s, 0);
  const totalSessions = days.reduce((acc, d) => acc + d.sessions, 0);
  const totalNodes = days.reduce((acc, d) => acc + d.nodes, 0);

  return {
    ok: true,
    year,
    month,
    days,
    totals: {
      duration_s: totalDur,
      sessions: totalSessions,
      nodes: totalNodes,
    },
    routes: MOCK_CALENDAR_ROUTES,
  };
}

/**
 * Returns mock day data. If the date matches day 7 or any session day, provides realistic sessions and passes.
 */
export function getMockDay(dateStr: string): DayResponse {
  const parts = dateStr.split('-');
  const dayNum = parseInt(parts[2] || '7', 10);

  // If day has no sessions according to mock calendar
  const activeDays = [2, 4, 7, 9, 12, 15, 18, 22, 26];
  if (!activeDays.includes(dayNum)) {
    return {
      ok: true,
      date: dateStr,
      total: null,
      sessions: [],
    };
  }

  // Build 7 detailed passes for session 1
  const passesSession1: PassInfo[] = [
    { index: 1, direction: 'forward', duration_s: 340, nodes: 4, stucks: 0 },
    { index: 2, direction: 'back', duration_s: 320, nodes: 5, stucks: 0 },
    { index: 3, direction: 'forward', duration_s: 360, nodes: 3, stucks: 1 },
    { index: 4, direction: 'back', duration_s: 330, nodes: 6, stucks: 0 },
    { index: 5, direction: 'forward', duration_s: 350, nodes: 4, stucks: 0 },
    { index: 6, direction: 'back', duration_s: 315, nodes: 5, stucks: 0 },
    { index: 7, direction: 'forward', duration_s: 345, nodes: 4, stucks: 0 },
  ];

  // Base timestamp on the date
  const baseTime = new Date(`${dateStr}T10:42:00`).getTime() || Date.now() - 3600000;

  const session1Summary: SessionSummaryData = {
    started_at_ms: baseTime,
    stopped_at_ms: baseTime + 2360 * 1000,
    duration_s: 2360,
    kills: 31,
    kills_per_hour: 47,
    avg_kill_gap_s: 76.1,
    lost: 1,
    stop_reason: 'Ручная остановка',
    khorium: 8,
    adamantite: 23,
    fel_iron: 41,
    gold: 1450,
  };

  const session1: DaySession = {
    session_id: `sess_${dateStr}_1`,
    started_at_ms: baseTime,
    stopped_at_ms: baseTime + 2360 * 1000,
    route_id: 'route_3',
    route_name: 'Маршрут 3',
    color_index: 2, // Amber/Rust
    summary: session1Summary,
    passes: 7,
    passes_info: passesSession1,
    heatmap: true,
  };

  const baseTime2 = new Date(`${dateStr}T14:15:00`).getTime() || baseTime + 4 * 3600000;
  const passesSession2: PassInfo[] = [
    { index: 1, direction: 'loop', duration_s: 410, nodes: 7, stucks: 0 },
    { index: 2, direction: 'loop', duration_s: 390, nodes: 8, stucks: 0 },
    { index: 3, direction: 'loop', duration_s: 405, nodes: 6, stucks: 0 },
    { index: 4, direction: 'loop', duration_s: 420, nodes: 7, stucks: 0 },
  ];

  const session2Summary: SessionSummaryData = {
    started_at_ms: baseTime2,
    stopped_at_ms: baseTime2 + 1625 * 1000,
    duration_s: 1625,
    kills: 28,
    kills_per_hour: 62,
    avg_kill_gap_s: 58.0,
    lost: 0,
    stop_reason: 'Завершён цикл маршрута',
    fel_iron: 56,
    gold: 980,
    // khorium/adamantite omitted (null) to test "empty resources not shown"
  };

  const session2: DaySession = {
    session_id: `sess_${dateStr}_2`,
    started_at_ms: baseTime2,
    stopped_at_ms: baseTime2 + 1625 * 1000,
    route_id: 'route_1',
    route_name: 'Маршрут 1',
    color_index: 0, // Emerald
    summary: session2Summary,
    passes: 4,
    passes_info: passesSession2,
    heatmap: true,
  };

  const dayTotal: SessionSummaryData = {
    started_at_ms: baseTime,
    stopped_at_ms: baseTime2 + 1625 * 1000,
    duration_s: 3985,
    kills: 59,
    kills_per_hour: 53,
    avg_kill_gap_s: 67.5,
    lost: 1,
    stop_reason: '2 сессии завершены',
    khorium: 8,
    adamantite: 23,
    fel_iron: 97,
    gold: 2430,
  };

  return {
    ok: true,
    date: dateStr,
    total: dayTotal,
    sessions: [session1, session2],
  };
}

/**
 * Returns mock heatmap by session id and pass index.
 */
export function getMockSessionHeatmapById(
  sessionId: string,
  passIndex: number | null
): SessionHeatmapResponse {
  const isPass = passIndex != null;
  const passLabel = isPass ? ` (Проход ${passIndex})` : '';
  const routeName = sessionId.includes('_2') ? `Маршрут 1${passLabel}` : `Маршрут 3${passLabel}`;

  return {
    ok: true,
    status: 'ready',
    image: generateMockHeatmapImage(),
    width: 1200,
    height: 800,
    route_name: routeName,
  };
}
