import {
  HeatmapMark,
  HeatmapSavings,
  HeatmapTimeline,
  SessionSummaryData,
} from '../types';

/**
 * Generates an SVG heatmap background image in the sleek dark Stealth HUD style of the app
 * (zinc-950 background, tactical radar grid, topographic elevation, heat halos — bot path & marks are rendered dynamically in SVG).
 */
export function generateMockHeatmapImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" style="background:#09090b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
  <defs>
    <!-- Soft Heat spot gradients -->
    <radialGradient id="heatPrimary" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.35"/>
      <stop offset="40%" stop-color="#f97316" stop-opacity="0.22"/>
      <stop offset="75%" stop-color="#a855f7" stop-opacity="0.1"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="heatSecondary" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#ea580c" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>

    <!-- Radar grid pattern -->
    <pattern id="radarGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#ffffff" stroke-width="0.75" stroke-opacity="0.035"/>
      <circle cx="60" cy="60" r="1.5" fill="#ffffff" fill-opacity="0.08"/>
    </pattern>
  </defs>

  <!-- Deep HUD Background -->
  <rect x="0" y="0" width="1200" height="800" fill="#09090b"/>
  <rect x="0" y="0" width="1200" height="800" fill="url(#radarGrid)"/>

  <!-- Tactical Radar Rings -->
  <circle cx="600" cy="400" r="140" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,8" stroke-opacity="0.05"/>
  <circle cx="600" cy="400" r="280" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,8" stroke-opacity="0.04"/>
  <circle cx="600" cy="400" r="420" fill="none" stroke="#ffffff" stroke-width="1" stroke-dasharray="4,8" stroke-opacity="0.03"/>
  <line x1="600" y1="40" x2="600" y2="760" stroke="#ffffff" stroke-width="1" stroke-dasharray="2,6" stroke-opacity="0.04"/>
  <line x1="60" y1="400" x2="1140" y2="400" stroke="#ffffff" stroke-width="1" stroke-dasharray="2,6" stroke-opacity="0.04"/>

  <!-- Topographic Elevation Contours -->
  <path d="M 120,160 Q 320,100 520,180 T 880,180 T 1080,380 T 920,680 T 520,740 T 160,620 Z" fill="#121317" opacity="0.85"/>
  <path d="M 220,240 Q 380,180 560,260 T 780,340 T 820,580 T 580,660 T 280,540 Z" fill="#181a20" opacity="0.9"/>
  <path d="M 340,320 Q 460,280 620,340 T 700,500 T 520,580 T 380,460 Z" fill="#20232a" opacity="0.95"/>

  <!-- Water / River subtle hazard -->
  <path d="M 80,720 Q 180,660 300,710 T 480,770 Z" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" opacity="0.7"/>
  <path d="M 940,90 Q 1020,80 1110,140 T 1150,280 Z" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" opacity="0.7"/>

  <!-- Obstacle / Rock zones -->
  <circle cx="230" cy="270" r="24" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="260" cy="295" r="20" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="820" cy="480" r="30" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="860" cy="520" r="24" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="410" cy="620" r="26" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>

  <!-- Subtle heatmap glow zones -->
  <circle cx="460" cy="280" r="95" fill="url(#heatPrimary)"/>
  <circle cx="710" cy="420" r="120" fill="url(#heatPrimary)"/>
  <circle cx="490" cy="560" r="105" fill="url(#heatSecondary)"/>
  <circle cx="340" cy="440" r="85" fill="url(#heatSecondary)"/>

  <!-- Faint planned route reference -->
  <polyline points="460,190 640,220 760,330 720,450 610,540 480,600 350,550 310,430 360,290 460,190"
            fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4,6" stroke-linecap="round" stroke-linejoin="round" opacity="0.14"/>

  <!-- HUD Corner Brackets & Scale Watermarks -->
  <path d="M 24,40 L 24,24 L 40,24" fill="none" stroke="#52525b" stroke-width="2"/>
  <path d="M 1176,40 L 1176,24 L 1160,24" fill="none" stroke="#52525b" stroke-width="2"/>
  <path d="M 24,760 L 24,776 L 40,776" fill="none" stroke="#52525b" stroke-width="2"/>
  <path d="M 1176,760 L 1176,776 L 1160,776" fill="none" stroke="#52525b" stroke-width="2"/>

  <!-- Top-left tactical telemetry badge -->
  <text x="36" y="52" fill="#71717a" font-size="12" font-weight="bold" letter-spacing="1.5">EZF RADAR · NAGRAND SECTOR</text>

  <!-- Bottom-left coordinates & scale -->
  <text x="36" y="756" fill="#52525b" font-size="11" letter-spacing="1">GRID 1200×800 · 50 YARDS · NORTH ▲</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Smooth mock bot timeline (35 min session starting 18:04:50).
 */
export function getMockHeatmapTimeline(): HeatmapTimeline {
  const pts: [number, number, number][] = [
    [0.383, 0.238, 0],
    [0.420, 0.246, 65],
    [0.468, 0.258, 140],
    [0.502, 0.270, 210],
    [0.529, 0.281, 262],
    [0.562, 0.305, 345],
    [0.598, 0.345, 430],
    [0.629, 0.406, 534],
    [0.635, 0.455, 620],
    [0.618, 0.515, 710],
    [0.592, 0.569, 798],
    [0.568, 0.615, 920],
    [0.538, 0.648, 1025],
    [0.504, 0.669, 1121],
    [0.468, 0.708, 1230],
    [0.432, 0.735, 1340],
    [0.400, 0.750, 1445],
    [0.352, 0.738, 1555],
    [0.312, 0.706, 1650],
    [0.278, 0.655, 1735],
    [0.260, 0.598, 1820],
    [0.263, 0.544, 1910],
    [0.255, 0.482, 1965],
    [0.275, 0.415, 2015],
    [0.304, 0.355, 2060],
    [0.342, 0.300, 2100],
  ];

  return {
    start: '18:04:50',
    end_s: 2100,
    pts,
  };
}

export function getMockHeatmapSavings(): HeatmapSavings {
  return {
    total_s: 144,
    detours: 2,
    mobs: 5,
  };
}

/**
 * Mock interactive marks aligned with the 1200x800 mock heatmap timeline.
 */
export function getMockHeatmapMarks(): HeatmapMark[] {
  return [
    {
      kind: 'start',
      x: 0.383,
      y: 0.238,
      t: 0,
      time: '18:04:50',
      text: 'Старт маршрута',
    },
    {
      kind: 'ok',
      x: 0.529,
      y: 0.281,
      t: 262,
      time: '18:09:12',
      text: 'Собрано',
    },
    {
      kind: 'ok',
      x: 0.629,
      y: 0.406,
      t: 534,
      time: '18:13:44',
      text: 'Собрано',
    },
    {
      kind: 'detour',
      x: 0.618,
      y: 0.515,
      t: 710,
      time: '18:16:40',
      gain_s: 88,
      text: 'Обход +5 с бега вместо драки ~93 с (3 моб.) — выигрыш ~88 с',
    },
    {
      kind: 'fight',
      x: 0.592,
      y: 0.569,
      t: 798,
      time: '18:18:08',
      text: 'Бой',
    },
    {
      kind: 'ok',
      x: 0.504,
      y: 0.669,
      t: 1121,
      time: '18:23:31',
      text: 'Собрано',
    },
    {
      kind: 'fight',
      x: 0.400,
      y: 0.750,
      t: 1445,
      time: '18:28:55',
      text: 'Бой',
    },
    {
      kind: 'detour',
      x: 0.263,
      y: 0.544,
      t: 1910,
      time: '18:36:40',
      gain_s: 56,
      text: 'Обход +4 с бега вместо драки ~60 с (2 моб.) — выигрыш ~56 с',
    },
    {
      kind: 'camp',
      x: 0.305,
      y: 0.505,
      r: 0.055,
      text: 'Лагерь: 4 моб. — бот обходит',
    },
    {
      kind: 'mob',
      x: 0.292,
      y: 0.492,
      text: 'Моб в лагере',
    },
    {
      kind: 'mob',
      x: 0.314,
      y: 0.486,
      text: 'Моб в лагере',
    },
    {
      kind: 'mob',
      x: 0.320,
      y: 0.518,
      text: 'Моб в лагере',
    },
    {
      kind: 'mob',
      x: 0.296,
      y: 0.522,
      text: 'Моб в лагере',
    },
    {
      kind: 'camp',
      x: 0.650,
      y: 0.535,
      r: 0.048,
      text: 'Лагерь: 3 моб. — бот обходит',
    },
    {
      kind: 'mob',
      x: 0.642,
      y: 0.524,
      text: 'Моб в лагере',
    },
    {
      kind: 'mob',
      x: 0.661,
      y: 0.531,
      text: 'Моб в лагере',
    },
    {
      kind: 'mob',
      x: 0.648,
      y: 0.551,
      text: 'Моб в лагере',
    },
    {
      kind: 'finish',
      x: 0.342,
      y: 0.300,
      t: 2100,
      time: '18:39:50',
      text: 'Финиш сессии',
    },
  ];
}

/**
 * Returns a complete mock session summary object with realistic telemetry & mock heatmap image.
 */
export function getMockSessionSummary(): SessionSummaryData {
  const now = Date.now();
  return {
    started_at_ms: now - 35 * 60 * 1000,
    stopped_at_ms: now,
    duration_s: 2100,
    kills: 84,
    kills_per_hour: 120,
    avg_kill_gap_s: 26.2,
    lost: 2,
    stop_reason: 'Ручная остановка (Тестовый пример)',
    khorium: 18,
    adamantite: 42,
    fel_iron: 76,
    gold: 3850,
    heatmap_status: 'ready',
    mock_heatmap: {
      ok: true,
      status: 'ready',
      image: generateMockHeatmapImage(),
      width: 1200,
      height: 800,
      route_name: 'Маршрут 3 (Награнд)',
      marks: getMockHeatmapMarks(),
      timeline: getMockHeatmapTimeline(),
      savings: getMockHeatmapSavings(),
    },
  };
}
