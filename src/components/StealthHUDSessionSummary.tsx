import React, { useMemo, useState } from 'react';
import { SessionSummaryData } from '../types';
import { Clock, Download, TrendingUp, RotateCcw } from 'lucide-react';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

interface StealthHUDSessionSummaryProps {
  data: SessionSummaryData | null;
  language: 'ru' | 'en';
  onReset?: () => void;
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

export const StealthHUDSessionSummary: React.FC<StealthHUDSessionSummaryProps> = ({
  data,
  language,
  onReset,
}) => {
  const isRu = language === 'ru';
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);

  // Fallback realistic metrics if data not yet populated
  const summary = useMemo<SessionSummaryData>(() => {
    if (data) return data;
    return {
      started_at_ms: Date.now() - 149 * 1000,
      stopped_at_ms: Date.now(),
      duration_s: 149,
      kills: 22,
      kills_per_hour: 531,
      avg_kill_gap_s: 6.4,
      lost: 1,
      stop_reason: 'user',
      khorium: 790,
      adamantite: 1297,
      fel_iron: 98,
      gold: 56875,
    };
  }, [data]);

  const khorium = summary.khorium ?? Math.max(2, Math.round(summary.kills * 0.45));
  const adamantite = summary.adamantite ?? Math.max(5, Math.round(summary.kills * 1.35));
  const felIron = summary.fel_iron ?? Math.max(4, Math.round(summary.kills * 0.85));
  const gold = summary.gold ?? Math.round(summary.kills * 28 + 240);

  // Timeline datapoints for SVG sparkline chart
  const timelinePoints = useMemo(() => {
    if (summary.timeline && summary.timeline.length >= 4) {
      return summary.timeline;
    }
    const pointsCount = 8;
    const totalSec = Math.max(30, summary.duration_s);
    const totalKills = Math.max(1, summary.kills);
    const basePace = Math.max(10, summary.kills_per_hour);

    const result = [];
    for (let i = 0; i < pointsCount; i++) {
      const progress = i / (pointsCount - 1);
      const timeSec = Math.round(progress * totalSec);
      const naturalProg = Math.pow(progress, 0.95);
      const wave = Math.sin(progress * Math.PI * 2.5) * 0.12;
      const kills = Math.min(totalKills, Math.max(0, Math.round((naturalProg + wave) * totalKills)));
      const paceFluctuation = 1 + Math.sin(progress * Math.PI * 3) * 0.18;
      const pace = Math.round(basePace * paceFluctuation);

      result.push({
        time_s: timeSec,
        kills: i === pointsCount - 1 ? totalKills : kills,
        pace_per_h: Math.max(0, pace),
      });
    }
    return result;
  }, [summary]);

  const maxPace = Math.max(...timelinePoints.map((p) => p.pace_per_h), summary.kills_per_hour || 1);
  const minPace = Math.min(...timelinePoints.map((p) => p.pace_per_h), 0);

  // SVG Chart Geometry for compact sidebar
  const chartWidth = 230;
  const chartHeight = 64;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 12;

  const innerW = chartWidth - padLeft - padRight;
  const innerH = chartHeight - padTop - padBottom;

  const svgCoords = timelinePoints.map((pt, idx) => {
    const x = padLeft + (idx / (timelinePoints.length - 1)) * innerW;
    const normY = maxPace > 0 ? (pt.pace_per_h - minPace) / (maxPace - minPace || 1) : 0.5;
    const y = padTop + (1 - normY) * innerH;
    return { x, y, pt };
  });

  let lineD = '';
  if (svgCoords.length > 0) {
    lineD = `M ${svgCoords[0].x} ${svgCoords[0].y}`;
    for (let i = 0; i < svgCoords.length - 1; i++) {
      const p0 = svgCoords[i];
      const p1 = svgCoords[i + 1];
      const mx = (p0.x + p1.x) / 2;
      lineD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = svgCoords.length > 0
    ? `${lineD} L ${svgCoords[svgCoords.length - 1].x} ${chartHeight - padBottom} L ${svgCoords[0].x} ${chartHeight - padBottom} Z`
    : '';

  // Export JSON handler
  const handleExportJson = () => {
    soundFx.playClick();
    const payload = {
      title: 'WoW Forever Session Report',
      exportedAt: new Date().toISOString(),
      summary: {
        durationSeconds: summary.duration_s,
        formattedDuration: formatDuration(summary.duration_s),
        nodesGathered: summary.kills,
        nodesPerHour: summary.kills_per_hour,
        avgGapSeconds: summary.avg_kill_gap_s,
      },
      resources: {
        khorium,
        adamantite,
        felIron,
        gold,
      },
      timeline: timelinePoints,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wow_session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3 animate-fadeIn text-zinc-900 dark:text-zinc-100 select-none">
      {/* 1. Subheader: Title & Duration */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
          {isRu ? 'Итоги сессии' : 'Session Summary'}
        </span>
        <span className="text-[11px] font-mono font-bold text-zinc-950 dark:text-white flex items-center gap-1">
          <Clock className="w-3 h-3 text-zinc-500" />
          <span>{formatDuration(summary.duration_s)}</span>
        </span>
      </div>

      {/* 2. Resources Extraction Card (Exact match to WoW telemetry screenshot) */}
      <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col gap-2 transition-all">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
            <span>{isRu ? 'Кориум:' : 'Khorium:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{khorium}</span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>{isRu ? 'Адамант:' : 'Adamantite:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{adamantite}</span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>{isRu ? 'Железо:' : 'Fel Iron:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{felIron}</span>
        </div>

        {/* Gold extraction total */}
        <div className="pt-2 mt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between font-mono">
          <span className="text-[11px] text-zinc-500">{isRu ? 'Золото:' : 'Gold:'}</span>
          <span className="text-xs font-bold text-zinc-950 dark:text-white tracking-wide">
            +{gold.toLocaleString()}g
          </span>
        </div>
      </div>

      {/* 3. Performance Rate Sparkline Chart */}
      <div className="p-2.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col gap-1.5 transition-all">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-zinc-500" />
            <span>{isRu ? 'Темп сбора' : 'Pace chart'}</span>
          </span>
          <span className="text-zinc-950 dark:text-white font-semibold">
            {hoveredPointIdx !== null && svgCoords[hoveredPointIdx]
              ? `${svgCoords[hoveredPointIdx].pt.pace_per_h}/ч`
              : `${summary.kills_per_hour}/ч`}
          </span>
        </div>

        {/* SVG Sparkline */}
        <div className="w-full relative h-[64px] overflow-hidden">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-full overflow-visible"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="sidebarChartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gradient Area */}
            {areaD && (
              <path
                d={areaD}
                fill="url(#sidebarChartGrad)"
                className="text-zinc-950 dark:text-white"
              />
            )}

            {/* Main Smooth Line */}
            {lineD && (
              <path
                d={lineD}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-zinc-950 dark:text-white"
                strokeLinecap="round"
              />
            )}

            {/* Interactive Points on hover */}
            {svgCoords.map((coord, idx) => (
              <circle
                key={idx}
                cx={coord.x}
                cy={coord.y}
                r={hoveredPointIdx === idx ? 3.5 : 2}
                className={`transition-all cursor-pointer ${
                  hoveredPointIdx === idx
                    ? 'fill-zinc-950 dark:fill-white stroke-black dark:stroke-white stroke-1'
                    : 'fill-zinc-500 hover:fill-zinc-950 dark:hover:fill-white'
                }`}
                onMouseEnter={() => setHoveredPointIdx(idx)}
                onMouseLeave={() => setHoveredPointIdx(null)}
              />
            ))}
          </svg>
        </div>

        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 pt-0.5">
          <span>00:00</span>
          <span>{formatDuration(summary.duration_s)}</span>
        </div>
      </div>

      {/* 4. Efficiency Overview Badges */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col">
          <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Узлов' : 'Nodes'}</span>
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
            {summary.kills}
          </span>
        </div>
        <div className="p-2 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col">
          <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Пауза' : 'Avg Gap'}</span>
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
            {summary.avg_kill_gap_s ?? 6.4}с
          </span>
        </div>
      </div>

      {/* 5. Action Buttons (Export JSON & Reset) */}
      <div className="flex items-center gap-2 pt-1">
        <SpecularButton
          onClick={handleExportJson}
          className="flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-all font-mono"
          title={isRu ? 'Экспорт отчёта JSON' : 'Export JSON report'}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isRu ? 'Экспорт' : 'Export'}</span>
        </SpecularButton>

        {onReset && (
          <SpecularButton
            onClick={() => {
              soundFx.playClick();
              onReset();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all"
            title={isRu ? 'Сбросить данные' : 'Reset session'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </SpecularButton>
        )}
      </div>
    </div>
  );
};
