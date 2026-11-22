import React, { useState, useEffect, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import { Play, Pause, Route } from 'lucide-react';
import { HeatmapMark, HeatmapSavings, HeatmapTimeline } from '../types';
import { soundFx } from '../utils/audio';

export type HeatmapLayerKey = 'ok' | 'fight' | 'camp' | 'detour';
export type HeatmapLayersState = Record<HeatmapLayerKey, boolean>;

const LAYERS_STORAGE_KEY = 'wowbot_heatmap_layers_v3';
const LAYERS_SYNC_EVENT = 'wowbot:heatmap-layers-changed';

export const DEFAULT_HEATMAP_LAYERS: HeatmapLayersState = {
  ok: true,
  fight: true,
  camp: true,
  detour: true,
};

function readStoredLayers(): HeatmapLayersState {
  try {
    const raw = localStorage.getItem(LAYERS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_HEATMAP_LAYERS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_HEATMAP_LAYERS };
    return {
      ok: typeof parsed.ok === 'boolean' ? parsed.ok : DEFAULT_HEATMAP_LAYERS.ok,
      fight: typeof parsed.fight === 'boolean' ? parsed.fight : DEFAULT_HEATMAP_LAYERS.fight,
      camp: typeof parsed.camp === 'boolean' ? parsed.camp : DEFAULT_HEATMAP_LAYERS.camp,
      detour: typeof parsed.detour === 'boolean' ? parsed.detour : DEFAULT_HEATMAP_LAYERS.detour,
    };
  } catch {
    return { ...DEFAULT_HEATMAP_LAYERS };
  }
}

export function useHeatmapLayers(): [HeatmapLayersState, (key: HeatmapLayerKey) => void] {
  const [layers, setLayers] = useState<HeatmapLayersState>(() => readStoredLayers());

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent<HeatmapLayersState>).detail;
      if (detail) {
        setLayers(detail);
      }
    };
    window.addEventListener(LAYERS_SYNC_EVENT, handleSync);
    return () => window.removeEventListener(LAYERS_SYNC_EVENT, handleSync);
  }, []);

  const toggleLayer = useCallback((key: HeatmapLayerKey) => {
    soundFx.playClick();
    setLayers((prev) => {
      const next: HeatmapLayersState = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      window.dispatchEvent(new CustomEvent(LAYERS_SYNC_EVENT, { detail: next }));
      return next;
    });
  }, []);

  return [layers, toggleLayer];
}

// ---------- Clock, Path Color & Timeline Interpolation Utilities ----------

export function formatClockTime(startStr: string, offsetSeconds: number): string {
  const parts = startStr.trim().split(':').map((p) => parseInt(p, 10));
  const h = Number.isFinite(parts[0]) ? parts[0] : 0;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  const s = Number.isFinite(parts[2]) ? parts[2] : 0;
  const baseSec = h * 3600 + m * 60 + s;
  const totalSec = (((baseSec + Math.round(offsetSeconds)) % 86400) + 86400) % 86400;
  const outH = Math.floor(totalSec / 3600);
  const outM = Math.floor((totalSec % 3600) / 60);
  const outS = totalSec % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}`;
}

// Smooth modern time-progression ramp (Strava / Apple Fitness / Linear inspired):
// Emerald (#34D399) -> Sky (#38BDF8) -> Indigo (#818CF8) -> Rose (#F43F5E)
const PATH_COLOR_STOPS: Array<{ u: number; rgb: [number, number, number] }> = [
  { u: 0.0, rgb: [52, 211, 153] },
  { u: 0.35, rgb: [56, 189, 248] },
  { u: 0.7, rgb: [129, 140, 248] },
  { u: 1.0, rgb: [244, 63, 94] },
];

export function interpolatePathColor(uRaw: number): string {
  const u = Math.max(0, Math.min(1, uRaw));
  for (let i = 0; i < PATH_COLOR_STOPS.length - 1; i++) {
    const a = PATH_COLOR_STOPS[i];
    const b = PATH_COLOR_STOPS[i + 1];
    if (u >= a.u && u <= b.u) {
      const f = b.u > a.u ? (u - a.u) / (b.u - a.u) : 0;
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return 'rgb(244, 63, 94)';
}

export function interpolateTimelinePoint(
  pts: [number, number, number][],
  targetT: number
): { x: number; y: number } | null {
  const n = pts.length;
  if (n === 0) return null;
  if (n === 1 || targetT <= pts[0][2]) {
    return { x: pts[0][0], y: pts[0][1] };
  }
  if (targetT >= pts[n - 1][2]) {
    return { x: pts[n - 1][0], y: pts[n - 1][1] };
  }

  // Binary search for largest index lo where pts[lo][2] <= targetT
  let lo = 0;
  let hi = n - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (pts[mid][2] <= targetT) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const p0 = pts[lo];
  const p1 = pts[hi];
  const span = p1[2] - p0[2];
  const f = span > 0 ? Math.max(0, Math.min(1, (targetT - p0[2]) / span)) : 0;
  return {
    x: p0[0] + (p1[0] - p0[0]) * f,
    y: p0[1] + (p1[1] - p0[1]) * f,
  };
}

// Shared playback hook: plays the whole session in ~20 seconds via requestAnimationFrame.
const REPLAY_DURATION_SECONDS = 20;

export function useHeatmapPlayback(timeline?: HeatmapTimeline | null) {
  const endS = timeline && timeline.end_s > 0 ? timeline.end_s : 0;
  const [currentT, setCurrentT] = useState<number>(endS);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  // Reset scrubber to end (full route visible) whenever timeline changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentT(endS);
  }, [timeline, endS]);

  useEffect(() => {
    if (!isPlaying || endS <= 0) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const rate = endS / REPLAY_DURATION_SECONDS;
    lastFrameRef.current = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, (now - lastFrameRef.current) / 1000));
      lastFrameRef.current = now;

      let finished = false;
      setCurrentT((prev) => {
        const next = prev + dt * rate;
        if (next >= endS) {
          finished = true;
          return endS;
        }
        return next;
      });

      if (finished) {
        setIsPlaying(false);
        rafRef.current = null;
      } else {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, endS]);

  const togglePlay = useCallback(() => {
    if (endS <= 0) return;
    soundFx.playClick();
    setIsPlaying((playing) => {
      if (!playing) {
        setCurrentT((prev) => (prev >= endS - 0.05 ? 0 : prev));
        return true;
      }
      return false;
    });
  }, [endS]);

  const seekTo = useCallback(
    (t: number) => {
      setIsPlaying(false);
      setCurrentT(Math.max(0, Math.min(endS, t)));
    },
    [endS]
  );

  return { currentT, isPlaying, togglePlay, seekTo };
}

// ---------- Counts & Visibility ----------

export interface HeatmapMarkCounts {
  ok: number;
  fight: number;
  camp: number;
  mob: number;
  campsButton: number;
  detour: number;
}

export function getHeatmapMarkCounts(marks: HeatmapMark[]): HeatmapMarkCounts {
  let ok = 0;
  let fight = 0;
  let camp = 0;
  let mob = 0;
  let detour = 0;

  for (const m of marks) {
    switch (m.kind) {
      case 'ok':
        ok += 1;
        break;
      case 'fight':
        fight += 1;
        break;
      case 'camp':
        camp += 1;
        break;
      case 'mob':
        mob += 1;
        break;
      case 'detour':
        detour += 1;
        break;
      default:
        break;
    }
  }

  return {
    ok,
    fight,
    camp,
    mob,
    campsButton: camp > 0 ? camp : mob,
    detour,
  };
}

// Bottom-to-top rendering order for marks (stuck/skip & camp rings are not rendered)
const MARK_Z_ORDER: Record<HeatmapMark['kind'], number> = {
  camp: 0,
  mob: 1,
  detour: 2,
  ok: 3,
  fight: 4,
  skip: 5,
  stuck: 6,
  start: 7,
  finish: 8,
};

function isMarkVisible(mark: HeatmapMark, layers: HeatmapLayersState): boolean {
  switch (mark.kind) {
    case 'stuck':
    case 'skip':
    case 'camp':
      return false;
    case 'start':
    case 'finish':
      return true;
    case 'ok':
      return layers.ok;
    case 'fight':
      return layers.fight;
    case 'mob':
      return layers.camp;
    case 'detour':
      return layers.detour;
    default:
      return true;
  }
}

// ---------- Path Geometry Builder (Bucketed Time-Gradient Polyline) ----------

interface PathBucket {
  d: string;
  color: string;
}

function buildPathData(
  pts: [number, number, number][],
  endS: number,
  currentT: number,
  width: number,
  height: number
): {
  fullPathD: string;
  passedPathD: string;
  passedBuckets: PathBucket[];
  botPos: { x: number; y: number } | null;
} {
  if (pts.length === 0 || width <= 0 || height <= 0) {
    return { fullPathD: '', passedPathD: '', passedBuckets: [], botPos: null };
  }

  const safeEnd = endS > 0 ? endS : Math.max(1, pts[pts.length - 1][2]);

  // 1. Full path string (for muted future/ghost line)
  const fullParts: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0] * width;
    const py = pts[i][1] * height;
    fullParts.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  const fullPathD = fullParts.join(' ');

  // 2. Passed points up to exact interpolated currentT
  const passedPts: Array<{ x: number; y: number; t: number }> = [];
  const clampedT = Math.max(0, Math.min(safeEnd, currentT));

  for (let i = 0; i < pts.length; i++) {
    const [nx, ny, nt] = pts[i];
    if (nt <= clampedT) {
      passedPts.push({ x: nx * width, y: ny * height, t: nt });
    } else {
      break;
    }
  }

  const botNorm = interpolateTimelinePoint(pts, clampedT);
  const botPos = botNorm ? { x: botNorm.x * width, y: botNorm.y * height } : null;

  if (botPos) {
    const last = passedPts[passedPts.length - 1];
    if (
      !last ||
      Math.hypot(last.x - botPos.x, last.y - botPos.y) > 0.25
    ) {
      passedPts.push({ x: botPos.x, y: botPos.y, t: clampedT });
    }
  }

  if (passedPts.length < 2) {
    return { fullPathD, passedPathD: '', passedBuckets: [], botPos };
  }

  // Passed full casing path
  const passedParts: string[] = [];
  for (let i = 0; i < passedPts.length; i++) {
    passedParts.push(`${i === 0 ? 'M' : 'L'}${passedPts[i].x.toFixed(1)},${passedPts[i].y.toFixed(1)}`);
  }
  const passedPathD = passedParts.join(' ');

  // Bucket segments into smooth time-colored chunks (max ~72 SVG paths even for thousands of points)
  const NUM_BUCKETS = 72;
  const bucketSegments: Map<number, string[]> = new Map();

  for (let i = 0; i < passedPts.length - 1; i++) {
    const a = passedPts[i];
    const b = passedPts[i + 1];
    const midT = (a.t + b.t) * 0.5;
    const u = Math.max(0, Math.min(1, midT / safeEnd));
    const bucketIdx = Math.min(NUM_BUCKETS - 1, Math.floor(u * NUM_BUCKETS));

    let segs = bucketSegments.get(bucketIdx);
    if (!segs) {
      segs = [];
      bucketSegments.set(bucketIdx, segs);
    }
    segs.push(`M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`);
  }

  const passedBuckets: PathBucket[] = [];
  bucketSegments.forEach((segs, idx) => {
    const u = (idx + 0.5) / NUM_BUCKETS;
    passedBuckets.push({
      d: segs.join(' '),
      color: interpolatePathColor(u),
    });
  });

  return { fullPathD, passedPathD, passedBuckets, botPos };
}

// ---------- Main SVG Layer (Time-Gradient Path + Interactive Marks + Live Bot Beacon) ----------

interface HeatmapMarksSvgProps {
  marks?: HeatmapMark[] | null;
  timeline?: HeatmapTimeline | null;
  currentT?: number;
  isPlaying?: boolean;
  layers: HeatmapLayersState;
  width: number;
  height: number;
  scale: number;
  language?: 'ru' | 'en';
  hoveredKey: string | null;
  onHoverMark: (mark: HeatmapMark | null, key: string | null, e?: React.MouseEvent) => void;
  onMoveMark: (e: React.MouseEvent) => void;
}

export const HeatmapMarksSvg: React.FC<HeatmapMarksSvgProps> = ({
  marks,
  timeline = null,
  currentT,
  isPlaying = false,
  layers,
  width,
  height,
  scale,
  language = 'ru',
  hoveredKey,
  onHoverMark,
  onMoveMark,
}) => {
  const isRu = language === 'ru';
  const safeScale = scale > 0 ? scale : 1;
  const invScale = 1 / safeScale;

  const hasTimeline = Boolean(timeline && timeline.pts && timeline.pts.length > 0);
  const effectiveT = hasTimeline && timeline
    ? (typeof currentT === 'number' ? currentT : timeline.end_s)
    : Infinity;

  const pathData = useMemo(() => {
    if (!hasTimeline || !timeline) return null;
    return buildPathData(timeline.pts, timeline.end_s, effectiveT, width, height);
  }, [hasTimeline, timeline, effectiveT, width, height]);

  const sortedMarks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    return marks
      .map((mark, idx) => ({ mark, key: `${mark.kind}-${idx}` }))
      .filter(({ mark }) => isMarkVisible(mark, layers))
      .sort((a, b) => MARK_Z_ORDER[a.mark.kind] - MARK_Z_ORDER[b.mark.kind]);
  }, [marks, layers]);

  if (width <= 0 || height <= 0 || (!pathData && sortedMarks.length === 0)) {
    return null;
  }

  const botProgressColor =
    hasTimeline && timeline && timeline.end_s > 0
      ? interpolatePathColor(effectiveT / timeline.end_s)
      : '#38BDF8';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none select-none"
      aria-label={isRu ? 'Интерактивный маршрут и метки' : 'Interactive route path and markers'}
    >
      {/* 1. Bot Route Path Layer (Strava / Apple Fitness / Linear time-gradient style, no arrows) */}
      {pathData && (
        <g className="pointer-events-none">
          {/* Future / full muted track */}
          {pathData.fullPathD && (
            <path
              d={pathData.fullPathD}
              fill="none"
              stroke="#94a3b8"
              strokeOpacity={0.22}
              strokeWidth={2.4 * invScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Soft glow behind passed route */}
          {pathData.passedBuckets.map((bucket, idx) => (
            <path
              key={`glow-${idx}`}
              d={bucket.d}
              fill="none"
              stroke={bucket.color}
              strokeOpacity={0.22}
              strokeWidth={7.5 * invScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Subtle dark casing for crisp legibility on bright terrain */}
          {pathData.passedPathD && (
            <path
              d={pathData.passedPathD}
              fill="none"
              stroke="#09090b"
              strokeOpacity={0.55}
              strokeWidth={4.4 * invScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vibrant time-gradient core */}
          {pathData.passedBuckets.map((bucket, idx) => (
            <path
              key={`core-${idx}`}
              d={bucket.d}
              fill="none"
              stroke={bucket.color}
              strokeOpacity={0.96}
              strokeWidth={2.8 * invScale}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      )}

      {/* 2. Interactive Marks Layer */}
      {sortedMarks.map(({ mark, key }) => {
        const cx = mark.x * width;
        const cy = mark.y * height;
        const isHovered = hoveredKey === key;

        // Progressive timeline reveal for ok / fight / detour
        const isTimelineGated =
          hasTimeline &&
          (mark.kind === 'ok' || mark.kind === 'fight' || mark.kind === 'detour') &&
          typeof mark.t === 'number';
        const isFutureMark = isTimelineGated && (mark.t as number) > effectiveT + 0.05;

        // Enrich tooltip clock time from timeline if mark.time isn't explicitly set
        let derivedTime = mark.time;
        if (!derivedTime && hasTimeline && timeline) {
          if (typeof mark.t === 'number') {
            derivedTime = formatClockTime(timeline.start, mark.t);
          } else if (mark.kind === 'start') {
            derivedTime = formatClockTime(timeline.start, 0);
          } else if (mark.kind === 'finish') {
            derivedTime = formatClockTime(timeline.start, timeline.end_s);
          }
        }
        const markForHover: HeatmapMark =
          derivedTime && derivedTime !== mark.time
            ? { ...mark, time: derivedTime }
            : mark;

        const handleMouseEnter = (e: React.MouseEvent) => {
          onHoverMark(markForHover, key, e);
        };
        const handleMouseMove = (e: React.MouseEvent) => {
          onMoveMark(e);
        };
        const handleMouseLeave = () => {
          onHoverMark(null, null);
        };

        return (
          <g
            key={key}
            transform={`translate(${cx}, ${cy}) scale(${invScale})`}
            opacity={isFutureMark ? 0.16 : 1}
            className="pointer-events-auto cursor-pointer transition-opacity duration-150"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* ok: WoW gather node — yellow #FFD100, dark outline #3A2A00, 8 px */}
            {mark.kind === 'ok' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7} fill="none" stroke="#FFD100" strokeWidth={1.5} strokeOpacity={0.85} />
                )}
                <circle r={4} fill="#FFD100" stroke="#3A2A00" strokeWidth={1.6} />
              </>
            )}

            {/* mob: small red dot #E24B4A, 5 px, dark outline */}
            {mark.kind === 'mob' && (
              <>
                <circle r={7} fill="transparent" />
                {isHovered && (
                  <circle r={5.5} fill="none" stroke="#E24B4A" strokeWidth={1.3} strokeOpacity={0.85} />
                )}
                <circle r={2.5} fill="#E24B4A" stroke="#18181b" strokeWidth={1.2} />
              </>
            )}

            {/* fight: red sword #E24B4A, ~16 px, dark backing outline for contrast */}
            {mark.kind === 'fight' && (
              <>
                <circle r={11} fill="transparent" />
                {isHovered && (
                  <circle
                    r={10.5}
                    fill="#E24B4A"
                    fillOpacity={0.18}
                    stroke="#E24B4A"
                    strokeWidth={1.3}
                    strokeOpacity={0.85}
                  />
                )}
                <g stroke="#18181b" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill="#18181b">
                  <polygon points="7,-7 3.2,-6.2 -1.8,-1.2 1.2,1.8 6.2,-3.2" />
                  <line x1={-4.2} y1={-1.2} x2={1.2} y2={4.2} />
                  <line x1={-1.6} y1={1.6} x2={-5.6} y2={5.6} />
                  <circle cx={-6} cy={6} r={1.6} />
                </g>
                <g fill="#E24B4A" stroke="#E24B4A" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="7,-7 3.2,-6.2 -1.8,-1.2 1.2,1.8 6.2,-3.2" strokeWidth={0.6} />
                  <line x1={-4.2} y1={-1.2} x2={1.2} y2={4.2} strokeWidth={2.1} />
                  <line x1={-1.6} y1={1.6} x2={-5.6} y2={5.6} strokeWidth={1.9} />
                  <circle cx={-6} cy={6} r={1.5} strokeWidth={0.5} />
                </g>
                <line
                  x1={5.2}
                  y1={-5.2}
                  x2={0.2}
                  y2={-0.2}
                  stroke="#fecaca"
                  strokeWidth={0.8}
                  strokeLinecap="round"
                  strokeOpacity={0.65}
                />
              </>
            )}

            {/* detour: purple dot #7F77DD + yellow-green "−{gain_s} с" badge */}
            {mark.kind === 'detour' && (() => {
              const hasGain = typeof mark.gain_s === 'number' && mark.gain_s > 0;
              const badgeText = hasGain
                ? (isRu ? `−${Math.round(mark.gain_s as number)} с` : `−${Math.round(mark.gain_s as number)}s`)
                : '';
              const badgeW = Math.max(36, badgeText.length * 6.4 + 10);

              return (
                <>
                  <circle r={9} fill="transparent" />
                  {isHovered && (
                    <circle r={7} fill="none" stroke="#7F77DD" strokeWidth={1.5} strokeOpacity={0.9} />
                  )}
                  <circle r={4} fill="#7F77DD" stroke="#ffffff" strokeWidth={1.5} />
                  {hasGain && !isFutureMark && (
                    <g transform="translate(8, -8.5)">
                      <rect
                        x={0}
                        y={0}
                        width={badgeW}
                        height={17}
                        rx={4.5}
                        fill="#bef264"
                        stroke="#18181b"
                        strokeWidth={1.2}
                      />
                      <text
                        x={badgeW / 2}
                        y={11.8}
                        textAnchor="middle"
                        fill="#14180b"
                        fontSize={10}
                        fontWeight={700}
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                      >
                        {badgeText}
                      </text>
                    </g>
                  )}
                </>
              );
            })()}

            {/* start: green badge below dot */}
            {mark.kind === 'start' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7} fill="none" stroke="#3B6D11" strokeWidth={1.5} strokeOpacity={0.85} />
                )}
                <circle r={4} fill="#3B6D11" stroke="#ffffff" strokeWidth={1.6} />
                <rect
                  x={-23}
                  y={7}
                  width={46}
                  height={17}
                  rx={4}
                  fill="#3B6D11"
                  stroke="#ffffff"
                  strokeOpacity={isHovered ? 0.85 : 0.35}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={18.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                >
                  {isRu ? 'Старт' : 'Start'}
                </text>
              </>
            )}

            {/* finish: burgundy badge below dot */}
            {mark.kind === 'finish' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7} fill="none" stroke="#993556" strokeWidth={1.5} strokeOpacity={0.85} />
                )}
                <circle r={4} fill="#993556" stroke="#ffffff" strokeWidth={1.6} />
                <rect
                  x={-25}
                  y={7}
                  width={50}
                  height={17}
                  rx={4}
                  fill="#993556"
                  stroke="#ffffff"
                  strokeOpacity={isHovered ? 0.85 : 0.35}
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={18.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={10}
                  fontWeight={600}
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                >
                  {isRu ? 'Финиш' : 'Finish'}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* 3. Current Bot Position Beacon on Path */}
      {pathData?.botPos && (
        <g
          transform={`translate(${pathData.botPos.x}, ${pathData.botPos.y}) scale(${invScale})`}
          className="pointer-events-none"
        >
          {/* Outer halo */}
          <circle
            r={isPlaying ? 12 : 9.5}
            fill={botProgressColor}
            fillOpacity={isPlaying ? 0.28 : 0.2}
          />
          {/* Crisp dark outer ring + white ring + progress-colored core */}
          <circle r={6.2} fill="#09090b" fillOpacity={0.85} />
          <circle r={4.8} fill="#ffffff" />
          <circle r={2.4} fill={botProgressColor} />
        </g>
      )}
    </svg>
  );
};

// ---------- Hover Tooltip (Clamped Inside Map Container) ----------

interface HeatmapMarkTooltipProps {
  mark: HeatmapMark | null;
  cursor: { x: number; y: number } | null;
  containerWidth: number;
  containerHeight: number;
}

export const HeatmapMarkTooltip: React.FC<HeatmapMarkTooltipProps> = ({
  mark,
  cursor,
  containerWidth,
  containerHeight,
}) => {
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!mark || !cursor || containerWidth <= 0 || containerHeight <= 0) {
      setPos(null);
      return;
    }

    const el = tooltipRef.current;
    const pad = 8;
    const gap = 14;
    const tipW = el ? el.offsetWidth : 180;
    const tipH = el ? el.offsetHeight : 32;

    let left = cursor.x + gap;
    if (left + tipW > containerWidth - pad) {
      left = cursor.x - tipW - gap;
    }
    left = Math.max(pad, Math.min(left, Math.max(pad, containerWidth - tipW - pad)));

    let top = cursor.y - tipH - 10;
    if (top < pad) {
      top = cursor.y + 16;
    }
    top = Math.max(pad, Math.min(top, Math.max(pad, containerHeight - tipH - pad)));

    setPos({ left, top });
  }, [mark, cursor, containerWidth, containerHeight]);

  if (!mark || !cursor) return null;

  const label = mark.time ? `${mark.time} — ${mark.text}` : mark.text;

  return (
    <div
      ref={tooltipRef}
      style={{
        left: pos ? `${pos.left}px` : `${cursor.x + 14}px`,
        top: pos ? `${pos.top}px` : `${cursor.y + 14}px`,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="absolute z-40 pointer-events-none max-w-[min(320px,calc(100%-16px))] px-2.5 py-1.5 rounded-lg bg-[#09090b]/95 border border-white/15 shadow-xl backdrop-blur-sm text-xs font-mono leading-snug text-zinc-100"
    >
      {mark.time ? (
        <span>
          <span className="text-zinc-400 tabular-nums">{mark.time}</span>
          <span className="text-zinc-500"> — </span>
          <span>{mark.text}</span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </div>
  );
};

// ---------- Savings Banner Above the Map ----------

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

interface HeatmapSavingsBannerProps {
  savings?: HeatmapSavings | null;
  language?: 'ru' | 'en';
  variant?: 'dark' | 'adaptive';
}

export const HeatmapSavingsBanner: React.FC<HeatmapSavingsBannerProps> = ({
  savings,
  language = 'ru',
  variant = 'dark',
}) => {
  if (!savings || (savings.total_s <= 0 && savings.detours <= 0)) return null;

  const isRu = language === 'ru';
  const minsStr = (savings.total_s / 60).toFixed(1);
  const campsWord = pluralRu(savings.detours, 'лагерь', 'лагеря', 'лагерей');
  const mobsWord = pluralRu(savings.mobs, 'моб', 'моба', 'мобов');

  const isDarkOnly = variant === 'dark';

  return (
    <div
      className={`w-full flex items-center justify-center ${isDarkOnly ? '' : ''}`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono leading-snug ${
          isDarkOnly
            ? 'bg-lime-400/[0.08] border-lime-400/25 text-zinc-200'
            : 'bg-lime-500/[0.08] dark:bg-lime-400/[0.08] border-lime-600/25 dark:border-lime-400/25 text-zinc-800 dark:text-zinc-200'
        }`}
      >
        <Route
          className={`w-3.5 h-3.5 shrink-0 ${
            isDarkOnly ? 'text-lime-300' : 'text-lime-700 dark:text-lime-300'
          }`}
        />
        {isRu ? (
          <span>
            Бот сэкономил{' '}
            <strong
              className={`font-semibold tabular-nums ${
                isDarkOnly ? 'text-lime-300' : 'text-lime-800 dark:text-lime-300'
              }`}
            >
              ~{minsStr} мин
            </strong>{' '}
            — обошёл{' '}
            <span className="tabular-nums font-medium">
              {savings.detours} {campsWord}
            </span>{' '}
            вместо драки (
            <span className="tabular-nums">
              {savings.mobs} {mobsWord}
            </span>
            )
          </span>
        ) : (
          <span>
            Bot saved{' '}
            <strong
              className={`font-semibold tabular-nums ${
                isDarkOnly ? 'text-lime-300' : 'text-lime-800 dark:text-lime-300'
              }`}
            >
              ~{minsStr} min
            </strong>{' '}
            — bypassed{' '}
            <span className="tabular-nums font-medium">
              {savings.detours} {savings.detours === 1 ? 'camp' : 'camps'}
            </span>{' '}
            instead of fighting (
            <span className="tabular-nums">
              {savings.mobs} {savings.mobs === 1 ? 'mob' : 'mobs'}
            </span>
            )
          </span>
        )}
      </div>
    </div>
  );
};

// ---------- Interactive Timeline Scrubber Bar ----------

interface HeatmapTimelineBarProps {
  timeline: HeatmapTimeline;
  marks?: HeatmapMark[] | null;
  currentT: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  language?: 'ru' | 'en';
  variant?: 'dark' | 'adaptive';
  compact?: boolean;
}

export const HeatmapTimelineBar: React.FC<HeatmapTimelineBarProps> = ({
  timeline,
  marks,
  currentT,
  isPlaying,
  onTogglePlay,
  onSeek,
  language = 'ru',
  variant = 'dark',
  compact = false,
}) => {
  const isRu = language === 'ru';
  const isDarkOnly = variant === 'dark';
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingTrackRef = useRef<boolean>(false);

  const endS = Math.max(1, timeline.end_s);
  const progress = Math.max(0, Math.min(1, currentT / endS));
  const progressPct = progress * 100;
  const thumbColor = interpolatePathColor(progress);

  const currentClock = formatClockTime(timeline.start, currentT);
  const endClock = formatClockTime(timeline.start, timeline.end_s);

  // Extract event ticks (ok yellow, fight red, detour purple) with valid mark.t
  const eventTicks = useMemo(() => {
    if (!marks || marks.length === 0) return [];
    const list: Array<{ t: number; pct: number; color: string; title: string; kind: HeatmapMark['kind']; key: string }> = [];
    marks.forEach((m, idx) => {
      if (typeof m.t !== 'number') return;
      if (m.kind !== 'ok' && m.kind !== 'fight' && m.kind !== 'detour') return;
      const pct = Math.max(0, Math.min(100, (m.t / endS) * 100));
      const color =
        m.kind === 'ok'
          ? '#FFD100'
          : m.kind === 'fight'
          ? '#E24B4A'
          : '#7F77DD';
      const clock = m.time || formatClockTime(timeline.start, m.t);
      list.push({
        t: m.t,
        pct,
        color,
        title: `${clock} — ${m.text}`,
        kind: m.kind,
        key: `${m.kind}-${idx}`,
      });
    });
    return list;
  }, [marks, endS, timeline.start]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      onSeek(ratio * timeline.end_s);
    },
    [onSeek, timeline.end_s]
  );

  const handleTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    draggingTrackRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handleTrackPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTrackRef.current) return;
    e.stopPropagation();
    seekFromClientX(e.clientX);
  };

  const handleTrackPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTrackRef.current) return;
    draggingTrackRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      className={`w-full ${isDarkOnly ? 'max-w-2xl mx-auto' : ''} flex items-center gap-2.5 sm:gap-3 font-mono select-none`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play / Pause Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        className={`${compact ? 'w-7 h-7' : 'w-8 h-8'} rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
          isDarkOnly
            ? 'bg-white/[0.06] hover:bg-white/[0.12] border-white/15 text-white'
            : 'bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.1] dark:hover:bg-white/[0.13] border-black/15 dark:border-white/15 text-zinc-900 dark:text-white'
        }`}
        title={isPlaying ? (isRu ? 'Пауза' : 'Pause') : (isRu ? 'Воспроизвести маршрут' : 'Play route replay')}
        aria-label={isPlaying ? (isRu ? 'Пауза' : 'Pause') : (isRu ? 'Воспроизвести' : 'Play')}
      >
        {isPlaying ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" />
        )}
      </button>

      {/* Current Clock Time */}
      <span
        className={`${compact ? 'text-[11px] min-w-[54px]' : 'text-xs min-w-[60px]'} font-semibold tabular-nums shrink-0 ${
          isDarkOnly ? 'text-zinc-100' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {currentClock}
      </span>

      {/* Interactive Scrubber Track with Event Ticks */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={isRu ? 'Шкала времени маршрута' : 'Route timeline'}
        aria-valuemin={0}
        aria-valuemax={Math.round(timeline.end_s)}
        aria-valuenow={Math.round(currentT)}
        aria-valuetext={currentClock}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handleTrackPointerMove}
        onPointerUp={handleTrackPointerUp}
        onPointerCancel={handleTrackPointerUp}
        onKeyDown={(e) => {
          const step = Math.max(5, timeline.end_s * 0.03);
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            onSeek(currentT - step);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            onSeek(currentT + step);
          }
        }}
        className="relative flex-1 h-7 flex items-center cursor-pointer touch-none group"
      >
        {/* Rail background */}
        <div
          className={`relative w-full h-1.5 rounded-full overflow-hidden ${
            isDarkOnly ? 'bg-white/[0.1]' : 'bg-black/[0.1] dark:bg-white/[0.1]'
          }`}
        >
          {/* Full gradient bar clipped to current progress */}
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #34D399 0%, #38BDF8 35%, #818CF8 70%, #F43F5E 100%)',
              backgroundSize: progressPct > 0.5 ? `${(100 / progressPct) * 100}% 100%` : '100% 100%',
            }}
          />
        </div>

        {/* Clickable Event Ticks along the scrubber rail */}
        {eventTicks.map((tick) => {
          const reached = tick.t <= currentT + 0.05;
          return (
            <button
              key={tick.key}
              type="button"
              title={tick.title}
              aria-label={tick.title}
              onPointerDown={(e) => {
                e.stopPropagation();
                soundFx.playClick();
                onSeek(tick.t);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ left: `${tick.pct}%` }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-5 flex items-center justify-center cursor-pointer z-10 group/tick"
            >
              <span
                style={{
                  backgroundColor: tick.color,
                  opacity: reached ? 1 : 0.45,
                }}
                className={`block rounded-full transition-transform duration-150 group-hover/tick:scale-150 ${
                  tick.kind === 'fight' ? 'w-1.5 h-2.5' : 'w-1.5 h-1.5'
                } ring-1 ring-black/60`}
              />
            </button>
          );
        })}

        {/* Scrubber Thumb */}
        <div
          style={{ left: `${progressPct}%` }}
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-md ring-2 ring-black/60 pointer-events-none z-20 flex items-center justify-center transition-transform duration-100 group-hover:scale-110"
        >
          <span
            style={{ backgroundColor: thumbColor }}
            className="w-1.5 h-1.5 rounded-full"
          />
        </div>
      </div>

      {/* End Clock Time */}
      <span
        className={`${compact ? 'text-[11px] min-w-[54px]' : 'text-xs min-w-[60px]'} tabular-nums text-right shrink-0 ${
          isDarkOnly ? 'text-zinc-500' : 'text-zinc-500 dark:text-zinc-500'
        }`}
      >
        {endClock}
      </span>
    </div>
  );
};

// ---------- Layer Toggle Buttons & Summary Stats ----------

interface LayerButtonSpec {
  key: HeatmapLayerKey;
  labelRu: string;
  labelEn: string;
  count: number;
}

const LayerMiniSymbol: React.FC<{ layerKey: HeatmapLayerKey }> = ({ layerKey }) => {
  switch (layerKey) {
    case 'ok':
      return (
        <svg width="13" height="13" viewBox="-7 -7 14 14" className="shrink-0" aria-hidden="true">
          <circle r="4.2" fill="#FFD100" stroke="#3A2A00" strokeWidth="1.6" />
        </svg>
      );
    case 'fight':
      return (
        <svg width="14" height="14" viewBox="-8 -8 16 16" className="shrink-0" aria-hidden="true">
          <g stroke="#18181b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="#18181b">
            <polygon points="6.2,-6.2 2.8,-5.5 -1.6,-1.1 1.1,1.6 5.5,-2.8" />
            <line x1="-3.6" y1="-1" x2="1" y2="3.6" />
            <line x1="-1.4" y1="1.4" x2="-5" y2="5" />
          </g>
          <g fill="#E24B4A" stroke="#E24B4A" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="6.2,-6.2 2.8,-5.5 -1.6,-1.1 1.1,1.6 5.5,-2.8" strokeWidth="0.5" />
            <line x1="-3.6" y1="-1" x2="1" y2="3.6" strokeWidth="1.8" />
            <line x1="-1.4" y1="1.4" x2="-5" y2="5" strokeWidth="1.7" />
          </g>
        </svg>
      );
    case 'camp':
      return (
        <svg width="14" height="14" viewBox="-7 -7 14 14" className="shrink-0" aria-hidden="true">
          <circle cx="-2.4" cy="-1.6" r="2.2" fill="#E24B4A" stroke="#18181b" strokeWidth="1" />
          <circle cx="2.6" cy="-0.4" r="2.2" fill="#E24B4A" stroke="#18181b" strokeWidth="1" />
          <circle cx="0" cy="2.6" r="2.2" fill="#E24B4A" stroke="#18181b" strokeWidth="1" />
        </svg>
      );
    case 'detour':
      return (
        <svg width="13" height="13" viewBox="-7 -7 14 14" className="shrink-0" aria-hidden="true">
          <circle r="4.2" fill="#7F77DD" stroke="#ffffff" strokeWidth="1.4" />
        </svg>
      );
  }
};

interface HeatmapLayerControlsAndStatsProps {
  marks: HeatmapMark[];
  layers: HeatmapLayersState;
  onToggleLayer: (key: HeatmapLayerKey) => void;
  language?: 'ru' | 'en';
  variant?: 'dark' | 'adaptive';
  compact?: boolean;
}

export const HeatmapLayerControlsAndStats: React.FC<HeatmapLayerControlsAndStatsProps> = ({
  marks,
  layers,
  onToggleLayer,
  language = 'ru',
  variant = 'dark',
  compact = false,
}) => {
  const isRu = language === 'ru';
  const counts = useMemo(() => getHeatmapMarkCounts(marks), [marks]);

  const allButtons: LayerButtonSpec[] = [
    { key: 'ok', labelRu: 'Сбор', labelEn: 'Gather', count: counts.ok },
    { key: 'fight', labelRu: 'Бои', labelEn: 'Fights', count: counts.fight },
    { key: 'camp', labelRu: 'Лагеря', labelEn: 'Camps', count: counts.campsButton },
    { key: 'detour', labelRu: 'Обходы', labelEn: 'Detours', count: counts.detour },
  ];
  const buttons = allButtons.filter((btn) => btn.count > 0);

  const isDarkOnly = variant === 'dark';

  const stats = [
    {
      key: 'ok',
      label: isRu ? 'собрано' : 'gathered',
      value: counts.ok,
    },
    {
      key: 'fight',
      label: isRu ? 'боёв' : 'fights',
      value: counts.fight,
    },
    {
      key: 'detour',
      label: isRu ? 'обходов' : 'detours',
      value: counts.detour,
    },
  ];

  return (
    <div
      className={`w-full flex flex-col ${compact ? 'gap-2' : 'gap-2.5'} font-mono select-none`}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Layer Toggle Buttons */}
      {buttons.length > 0 && (
        <div className={`flex flex-wrap items-center ${isDarkOnly ? 'justify-center' : 'justify-start'} gap-1.5`}>
          {buttons.map((btn) => {
            const active = layers[btn.key];
            const activeCls = isDarkOnly
              ? 'bg-white/[0.08] border-white/20 text-zinc-100 hover:bg-white/[0.12]'
              : 'bg-black/[0.06] dark:bg-white/[0.08] border-black/20 dark:border-white/20 text-zinc-900 dark:text-zinc-100 hover:bg-black/[0.1] dark:hover:bg-white/[0.12]';
            const inactiveCls = isDarkOnly
              ? 'bg-transparent border-white/[0.08] text-zinc-500 opacity-40 hover:opacity-65'
              : 'bg-transparent border-black/10 dark:border-white/[0.08] text-zinc-500 opacity-40 hover:opacity-65';

            return (
              <button
                key={btn.key}
                type="button"
                aria-pressed={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLayer(btn.key);
                }}
                className={`inline-flex items-center gap-1.5 ${
                  compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
                } rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  active ? activeCls : inactiveCls
                }`}
              >
                <LayerMiniSymbol layerKey={btn.key} />
                <span>{isRu ? btn.labelRu : btn.labelEn}</span>
                <span
                  className={`tabular-nums text-[10px] ${
                    isDarkOnly ? 'text-zinc-400' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {btn.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3 Summary Stat Tiles (gather, fights, detours) */}
      <div
        className={`grid grid-cols-3 gap-2 ${
          isDarkOnly ? 'max-w-2xl w-full mx-auto' : 'w-full'
        }`}
      >
        {stats.map((stat) => (
          <div
            key={stat.key}
            className={`rounded-lg border ${
              isDarkOnly
                ? 'bg-white/[0.03] border-white/[0.08]'
                : 'bg-black/[0.025] dark:bg-white/[0.03] border-black/10 dark:border-white/[0.08]'
            } ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'} flex items-baseline justify-between gap-2`}
          >
            <span
              className={`${compact ? 'text-[11px]' : 'text-xs'} truncate ${
                isDarkOnly ? 'text-zinc-400' : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {stat.label}
            </span>
            <span
              className={`${compact ? 'text-sm' : 'text-base'} font-semibold tabular-nums shrink-0 ${
                isDarkOnly ? 'text-white' : 'text-zinc-950 dark:text-white'
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
