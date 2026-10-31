import { SessionHeatmapResponse, SessionSummaryData } from '../types';

/**
 * Generates an SVG heatmap image tailored in the sleek dark Stealth HUD style of the app
 * (zinc-950 background, tactical radar grid, neon green route, cyan bot path, heat halos, NO right panel).
 */
export function generateMockHeatmapImage(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" style="background:#09090b; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
  <defs>
    <!-- Soft Heat spot gradients -->
    <radialGradient id="heatPrimary" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fef08a" stop-opacity="0.9"/>
      <stop offset="35%" stop-color="#f97316" stop-opacity="0.65"/>
      <stop offset="70%" stop-color="#a855f7" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="heatSecondary" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#ea580c" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </radialGradient>

    <!-- Radar grid pattern -->
    <pattern id="radarGrid" width="60" height="60" patternUnits="userSpaceOnUse">
      <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#ffffff" stroke-width="0.75" stroke-opacity="0.035"/>
      <circle cx="60" cy="60" r="1.5" fill="#ffffff" fill-opacity="0.08"/>
    </pattern>

    <!-- Subtle line glow filter -->
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
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

  <!-- Topographic Elevation Contours (Stealth Obsidian / Dark Zinc shades) -->
  <path d="M 120,160 Q 320,100 520,180 T 880,180 T 1080,380 T 920,680 T 520,740 T 160,620 Z" fill="#121317" opacity="0.85"/>
  <path d="M 220,240 Q 380,180 560,260 T 780,340 T 820,580 T 580,660 T 280,540 Z" fill="#181a20" opacity="0.9"/>
  <path d="M 340,320 Q 460,280 620,340 T 700,500 T 520,580 T 380,460 Z" fill="#20232a" opacity="0.95"/>

  <!-- Water / River subtle hazard -->
  <path d="M 80,720 Q 180,660 300,710 T 480,770 Z" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" opacity="0.7"/>
  <path d="M 940,90 Q 1020,80 1110,140 T 1150,280 Z" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" opacity="0.7"/>

  <!-- Obstacle / Rock zones (dark hexagonal spots) -->
  <circle cx="230" cy="270" r="24" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="260" cy="295" r="20" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="820" cy="480" r="30" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="860" cy="520" r="24" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>
  <circle cx="410" cy="620" r="26" fill="#0a0a0c" stroke="#27272a" stroke-width="1"/>

  <!-- Heatmap glowing spots (Hotspots of time spent) -->
  <circle cx="460" cy="280" r="95" fill="url(#heatPrimary)"/>
  <circle cx="710" cy="420" r="120" fill="url(#heatPrimary)"/>
  <circle cx="490" cy="560" r="105" fill="url(#heatSecondary)"/>
  <circle cx="340" cy="440" r="85" fill="url(#heatSecondary)"/>

  <!-- Planned route line (Glowing White / Zinc route) -->
  <polyline points="460,190 640,220 760,330 720,450 610,540 480,600 350,550 310,430 360,290 460,190"
            fill="none" stroke="#e4e4e7" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>

  <!-- Actual bot traveled path (Neon Cyan path) -->
  <polyline points="460,190 490,205 635,225 670,260 755,325 730,420 710,455 670,490 605,535 540,570 480,600 420,590 355,555 320,500 315,435 335,360 365,295 410,240 460,190"
            fill="none" stroke="#06b6d4" stroke-width="2.5" stroke-dasharray="6,4" stroke-linecap="round" filter="url(#neonGlow)" opacity="0.95"/>

  <!-- Waypoints & Labels -->
  <!-- t.0 START -->
  <circle cx="460" cy="190" r="8" fill="#22c55e" stroke="#ffffff" stroke-width="2.5"/>
  <g transform="translate(425, 135)">
    <rect x="0" y="0" width="70" height="28" rx="6" fill="#052e16" stroke="#22c55e" stroke-width="1.5"/>
    <text x="35" y="19" fill="#4ade80" font-size="12" font-weight="bold" text-anchor="middle" letter-spacing="1">СТАРТ</text>
  </g>
  <text x="478" y="196" fill="#86efac" font-size="13" font-weight="bold">т.0</text>

  <!-- t.5 -->
  <circle cx="640" cy="220" r="5" fill="#f4f4f5"/>
  <text x="655" y="225" fill="#a1a1aa" font-size="12">т.5</text>

  <!-- t.10 -->
  <circle cx="760" cy="330" r="5" fill="#f4f4f5"/>
  <text x="775" y="335" fill="#a1a1aa" font-size="12">т.10</text>

  <!-- t.15 -->
  <circle cx="720" cy="450" r="5" fill="#f4f4f5"/>
  <text x="735" y="455" fill="#a1a1aa" font-size="12">т.15</text>

  <!-- t.20 -->
  <circle cx="610" cy="540" r="5" fill="#f4f4f5"/>
  <text x="625" y="545" fill="#a1a1aa" font-size="12">т.20</text>

  <!-- t.25 -->
  <circle cx="480" cy="600" r="5" fill="#f4f4f5"/>
  <text x="495" y="605" fill="#a1a1aa" font-size="12">т.25</text>

  <!-- t.30 -->
  <circle cx="350" cy="550" r="5" fill="#f4f4f5"/>
  <text x="365" y="555" fill="#a1a1aa" font-size="12">т.30</text>

  <!-- t.35 -->
  <circle cx="310" cy="430" r="5" fill="#f4f4f5"/>
  <text x="325" y="435" fill="#a1a1aa" font-size="12">т.35</text>

  <!-- Gather nodes (Emerald dots with white core) -->
  <circle cx="635" cy="225" r="7" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>
  <circle cx="755" cy="325" r="7" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>
  <circle cx="605" cy="535" r="7" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>
  <circle cx="355" cy="555" r="7" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>

  <!-- Combat markers (Amber diamonds) -->
  <polygon points="710,443 718,451 710,459 702,451" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
  <polygon points="480,592 488,600 480,608 472,600" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>

  <!-- Active harvest target (Yellow target ring) -->
  <circle cx="320" cy="440" r="13" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="4,2"/>

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
 * Returns a complete mock session summary object with realistic telemetry & mock heatmap image.
 */
export function getMockSessionSummary(): SessionSummaryData {
  const now = Date.now();
  return {
    started_at_ms: now - 42 * 60 * 1000,
    stopped_at_ms: now,
    duration_s: 2520, // 42 minutes
    kills: 84, // Nodes / kills
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
    },
  };
}
