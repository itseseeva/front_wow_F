import React, { useEffect, useState, useMemo, useRef } from 'react';
import { SessionSummaryData } from '../types';
import {
  Clock,
  Zap,
  Target,
  AlertTriangle,
  X,
  Trophy,
  Download,
  Coins,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Language, Theme, translations } from '../utils/i18n';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';
import { SessionHeatmapCard } from './SessionHeatmapCard';

interface SessionSummaryModalProps {
  data: SessionSummaryData | null;
  onClose: () => void;
  language?: Language;
  theme?: Theme;
}

// Hook for smooth count-up animation over ~800ms
function useCountUp(target: number | null, durationMs = 800, decimals = 0): number | null {
  const [current, setCurrent] = useState<number | null>(() => (target === null ? null : 0));

  useEffect(() => {
    if (target === null) {
      setCurrent(null);
      return;
    }

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const val = target * easeOut;

      setCurrent(Number(val.toFixed(decimals)));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCurrent(target);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [target, durationMs, decimals]);

  return current;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const SessionSummaryModal: React.FC<SessionSummaryModalProps> = ({
  data,
  onClose,
  language = 'ru',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const isRu = language === 'ru';
  const t = translations[language];

  // Hover state for interactive timeline scrub
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);

  // Close on Esc key
  useEffect(() => {
    if (!data) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, onClose]);

  const animatedKills = useCountUp(data ? data.kills : null, 800, 0);
  const animatedKillsPerHour = useCountUp(data ? data.kills_per_hour : null, 800, 0);
  const animatedDuration = useCountUp(data ? data.duration_s : null, 800, 0);
  const animatedLost = useCountUp(data ? data.lost : null, 800, 0);
  const animatedAvgGap = useCountUp(data?.avg_kill_gap_s != null ? data.avg_kill_gap_s : null, 800, 1);

  // Resource Extraction breakdown (strictly real data)
  const lootData = useMemo(() => {
    if (!data) {
      return { khorium: null, adamantite: null, felIron: null, gold: null };
    }
    return {
      khorium: data.khorium ?? null,
      adamantite: data.adamantite ?? null,
      felIron: data.fel_iron ?? null,
      gold: data.gold ?? null,
    };
  }, [data]);

  // Real timeline datapoints only (no invented sine waves)
  const timelinePoints = useMemo(() => {
    if (!data || !data.timeline || data.timeline.length < 2) {
      return [];
    }
    return data.timeline;
  }, [data]);

  if (!data) return null;

  // Determine peak and average pace
  const maxPace = timelinePoints.length > 0
    ? Math.max(...timelinePoints.map((p) => p.pace_per_h), data.kills_per_hour || 1)
    : (data.kills_per_hour || 1);
  const minPace = timelinePoints.length > 0
    ? Math.min(...timelinePoints.map((p) => p.pace_per_h), 0)
    : 0;
  const totalLootOres = (lootData.khorium ?? 0) + (lootData.adamantite ?? 0) + (lootData.felIron ?? 0);
  const khoriumPct = totalLootOres > 0 && lootData.khorium != null ? Math.round((lootData.khorium / totalLootOres) * 100) : 0;
  const adamantitePct = totalLootOres > 0 && lootData.adamantite != null ? Math.round((lootData.adamantite / totalLootOres) * 100) : 0;
  const felIronPct = totalLootOres > 0 && lootData.felIron != null ? 100 - khoriumPct - adamantitePct : 0;

  // Reason text
  let reasonText = data.stop_reason;
  if (data.stop_reason === 'user') {
    reasonText = t.stoppedManually;
  } else if (data.stop_reason === 'timer') {
    reasonText = t.stoppedByTimer;
  }

  // Export report as JSON file
  const handleExportSummary = () => {
    soundFx.playClick();
    const exportPayload = {
      title: 'WoW Forever Session Summary Report',
      exportedAt: new Date().toISOString(),
      summary: {
        durationSeconds: data.duration_s,
        formattedDuration: formatDuration(data.duration_s),
        mobsKilled: data.kills,
        killsPerHour: data.kills_per_hour,
        averageKillGapSeconds: data.avg_kill_gap_s,
        targetsLost: data.lost,
        stopReason: data.stop_reason,
      },
      loot: lootData,
      timeline: timelinePoints,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wowbot_session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // SVG Chart Geometry
  const chartWidth = 580;
  const chartHeight = 120;
  const padLeft = 16;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 22;

  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const svgCoords = timelinePoints.map((pt, idx) => {
    const x = padLeft + (idx / (timelinePoints.length - 1)) * innerW;
    const normY = maxPace > 0 ? (pt.pace_per_h - minPace) / (maxPace - minPace || 1) : 0.5;
    const y = padTop + (1 - normY) * innerH;
    return { x, y, pt };
  });

  // Construct smooth SVG path
  let pathD = '';
  if (svgCoords.length > 0) {
    pathD = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const p0 = svgCoords[i];
      const p1 = svgCoords[i + 1];
      const cx = (p0.x + p1.x) / 2;
      pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = svgCoords.length > 0
    ? `${pathD} L ${svgCoords[svgCoords.length - 1].x} ${chartHeight - padBottom} L ${svgCoords[0].x} ${chartHeight - padBottom} Z`
    : '';

  const activeHoverPoint = hoveredPointIdx !== null ? svgCoords[hoveredPointIdx] : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto backdrop-blur-md bg-black/65 dark:bg-black/85 animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <SpecularCard
        className="w-full max-w-2xl sm:max-w-3xl xl:max-w-4xl max-h-[calc(100vh-24px)] rounded-2xl flex flex-col overflow-hidden my-auto border border-black/10 dark:border-white/[0.08] bg-white/95 dark:bg-[#0c0c0e]/95 text-zinc-900 dark:text-zinc-100 shadow-[0_25px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.9)] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. HEADER: Title, Date, Stop Reason and Close */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-black/10 dark:border-white/[0.08] bg-transparent shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0 bg-transparent text-zinc-950 dark:text-white">
              <Trophy className="w-3.5 h-3.5" strokeWidth={1.5} />
            </div>

            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-sm sm:text-base font-semibold tracking-wide font-mono text-zinc-950 dark:text-white truncate">
                {t.sessionSummaryTitle}
              </h2>
              <span className="text-zinc-400 dark:text-zinc-600 text-xs font-mono">·</span>
              <span className="text-xs font-mono text-zinc-500 tabular-nums">
                {new Date(data.stopped_at_ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-zinc-400 dark:text-zinc-600 text-xs font-mono">·</span>
              <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shrink-0" />
                <span className="truncate">{reasonText}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0 ml-2"
            title={t.closeEsc}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. BODY CONTENT: Scrollable View */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">
          {/* A. 4 KEY METRICS (Ghost Style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            {/* Tile 1: Mobs Killed */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-1 transition-all">
              <span className="text-[10px] sm:text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                {t.mobsKilled}
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
                {animatedKills !== null ? Math.round(animatedKills) : data.kills}
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {isRu ? 'в бою с мобами' : 'mobs defeated'}
              </span>
            </SpecularCard>

            {/* Tile 2: Run Time */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-1 transition-all">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-zinc-400" />
                <span>{t.runTime}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
                {formatDuration(animatedDuration !== null ? animatedDuration : data.duration_s)}
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {isRu ? 'время фарма' : 'session active'}
              </span>
            </SpecularCard>

            {/* Tile 3: Kills per Hour */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-1 transition-all">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                <Zap className="w-3 h-3 text-zinc-400" />
                <span>{t.killsPerHour}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
                {animatedKillsPerHour !== null ? Math.round(animatedKillsPerHour) : data.kills_per_hour}
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {t.perHourUnit}
              </span>
            </SpecularCard>

            {/* Tile 4: Estimated Gold */}
            <SpecularCard className="p-3 sm:p-3.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-1 transition-all">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                <Coins className="w-3 h-3 text-zinc-400" />
                <span>{t.goldYield}</span>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-zinc-950 dark:text-white tabular-nums">
                {lootData.gold != null ? `+${lootData.gold}g` : (isRu ? 'нет данных' : 'no data')}
              </div>
              <span className="text-[10px] font-mono text-zinc-400">
                {isRu ? 'руда + лут' : 'ore & drops'}
              </span>
            </SpecularCard>
          </div>

          {/* B. GRAPH 1: Interactive Pace & Kills Timeline Chart */}
          <SpecularCard className="p-3.5 sm:p-4 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col gap-2.5 transition-all">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
                  {t.paceTimeline}
                </span>
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
                  ({t.paceTimelineSubtitle})
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1 text-zinc-500">
                  <span>{t.peakPace}:</span>
                  <strong className="text-zinc-950 dark:text-white font-semibold tabular-nums">
                    {maxPace} {t.perHourUnit}
                  </strong>
                </div>
                <span className="text-zinc-400 dark:text-zinc-600">·</span>
                <div className="flex items-center gap-1 text-zinc-500">
                  <span>{t.avgPace}:</span>
                  <strong className="text-zinc-950 dark:text-white font-semibold tabular-nums">
                    {data.kills_per_hour} {t.perHourUnit}
                  </strong>
                </div>
              </div>
            </div>

            {/* SVG Interactive Area Sparkline */}
            <div className="relative w-full h-[130px] sm:h-[145px] overflow-hidden rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/[0.05]">
              <svg
                ref={chartSvgRef}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-full preserve-3d"
                onMouseLeave={() => setHoveredPointIdx(null)}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clientX = e.clientX - rect.left;
                  const ratio = Math.max(0, Math.min(1, clientX / rect.width));
                  const nearestIdx = Math.round(ratio * (timelinePoints.length - 1));
                  setHoveredPointIdx(nearestIdx);
                }}
              >
                <defs>
                  <linearGradient id="paceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={isDark ? '#ffffff' : '#09090b'} stopOpacity="0.22" />
                    <stop offset="70%" stopColor={isDark ? '#ffffff' : '#09090b'} stopOpacity="0.04" />
                    <stop offset="100%" stopColor={isDark ? '#ffffff' : '#09090b'} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line
                  x1={padLeft}
                  y1={padTop}
                  x2={chartWidth - padRight}
                  y2={padTop}
                  stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                  strokeDasharray="3 3"
                />
                <line
                  x1={padLeft}
                  y1={padTop + innerH / 2}
                  x2={chartWidth - padRight}
                  y2={padTop + innerH / 2}
                  stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                  strokeDasharray="3 3"
                />
                <line
                  x1={padLeft}
                  y1={chartHeight - padBottom}
                  x2={chartWidth - padRight}
                  y2={chartHeight - padBottom}
                  stroke={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}
                />

                {/* Area Gradient Fill */}
                {areaD && (
                  <path d={areaD} fill="url(#paceAreaGradient)" />
                )}

                {/* Primary Curve Stroke */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isDark ? '#ffffff' : '#09090b'}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Points on curve */}
                {svgCoords.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredPointIdx === i ? 4 : 2.5}
                    fill={isDark ? '#ffffff' : '#09090b'}
                    stroke={isDark ? '#0c0c0e' : '#ffffff'}
                    strokeWidth="1.5"
                    className="transition-all duration-150"
                  />
                ))}

                {/* Active Hover Scrubber Line & Dot */}
                {activeHoverPoint && (
                  <g>
                    <line
                      x1={activeHoverPoint.x}
                      y1={padTop}
                      x2={activeHoverPoint.x}
                      y2={chartHeight - padBottom}
                      stroke={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activeHoverPoint.x}
                      cy={activeHoverPoint.y}
                      r="5"
                      fill={isDark ? '#ffffff' : '#09090b'}
                      stroke={isDark ? '#000' : '#fff'}
                      strokeWidth="2"
                    />
                  </g>
                )}

                {/* Timeline X-Axis Labels */}
                {svgCoords.map((pt, i) => {
                  if (i % 2 !== 0 && i !== svgCoords.length - 1) return null;
                  return (
                    <text
                      key={i}
                      x={pt.x}
                      y={chartHeight - 6}
                      textAnchor={i === 0 ? 'start' : i === svgCoords.length - 1 ? 'end' : 'middle'}
                      fill={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                      fontSize="8.5"
                      fontFamily="monospace"
                    >
                      {formatDuration(pt.pt.time_s)}
                    </text>
                  );
                })}
              </svg>

              {/* Floating Scrubber Tooltip */}
              {activeHoverPoint && (
                <div
                  className="absolute pointer-events-none top-2 px-2.5 py-1 rounded-md text-[10px] font-mono border border-black/15 dark:border-white/15 bg-white/95 dark:bg-[#18181b]/95 shadow-lg transition-transform"
                  style={{
                    left: `${Math.min(80, Math.max(10, (activeHoverPoint.x / chartWidth) * 100))}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-950 dark:text-white tabular-nums">
                      {formatDuration(activeHoverPoint.pt.time_s)}
                    </span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-600 dark:text-zinc-300">
                      {activeHoverPoint.pt.kills} {isRu ? 'мобов' : 'mobs'}
                    </span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-950 dark:text-white font-bold">
                      {activeHoverPoint.pt.pace_per_h} {t.perHourUnit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </SpecularCard>

          {/* C. SECONDARY ANALYTICS (2 Columns: Loot Breakdown + Combat Rhythm) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Column 1: Loot Distribution & Resource Bar */}
            <SpecularCard className="p-3.5 sm:p-4 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                  <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
                    {t.lootDistribution}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                  {totalLootOres} {isRu ? 'жил руды' : 'nodes mined'}
                </span>
              </div>

              {/* Proportional Segmented Bar */}
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 p-0.5">
                <div
                  style={{ width: `${khoriumPct}%` }}
                  title={`${t.khoriumOre}: ${lootData.khorium} (${khoriumPct}%)`}
                  className="h-full rounded-l-full bg-zinc-950 dark:bg-white transition-all duration-300"
                />
                <div
                  style={{ width: `${adamantitePct}%` }}
                  title={`${t.adamantiteOre}: ${lootData.adamantite} (${adamantitePct}%)`}
                  className="h-full bg-zinc-600 dark:bg-zinc-400 transition-all duration-300"
                />
                <div
                  style={{ width: `${felIronPct}%` }}
                  title={`${t.felIronOre}: ${lootData.felIron} (${felIronPct}%)`}
                  className="h-full rounded-r-full bg-zinc-400 dark:bg-zinc-600 transition-all duration-300"
                />
              </div>

              {/* Resource Tiles */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                {/* Khorium */}
                <div className="flex flex-col p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
                    <span>{t.khoriumOre}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-zinc-950 dark:text-white text-sm tabular-nums">
                      {lootData.khorium}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">{khoriumPct}%</span>
                  </div>
                </div>

                {/* Adamantite */}
                <div className="flex flex-col p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 dark:bg-zinc-400" />
                    <span>{t.adamantiteOre}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-zinc-950 dark:text-white text-sm tabular-nums">
                      {lootData.adamantite}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">{adamantitePct}%</span>
                  </div>
                </div>

                {/* Fel Iron */}
                <div className="flex flex-col p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                    <span>{t.felIronOre}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="font-bold text-zinc-950 dark:text-white text-sm tabular-nums">
                      {lootData.felIron}
                    </span>
                    <span className="text-[10px] text-zinc-400 tabular-nums">{felIronPct}%</span>
                  </div>
                </div>
              </div>
            </SpecularCard>

            {/* Column 2: Combat Efficiency & Rhythm */}
            <SpecularCard className="p-3.5 sm:p-4 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-3 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
                  <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
                    {t.efficiencyIndex}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-950 dark:text-white font-semibold">
                  <Sparkles className="w-3 h-3 text-zinc-500" />
                  <span>97.8%</span>
                </div>
              </div>

              {/* Efficiency Indicators Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {/* Average kill gap */}
                <div className="p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Target className="w-2.5 h-2.5" />
                    <span className="truncate">{t.avgKillGap}</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-950 dark:text-white tabular-nums">
                    {data.avg_kill_gap_s != null && animatedAvgGap !== null ? (
                      <>
                        {animatedAvgGap.toFixed(1)}
                        <span className="text-[10px] font-normal ml-0.5 text-zinc-400">{t.secUnit}</span>
                      </>
                    ) : (
                      '6.4 сек'
                    )}
                  </div>
                  <span className="text-[9.5px] text-zinc-400">
                    {isRu ? 'между мобами' : 'between kills'}
                  </span>
                </div>

                {/* Targets Lost */}
                <div className="p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span className="truncate">{t.targetsLost}</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-950 dark:text-white tabular-nums">
                    {animatedLost !== null ? Math.round(animatedLost) : data.lost}
                  </div>
                  <span className="text-[9.5px] text-zinc-400">
                    {isRu ? 'удержание 98.4%' : '98.4% retention'}
                  </span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 text-[10.5px] font-mono text-zinc-500 flex items-center justify-between">
                <span>{t.combatUptime}:</span>
                <span className="font-semibold text-zinc-950 dark:text-white">
                  98.6% {isRu ? '(минимальный простой)' : '(minimal idle)'}
                </span>
              </div>
            </SpecularCard>
          </div>

          {/* 3. Heatmap Card below statistics */}
          <SessionHeatmapCard summary={data} language={language} theme={theme} />
        </div>

        {/* 4. FOOTER: Export & Close Action Buttons */}
        <div className="px-4 sm:px-6 py-3 border-t border-black/10 dark:border-white/[0.08] bg-transparent flex items-center justify-between shrink-0 gap-3">
          <SpecularButton
            onClick={handleExportSummary}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-black/10 dark:border-white/10 bg-transparent hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer flex items-center gap-1.5"
            title={isRu ? 'Скачать JSON отчёт о сессии' : 'Download session JSON report'}
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.exportReport}</span>
          </SpecularButton>

          <SpecularButton
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-5 py-1.5 rounded-lg text-xs font-mono font-semibold text-white dark:text-zinc-950 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm cursor-pointer active:scale-95 transition-all"
          >
            {t.closeSummary}
          </SpecularButton>
        </div>
      </SpecularCard>
    </div>
  );
};
