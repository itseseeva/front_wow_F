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

  // If there is no session data, strictly show "нет данных" without any invented numbers
  if (!data) {
    return (
      <div className="flex flex-col gap-3 animate-fadeIn text-zinc-900 dark:text-zinc-100 select-none">
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
            {isRu ? 'Итоги сессии' : 'Session Summary'}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            {isRu ? 'нет данных' : 'no data'}
          </span>
        </div>

        <div className="p-4 rounded-xl border border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center text-center gap-2 py-8 bg-transparent">
          <span className="text-xs font-mono font-semibold text-zinc-500 dark:text-zinc-400">
            {isRu ? 'нет данных' : 'no data'}
          </span>
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 leading-relaxed">
            {isRu
              ? 'Сессия еще не запускалась или данные отсутствуют'
              : 'Session has not been run or data is unavailable'}
          </span>
        </div>
      </div>
    );
  }

  // Real fields from data only — never fabricated
  const khoriumDisplay = data.khorium != null ? data.khorium : (isRu ? 'нет данных' : 'no data');
  const adamantiteDisplay = data.adamantite != null ? data.adamantite : (isRu ? 'нет данных' : 'no data');
  const felIronDisplay = data.fel_iron != null ? data.fel_iron : (isRu ? 'нет данных' : 'no data');
  const goldDisplay = data.gold != null ? `+${data.gold.toLocaleString()}g` : (isRu ? 'нет данных' : 'no data');

  // Real timeline datapoints only (no invented sine waves)
  const timelinePoints = (data.timeline && data.timeline.length >= 2) ? data.timeline : [];

  const maxPace = timelinePoints.length > 0
    ? Math.max(...timelinePoints.map((p) => p.pace_per_h), data.kills_per_hour || 1)
    : (data.kills_per_hour || 1);
  const minPace = timelinePoints.length > 0
    ? Math.min(...timelinePoints.map((p) => p.pace_per_h), 0)
    : 0;

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
    const x = padLeft + (idx / Math.max(1, timelinePoints.length - 1)) * innerW;
    const normY = maxPace > minPace ? (pt.pace_per_h - minPace) / (maxPace - minPace) : 0.5;
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

  // Export JSON handler with strictly real data
  const handleExportJson = () => {
    soundFx.playClick();
    const payload = {
      title: 'WoW Forever Session Report',
      exportedAt: new Date().toISOString(),
      summary: {
        durationSeconds: data.duration_s,
        formattedDuration: formatDuration(data.duration_s),
        nodesGathered: data.kills,
        nodesPerHour: data.kills_per_hour,
        avgGapSeconds: data.avg_kill_gap_s,
        targetsLost: data.lost,
        stopReason: data.stop_reason,
      },
      resources: {
        khorium: data.khorium ?? null,
        adamantite: data.adamantite ?? null,
        felIron: data.fel_iron ?? null,
        gold: data.gold ?? null,
      },
      timeline: data.timeline ?? [],
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
          <span>{data.duration_s != null ? formatDuration(data.duration_s) : (isRu ? 'нет данных' : 'no data')}</span>
        </span>
      </div>

      {/* 2. Resources Extraction Card */}
      <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col gap-2 transition-all">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
            <span>{isRu ? 'Кориум:' : 'Khorium:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{khoriumDisplay}</span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>{isRu ? 'Адамант:' : 'Adamantite:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{adamantiteDisplay}</span>
        </div>

        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
            <span>{isRu ? 'Железо:' : 'Fel Iron:'}</span>
          </div>
          <span className="font-semibold text-zinc-950 dark:text-white font-mono">{felIronDisplay}</span>
        </div>

        {/* Gold extraction total */}
        <div className="pt-2 mt-1 border-t border-black/10 dark:border-white/10 flex items-center justify-between font-mono">
          <span className="text-[11px] text-zinc-500">{isRu ? 'Золото:' : 'Gold:'}</span>
          <span className="text-xs font-bold text-zinc-950 dark:text-white tracking-wide">
            {goldDisplay}
          </span>
        </div>
      </div>

      {/* 3. Performance Rate Sparkline Chart or No Data Notice */}
      <div className="p-2.5 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col gap-1.5 transition-all">
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-zinc-500" />
            <span>{isRu ? 'Темп сбора' : 'Pace chart'}</span>
          </span>
          <span className="text-zinc-950 dark:text-white font-semibold">
            {hoveredPointIdx !== null && svgCoords[hoveredPointIdx]
              ? `${svgCoords[hoveredPointIdx].pt.pace_per_h}/ч`
              : (data.kills_per_hour != null ? `${data.kills_per_hour}/ч` : (isRu ? 'нет данных' : 'no data'))}
          </span>
        </div>

        {/* SVG Sparkline only if real timeline exists */}
        {timelinePoints.length >= 2 ? (
          <>
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

                {areaD && (
                  <path
                    d={areaD}
                    fill="url(#sidebarChartGrad)"
                    className="text-zinc-950 dark:text-white"
                  />
                )}

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
              <span>{formatDuration(data.duration_s)}</span>
            </div>
          </>
        ) : (
          <div className="h-[44px] flex items-center justify-center text-[10px] font-mono text-zinc-500">
            {isRu ? 'нет данных' : 'no data'}
          </div>
        )}
      </div>

      {/* 4. Efficiency Overview Badges */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col">
          <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Узлов' : 'Nodes'}</span>
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
            {data.kills != null ? data.kills : (isRu ? 'нет данных' : 'no data')}
          </span>
        </div>
        <div className="p-2 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col">
          <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Пауза' : 'Avg Gap'}</span>
          <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
            {data.avg_kill_gap_s != null ? `${data.avg_kill_gap_s}с` : (isRu ? 'нет данных' : 'no data')}
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
