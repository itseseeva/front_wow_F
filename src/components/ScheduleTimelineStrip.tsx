import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Shuffle, Moon, AlertTriangle } from 'lucide-react';
import {
  SchedulePreview,
  SchedulePreviewSegment,
  ScheduleDay,
  ScheduleDaySegment,
} from '../types';

type ScheduleTimelineData = SchedulePreview | ScheduleDay;
type AnyTimelineSegment = SchedulePreviewSegment | ScheduleDaySegment;

interface ScheduleTimelineStripProps {
  preview: ScheduleTimelineData | null;
  isLoading?: boolean;
  isDayEnabled: boolean;
  isScheduleEnabled: boolean;
  isRu: boolean;
  onShuffle?: () => void;
  showShuffle?: boolean;
  nowMs?: number | null;
  rightNote?: string | null;
  className?: string;
}

type VisibleKind = 'farm' | 'short_break' | 'long_break' | 'stopped' | 'paused';

interface TimelineRange {
  startMs: number;
  endMs: number;
  spanMs: number;
}

interface NormalizedSegment {
  id: number;
  kind: VisibleKind;
  actual: boolean;
  isBreak: boolean;
  startMs: number;
  endMs: number;
  minutes: number;
  timeRange: string;
  label: string;
  shortLabel: string;
  leftPct: number;
  widthPct: number;
  anchorPct: number;
}

interface AxisTick {
  ms: number;
  pct: number;
  label: string;
  edge: 'start' | 'end' | 'middle';
}

interface PlacedBubble {
  segment: NormalizedSegment;
  anchorPct: number;
  bubblePct: number;
  pointerOffsetPx: number;
}

const DEFAULT_OFF_TICKS = [0, 4, 8, 12, 16, 20, 24];
const MIN_MS = 60 * 1000;

function isVisibleKind(kind: string): kind is VisibleKind {
  return (
    kind === 'farm' ||
    kind === 'short_break' ||
    kind === 'long_break' ||
    kind === 'stopped' ||
    kind === 'paused'
  );
}

function hasNowMs(data: ScheduleTimelineData | null): data is ScheduleDay {
  return data !== null && 'now_ms' in data && typeof data.now_ms === 'number';
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function formatDuration(minutes: number, isRu: boolean): string {
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) {
    return isRu ? `${m}м` : `${m}m`;
  }
  if (m === 0) {
    return isRu ? `${h}ч` : `${h}h`;
  }
  return isRu ? `${h}ч ${m}м` : `${h}h ${m}m`;
}

function formatSessionsCount(count: number, isRu: boolean): string {
  if (!isRu) {
    return count === 1 ? '1 session' : `${count} sessions`;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} сессия`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} сессии`;
  return `${count} сессий`;
}

function formatBreaksCount(count: number, isRu: boolean): string {
  if (!isRu) {
    return count === 1 ? '1 break' : `${count} breaks`;
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} перерыв`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} перерыва`;
  return `${count} перерывов`;
}

function floorToLocalMinutes(ms: number, stepMin: number): number {
  const d = new Date(ms);
  const totalMin = d.getHours() * 60 + d.getMinutes();
  const flooredMin = Math.floor(totalMin / stepMin) * stepMin;
  d.setHours(0, 0, 0, 0);
  return d.getTime() + flooredMin * MIN_MS;
}

function ceilToLocalMinutes(ms: number, stepMin: number): number {
  const d = new Date(ms);
  const totalMin =
    d.getHours() * 60 +
    d.getMinutes() +
    (d.getSeconds() > 0 || d.getMilliseconds() > 0 ? 1 : 0);
  const ceiledMin = Math.ceil(totalMin / stepMin) * stepMin;
  d.setHours(0, 0, 0, 0);
  return d.getTime() + ceiledMin * MIN_MS;
}

function computeTimelineRange(
  visibleSegments: AnyTimelineSegment[],
  nowMarkerMs: number | null
): TimelineRange | null {
  if (visibleSegments.length === 0) return null;

  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const seg of visibleSegments) {
    if (seg.start_ms < minMs) minMs = seg.start_ms;
    if (seg.end_ms > maxMs) maxMs = seg.end_ms;
  }

  // Keep the "now" marker inside bounds if it sits just next to active segments
  if (nowMarkerMs !== null && Number.isFinite(minMs) && Number.isFinite(maxMs)) {
    if (nowMarkerMs < minMs && minMs - nowMarkerMs <= 60 * MIN_MS) {
      minMs = nowMarkerMs;
    }
    if (nowMarkerMs > maxMs && nowMarkerMs - maxMs <= 60 * MIN_MS) {
      maxMs = nowMarkerMs;
    }
  }

  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs) || maxMs <= minMs) {
    return null;
  }

  const rawSpanMin = (maxMs - minMs) / MIN_MS;
  const snapStepMin = rawSpanMin <= 90 ? 5 : rawSpanMin <= 360 ? 15 : 30;
  let startMs = floorToLocalMinutes(minMs, snapStepMin);
  let endMs = ceilToLocalMinutes(maxMs, snapStepMin);

  if (endMs - startMs < 30 * MIN_MS) {
    endMs = startMs + 30 * MIN_MS;
  }

  return {
    startMs,
    endMs,
    spanMs: endMs - startMs,
  };
}

function buildAxisTicks(range: TimelineRange, containerWidth: number): AxisTick[] {
  const safeWidth = Math.max(containerWidth, 280);
  const spanMin = range.spanMs / MIN_MS;

  const candidateSteps = [15, 30, 60, 120, 180, 240];
  let stepMin = 60;
  for (const step of candidateSteps) {
    if (spanMin / step <= 6.5) {
      stepMin = step;
      break;
    }
    stepMin = step;
  }

  const minGapPx = 56;
  const ticks: AxisTick[] = [
    { ms: range.startMs, pct: 0, label: formatClock(range.startMs), edge: 'start' },
  ];

  let cursorMs = ceilToLocalMinutes(range.startMs + 1, stepMin);
  let lastPx = 0;

  while (cursorMs < range.endMs) {
    const pct = ((cursorMs - range.startMs) / range.spanMs) * 100;
    const px = (pct / 100) * safeWidth;
    if (px - lastPx >= minGapPx && safeWidth - px >= minGapPx) {
      ticks.push({
        ms: cursorMs,
        pct,
        label: formatClock(cursorMs),
        edge: 'middle',
      });
      lastPx = px;
    }
    cursorMs += stepMin * MIN_MS;
  }

  ticks.push({
    ms: range.endMs,
    pct: 100,
    label: formatClock(range.endMs),
    edge: 'end',
  });

  return ticks;
}

function normalizeSegments(
  segments: AnyTimelineSegment[],
  range: TimelineRange | null,
  isRu: boolean
): NormalizedSegment[] {
  if (!range || range.spanMs <= 0) return [];
  const result: NormalizedSegment[] = [];

  segments.forEach((seg, idx) => {
    if (!isVisibleKind(seg.kind)) {
      return;
    }

    const rawDuration = Math.round((seg.end_ms - seg.start_ms) / MIN_MS);
    const durMin = Math.max(1, seg.minutes || rawDuration);
    const clampedStart = Math.max(range.startMs, Math.min(range.endMs, seg.start_ms));
    const clampedEnd = Math.max(clampedStart, Math.min(range.endMs, seg.end_ms));

    const leftPct = ((clampedStart - range.startMs) / range.spanMs) * 100;
    const widthPct = Math.max(0.4, ((clampedEnd - clampedStart) / range.spanMs) * 100);
    const anchorPct = Math.min(100, leftPct + widthPct / 2);

    const actual = 'actual' in seg && typeof seg.actual === 'boolean' ? seg.actual : true;
    const isBreak = seg.kind === 'short_break' || seg.kind === 'long_break';

    let label = isRu ? 'Сессия' : 'Session';
    let shortLabel = isRu ? 'Сессия' : 'Session';
    if (seg.kind === 'long_break') {
      label = isRu ? 'Длинный перерыв' : 'Long break';
      shortLabel = isRu ? 'Перерыв' : 'Break';
    } else if (seg.kind === 'short_break') {
      label = isRu ? 'Перерыв' : 'Short break';
      shortLabel = isRu ? 'Перерыв' : 'Break';
    } else if (seg.kind === 'stopped') {
      label = isRu ? 'Остановлено' : 'Stopped';
      shortLabel = isRu ? 'Остановлено' : 'Stopped';
    } else if (seg.kind === 'paused') {
      label = isRu ? 'Пауза' : 'Paused';
      shortLabel = isRu ? 'Пауза' : 'Paused';
    }

    result.push({
      id: idx,
      kind: seg.kind,
      actual,
      isBreak,
      startMs: seg.start_ms,
      endMs: seg.end_ms,
      minutes: durMin,
      timeRange: `${formatClock(seg.start_ms)}–${formatClock(seg.end_ms)}`,
      label,
      shortLabel,
      leftPct,
      widthPct,
      anchorPct,
    });
  });

  return result;
}

function clampBubblePosition(
  anchorPct: number,
  containerWidth: number,
  bubbleWidthPx: number
): { bubblePct: number; pointerOffsetPx: number } {
  const safeWidth = Math.max(containerWidth, 280);
  const halfBubblePct = ((bubbleWidthPx / 2 + 4) / safeWidth) * 100;
  const minPct = Math.min(48, halfBubblePct);
  const maxPct = Math.max(52, 100 - halfBubblePct);
  const bubblePct = Math.max(minPct, Math.min(maxPct, anchorPct));
  const rawOffsetPx = ((anchorPct - bubblePct) / 100) * safeWidth;
  const maxPointerOffset = Math.max(8, bubbleWidthPx / 2 - 14);
  const pointerOffsetPx = Math.max(-maxPointerOffset, Math.min(maxPointerOffset, rawOffsetPx));
  return { bubblePct, pointerOffsetPx };
}

function selectStaticBubbles(
  segments: NormalizedSegment[],
  containerWidth: number
): PlacedBubble[] {
  if (segments.length === 0) return [];

  const safeWidth = Math.max(containerWidth, 300);
  const hasPlannedOrSpecial = segments.some(
    (s) => !s.actual || s.kind === 'stopped' || s.kind === 'paused'
  );
  const bubbleWidthPx = hasPlannedOrSpecial ? 116 : 104;
  const minGapPx = hasPlannedOrSpecial ? 124 : 112;
  const minGapPct = (minGapPx / safeWidth) * 100;
  const maxNudgePct = (24 / safeWidth) * 100;

  const farmSegments = segments.filter((s) => s.kind === 'farm').sort((a, b) => b.minutes - a.minutes);
  const longBreaks = segments.filter((s) => s.kind === 'long_break').sort((a, b) => b.minutes - a.minutes);
  const shortBreaks = segments.filter((s) => s.kind === 'short_break').sort((a, b) => b.minutes - a.minutes);
  const stoppedSegments = segments.filter((s) => s.kind === 'stopped').sort((a, b) => b.minutes - a.minutes);
  const pausedSegments = segments.filter((s) => s.kind === 'paused').sort((a, b) => b.minutes - a.minutes);

  const orderedCandidates: NormalizedSegment[] = [];
  if (farmSegments[0]) orderedCandidates.push(farmSegments[0]);
  if (stoppedSegments[0]) orderedCandidates.push(stoppedSegments[0]);
  if (pausedSegments[0]) orderedCandidates.push(pausedSegments[0]);
  if (longBreaks[0]) {
    orderedCandidates.push(longBreaks[0]);
  } else if (shortBreaks[0]) {
    orderedCandidates.push(shortBreaks[0]);
  }

  const rest = segments
    .filter((s) => !orderedCandidates.some((c) => c.id === s.id))
    .sort((a, b) => {
      const bonus = (seg: NormalizedSegment) => {
        if (seg.kind === 'stopped') return 26;
        if (seg.kind === 'paused') return 24;
        if (seg.kind === 'long_break') return 20;
        if (seg.kind === 'farm') return 12;
        return 0;
      };
      return b.minutes + bonus(b) - (a.minutes + bonus(a));
    });
  orderedCandidates.push(...rest);

  const placed: PlacedBubble[] = [];

  for (const seg of orderedCandidates) {
    const basePos = clampBubblePosition(seg.anchorPct, safeWidth, bubbleWidthPx);
    let candidatePct = basePos.bubblePct;

    let fits = true;
    const conflicting = placed.filter((p) => Math.abs(p.bubblePct - candidatePct) < minGapPct);

    if (conflicting.length === 1) {
      const other = conflicting[0];
      const pushDir = candidatePct >= other.bubblePct ? 1 : -1;
      const neededPct = other.bubblePct + pushDir * minGapPct;
      const halfBubblePct = ((bubbleWidthPx / 2 + 4) / safeWidth) * 100;
      const clampedNeeded = Math.max(halfBubblePct, Math.min(100 - halfBubblePct, neededPct));
      const nudgeDelta = Math.abs(clampedNeeded - basePos.bubblePct);

      if (
        nudgeDelta <= maxNudgePct &&
        placed.every((p) => Math.abs(p.bubblePct - clampedNeeded) >= minGapPct - 0.1)
      ) {
        candidatePct = clampedNeeded;
      } else {
        fits = false;
      }
    } else if (conflicting.length > 1) {
      fits = false;
    }

    if (fits) {
      const rawOffsetPx = ((seg.anchorPct - candidatePct) / 100) * safeWidth;
      const maxPointerOffset = Math.max(8, bubbleWidthPx / 2 - 14);
      const pointerOffsetPx = Math.max(-maxPointerOffset, Math.min(maxPointerOffset, rawOffsetPx));
      placed.push({
        segment: seg,
        anchorPct: seg.anchorPct,
        bubblePct: candidatePct,
        pointerOffsetPx,
      });
    }
  }

  return placed.sort((a, b) => a.bubblePct - b.bubblePct);
}

function getSegmentBarClasses(seg: NormalizedSegment): string {
  if (!seg.actual) {
    // Planned segment: same hue, dimmed (~0.45 opacity) with subtle diagonal hatching
    switch (seg.kind) {
      case 'farm':
        return 'bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.95)_0px,rgba(255,255,255,0.95)_3px,rgba(255,255,255,0.3)_3px,rgba(255,255,255,0.3)_6px)] opacity-45';
      case 'long_break':
      case 'short_break':
        return 'bg-[repeating-linear-gradient(-45deg,rgba(161,161,170,0.95)_0px,rgba(161,161,170,0.95)_3px,rgba(113,113,122,0.35)_3px,rgba(113,113,122,0.35)_6px)] opacity-45 ring-1 ring-black/80';
      case 'stopped':
        return 'bg-[repeating-linear-gradient(-45deg,rgba(190,18,60,0.9)_0px,rgba(190,18,60,0.9)_3px,rgba(136,19,55,0.35)_3px,rgba(136,19,55,0.35)_6px)] opacity-45 ring-1 ring-black/80';
      case 'paused':
        return 'bg-[repeating-linear-gradient(-45deg,rgba(245,158,11,0.95)_0px,rgba(245,158,11,0.95)_3px,rgba(180,83,9,0.35)_3px,rgba(180,83,9,0.35)_6px)] opacity-45 ring-1 ring-black/80';
    }
  }

  // Actual (completed or currently running) solid segment
  switch (seg.kind) {
    case 'farm':
      return 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]';
    case 'long_break':
      return 'bg-zinc-500 ring-1 ring-black/80';
    case 'short_break':
      return 'bg-zinc-600 ring-1 ring-black/80';
    case 'stopped':
      return 'bg-rose-800 ring-1 ring-black/80';
    case 'paused':
      return 'bg-amber-500 ring-1 ring-black/80';
  }
}

function getBubbleTheme(seg: NormalizedSegment): {
  card: string;
  title: string;
  planTag: string;
  time: string;
  pointer: string;
} {
  const planOpacity = seg.actual ? '' : 'opacity-75';

  switch (seg.kind) {
    case 'farm':
      return {
        card: `bg-white text-black shadow-[0_6px_22px_rgba(255,255,255,0.22)] ${planOpacity}`,
        title: 'text-zinc-800',
        planTag: 'text-zinc-500',
        time: 'text-black',
        pointer: 'bg-white',
      };
    case 'long_break':
    case 'short_break':
      return {
        card: `bg-zinc-800/95 border border-zinc-600/80 text-zinc-300 shadow-[0_6px_16px_rgba(0,0,0,0.65)] ${planOpacity}`,
        title: 'text-zinc-300',
        planTag: 'text-zinc-500',
        time: 'text-zinc-400',
        pointer: 'bg-zinc-800 border-r border-b border-zinc-600/80',
      };
    case 'stopped':
      return {
        card: `bg-rose-950/95 border border-rose-700/70 text-rose-200 shadow-[0_6px_16px_rgba(0,0,0,0.65)] ${planOpacity}`,
        title: 'text-rose-200',
        planTag: 'text-rose-400/80',
        time: 'text-rose-300/85',
        pointer: 'bg-rose-950 border-r border-b border-rose-700/70',
      };
    case 'paused':
      return {
        card: `bg-amber-950/95 border border-amber-500/60 text-amber-200 shadow-[0_6px_16px_rgba(0,0,0,0.65)] ${planOpacity}`,
        title: 'text-amber-200',
        planTag: 'text-amber-400/80',
        time: 'text-amber-300/90',
        pointer: 'bg-amber-950 border-r border-b border-amber-500/60',
      };
  }
}

export const ScheduleTimelineStrip: React.FC<ScheduleTimelineStripProps> = ({
  preview,
  isLoading = false,
  isDayEnabled,
  isScheduleEnabled,
  isRu,
  onShuffle,
  showShuffle = true,
  nowMs = null,
  rightNote = null,
  className = 'border-t border-white/10 pt-4 mt-4',
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(720);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const updateWidth = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setContainerWidth(w);
    };
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateWidth);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const effectiveNowMs = useMemo(() => {
    if (hasNowMs(preview)) return preview.now_ms;
    return nowMs;
  }, [preview, nowMs]);

  const rawVisibleSegments = useMemo(() => {
    if (!preview || !preview.ok || preview.off) return [];
    return (preview.segments || []).filter((seg) => isVisibleKind(seg.kind));
  }, [preview]);

  const timelineRange = useMemo(
    () => computeTimelineRange(rawVisibleSegments, effectiveNowMs),
    [rawVisibleSegments, effectiveNowMs]
  );

  const segments = useMemo(
    () =>
      preview && preview.ok && !preview.off
        ? normalizeSegments(preview.segments || [], timelineRange, isRu)
        : [],
    [preview, timelineRange, isRu]
  );

  const axisTicks = useMemo(
    () => (timelineRange ? buildAxisTicks(timelineRange, containerWidth) : null),
    [timelineRange, containerWidth]
  );

  const staticBubbles = useMemo(
    () => selectStaticBubbles(segments, containerWidth),
    [segments, containerWidth]
  );

  // Strictly use backend-provided sessions & farm_s (pause does not split session count)
  const sessionsCount = useMemo(() => {
    if (preview && typeof preview.sessions === 'number') return preview.sessions;
    return segments.filter((s) => s.kind === 'farm').length;
  }, [preview, segments]);

  const totalFarmMinutes = useMemo(() => {
    if (preview && typeof preview.farm_s === 'number') {
      return Math.round(preview.farm_s / 60);
    }
    return segments.filter((s) => s.kind === 'farm').reduce((sum, s) => sum + s.minutes, 0);
  }, [preview, segments]);

  const breakCount = useMemo(() => segments.filter((s) => s.isBreak).length, [segments]);
  const totalBreakMinutes = useMemo(
    () => segments.filter((s) => s.isBreak).reduce((sum, s) => sum + s.minutes, 0),
    [segments]
  );

  const hasPaused = useMemo(() => segments.some((s) => s.kind === 'paused'), [segments]);
  const hasStopped = useMemo(() => segments.some((s) => s.kind === 'stopped'), [segments]);
  const hasPlanned = useMemo(() => segments.some((s) => !s.actual), [segments]);

  const isOffState = !isScheduleEnabled || !isDayEnabled || preview?.off === true;
  const hasError = preview !== null && preview.ok === false && Boolean(preview.error);

  const nowPct = useMemo(() => {
    if (effectiveNowMs == null || !timelineRange || timelineRange.spanMs <= 0) return null;
    if (effectiveNowMs < timelineRange.startMs || effectiveNowMs > timelineRange.endMs) return null;
    return ((effectiveNowMs - timelineRange.startMs) / timelineRange.spanMs) * 100;
  }, [effectiveNowMs, timelineRange]);

  return (
    <div className={`${className} flex flex-col gap-3`}>
      {/* Top summary row + legend + shuffle/note */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono tabular-nums">
          {isOffState ? (
            <span className="text-zinc-500 flex items-center gap-1.5">
              <Moon className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                {!isScheduleEnabled
                  ? isRu
                    ? 'Расписание выключено'
                    : 'Schedule disabled'
                  : isRu
                  ? 'Выходной день'
                  : 'Day off'}
              </span>
            </span>
          ) : hasError ? (
            <span className="text-zinc-400 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-zinc-400" />
              <span>{preview?.error}</span>
            </span>
          ) : preview ? (
            <>
              <span className="text-zinc-200 font-semibold">
                {formatSessionsCount(sessionsCount, isRu)} · ~{formatDuration(totalFarmMinutes, isRu)}
              </span>
              {breakCount > 0 && (
                <span className="text-zinc-500">
                  {formatBreaksCount(breakCount, isRu)} · {formatDuration(totalBreakMinutes, isRu)}
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">
              {isRu ? 'Расчёт примера дня...' : 'Generating day preview...'}
            </span>
          )}

          {!isOffState && !hasError && (
            <div className="flex flex-wrap items-center gap-3 pl-1 text-[10px] font-mono">
              <span className="inline-flex items-center gap-1.5 text-zinc-300">
                <span className="w-3.5 h-[4px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.75)]" />
                <span>{isRu ? 'Сессия' : 'Session'}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-zinc-500">
                <span className="w-3.5 h-[4px] rounded-full bg-zinc-500" />
                <span>{isRu ? 'Перерыв' : 'Break'}</span>
              </span>
              {hasPaused && (
                <span className="inline-flex items-center gap-1.5 text-amber-400/90">
                  <span className="w-3.5 h-[4px] rounded-full bg-amber-500" />
                  <span>{isRu ? 'Пауза' : 'Paused'}</span>
                </span>
              )}
              {hasStopped && (
                <span className="inline-flex items-center gap-1.5 text-rose-400/90">
                  <span className="w-3.5 h-[4px] rounded-full bg-rose-800" />
                  <span>{isRu ? 'Остановлено' : 'Stopped'}</span>
                </span>
              )}
              {hasPlanned && (
                <span className="inline-flex items-center gap-1.5 text-zinc-500">
                  <span className="w-3.5 h-[4px] rounded-full bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.95)_0px,rgba(255,255,255,0.95)_2px,rgba(255,255,255,0.25)_2px,rgba(255,255,255,0.25)_4px)] opacity-45" />
                  <span>{isRu ? 'План' : 'Plan'}</span>
                </span>
              )}
            </div>
          )}
        </div>

        {showShuffle && onShuffle ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShuffle();
            }}
            disabled={isOffState}
            title={isRu ? 'Сгенерировать другой случайный пример дня' : 'Generate another random day sample'}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono whitespace-nowrap shrink-0 transition-all ${
              isOffState
                ? 'border-white/5 text-zinc-600 cursor-not-allowed'
                : 'border-white/15 bg-black text-zinc-300 hover:text-white hover:border-white/40 cursor-pointer active:scale-[0.98]'
            }`}
          >
            <Shuffle className="w-3 h-3" />
            <span>{isRu ? 'Другой пример' : 'Shuffle'}</span>
          </button>
        ) : rightNote ? (
          <span className="text-[11px] font-mono text-zinc-500 truncate max-w-xs">
            {rightNote}
          </span>
        ) : null}
      </div>

      {/* Active-range visual timeline */}
      <div
        ref={trackRef}
        className={`relative w-full pt-[68px] pb-1 transition-opacity duration-200 ${
          isLoading ? 'opacity-65' : 'opacity-100'
        }`}
      >
        {/* Callouts layer (above the horizontal baseline) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[62px]">
          {!isOffState &&
            !hasError &&
            staticBubbles.map((item) => {
              const { segment, bubblePct, pointerOffsetPx } = item;
              const theme = getBubbleTheme(segment);

              return (
                <div
                  key={`static-${segment.id}`}
                  style={{ left: `${bubblePct}%` }}
                  className="absolute bottom-2 -translate-x-1/2"
                >
                  <div
                    className={`relative rounded-xl px-2.5 py-1.5 text-center whitespace-nowrap select-none ${theme.card}`}
                  >
                    <div className={`text-[10px] leading-tight font-medium ${theme.title}`}>
                      <span>{segment.shortLabel}</span>
                      {!segment.actual && (
                        <span className={`ml-1 font-normal ${theme.planTag}`}>
                          · {isRu ? 'план' : 'plan'}
                        </span>
                      )}
                    </div>
                    <div
                      className={`text-[11px] leading-tight font-mono font-semibold tabular-nums mt-0.5 ${theme.time}`}
                    >
                      {segment.timeRange}
                    </div>
                    <span
                      style={{ transform: `translateX(calc(-50% + ${pointerOffsetPx}px)) rotate(45deg)` }}
                      className={`absolute left-1/2 -bottom-[4.5px] w-2.5 h-2.5 ${theme.pointer}`}
                    />
                  </div>
                </div>
              );
            })}

          {/* Subtle centered label for day-off state */}
          {isOffState && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center">
              <span className="px-3 py-1 rounded-lg bg-zinc-900/90 border border-white/10 text-[11px] font-mono text-zinc-500">
                {!isScheduleEnabled
                  ? isRu
                    ? 'Бот работает без ограничений расписания'
                    : 'Schedule is turned off'
                  : isRu
                  ? 'Выходной день — бот не запускается'
                  : 'Day off — bot stays idle'}
              </span>
            </div>
          )}
        </div>

        {/* Horizontal baseline + segments */}
        <div className="relative h-6 flex items-center pointer-events-none">
          <div
            className={`w-full h-[1.5px] rounded-full ${
              isOffState ? 'bg-white/15' : 'bg-white/40'
            }`}
          />

          {!preview && !isOffState && (
            <div className="absolute inset-y-0 inset-x-0 flex items-center">
              <div className="w-1/3 h-[6px] rounded-full bg-white/15 animate-pulse ml-[33%]" />
            </div>
          )}

          {!isOffState &&
            !hasError &&
            segments.map((seg) => (
              <div
                key={seg.id}
                style={{
                  left: `${seg.leftPct}%`,
                  width: `${seg.widthPct}%`,
                  minWidth: seg.kind === 'farm' ? '10px' : '8px',
                }}
                className={`absolute top-1/2 -translate-y-1/2 h-6 flex items-center justify-center ${
                  seg.kind === 'farm' ? 'z-10' : 'z-20'
                }`}
              >
                <span className={`w-full h-[6px] rounded-full ${getSegmentBarClasses(seg)}`} />
              </div>
            ))}

          {/* Thin vertical "now" marker at now_ms */}
          {!isOffState && !hasError && nowPct !== null && (
            <div
              style={{ left: `${nowPct}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
            >
              <span className="w-[1.5px] h-5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
            </div>
          )}
        </div>

        {/* Dynamic clock ticks covering only the active schedule period */}
        <div className="relative h-5 mt-1 select-none">
          {!isOffState && !hasError && axisTicks
            ? axisTicks.map((tick) => {
                const alignClass =
                  tick.edge === 'start'
                    ? 'left-0 translate-x-0 text-left'
                    : tick.edge === 'end'
                    ? 'right-0 translate-x-0 text-right'
                    : '-translate-x-1/2 text-center';

                return (
                  <span
                    key={`${tick.edge}-${tick.ms}`}
                    style={tick.edge === 'end' ? undefined : { left: `${tick.pct}%` }}
                    className={`absolute top-0 ${alignClass} text-[11px] font-mono tabular-nums text-zinc-500`}
                  >
                    {tick.label}
                  </span>
                );
              })
            : DEFAULT_OFF_TICKS.map((hour) => {
                const pct = (hour / 24) * 100;
                const alignClass =
                  hour === 0
                    ? 'left-0 translate-x-0 text-left'
                    : hour === 24
                    ? 'right-0 translate-x-0 text-right'
                    : '-translate-x-1/2 text-center';

                return (
                  <span
                    key={hour}
                    style={hour === 24 ? undefined : { left: `${pct}%` }}
                    className={`absolute top-0 ${alignClass} text-[11px] font-mono tabular-nums text-zinc-600`}
                  >
                    {hour}:00
                  </span>
                );
              })}
        </div>
      </div>
    </div>
  );
};
