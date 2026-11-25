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

type VisibleKind = 'farm' | 'short_break' | 'long_break' | 'wait_window' | 'stopped' | 'paused';

interface TimelineRange {
  startMs: number;
  endMs: number;
  spanMs: number;
}

interface NormalizedSegment {
  id: number;
  groupId: number;
  kind: VisibleKind;
  actual: boolean;
  isCurrent: boolean;
  progressPct: number; // 0..100 fill of fact portion inside this piece when isCurrent
  isBreak: boolean;
  startMs: number;
  endMs: number;
  minutes: number;
  timeRange: string;
  label: string;
  leftPct: number;
  widthPct: number;
}

interface BubbleGroup {
  groupId: number;
  kind: VisibleKind;
  actual: boolean;
  isCurrent: boolean;
  remainingMs: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  timeRange: string;
  label: string;
  anchorPct: number;
}

interface AxisTick {
  ms: number;
  pct: number;
  label: string;
  edge: 'start' | 'end' | 'middle';
}

interface PlacedBubble {
  group: BubbleGroup;
  anchorPct: number;
  bubblePct: number;
  pointerOffsetPx: number;
}

const DEFAULT_OFF_TICKS = [0, 4, 8, 12, 16, 20, 24];
const MIN_MS = 60 * 1000;
const SIDE_PADDING_PX = 12;
const BUBBLE_WIDTH_PX = 132;
const BUBBLE_GAP_PX = 8;

function isVisibleKind(kind: string): kind is VisibleKind {
  return (
    kind === 'farm' ||
    kind === 'short_break' ||
    kind === 'long_break' ||
    kind === 'wait_window' ||
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

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
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

function getKindLabel(kind: VisibleKind, isRu: boolean): string {
  switch (kind) {
    case 'farm':
      return isRu ? 'Сессия' : 'Session';
    case 'long_break':
      return isRu ? 'Длинный перерыв' : 'Long break';
    case 'short_break':
      return isRu ? 'Перерыв' : 'Break';
    case 'wait_window':
      return isRu ? 'Ожидание' : 'Waiting';
    case 'stopped':
      return isRu ? 'Остановлено' : 'Stopped';
    case 'paused':
      return isRu ? 'Пауза' : 'Paused';
  }
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

function computeTimelineRange(visibleSegments: AnyTimelineSegment[]): TimelineRange | null {
  if (visibleSegments.length === 0) return null;

  let minMs = Infinity;
  let maxMs = -Infinity;
  for (const seg of visibleSegments) {
    if (seg.start_ms < minMs) minMs = seg.start_ms;
    if (seg.end_ms > maxMs) maxMs = seg.end_ms;
  }

  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) {
    return null;
  }

  const startMs = minMs;
  let endMs = maxMs;

  // Guard against zero/near-zero range without rounding edges
  if (endMs - startMs < 2 * MIN_MS) {
    endMs = startMs + 2 * MIN_MS;
  }

  return {
    startMs,
    endMs,
    spanMs: endMs - startMs,
  };
}

function buildAxisTicks(range: TimelineRange, containerWidth: number): AxisTick[] {
  const safeWidth = Math.max(containerWidth, 240);
  const spanMin = range.spanMs / MIN_MS;

  const maxInteriorCount = Math.max(2, Math.floor(safeWidth / 95));
  const candidateSteps = [5, 15, 30, 60, 120, 180, 240];
  let stepMin = candidateSteps[candidateSteps.length - 1];
  for (const step of candidateSteps) {
    if (spanMin / step <= maxInteriorCount + 1) {
      stepMin = step;
      break;
    }
  }

  const minEdgeGapPx = 42;
  const minBetweenGapPx = 48;

  const ticks: AxisTick[] = [
    { ms: range.startMs, pct: 0, label: formatClock(range.startMs), edge: 'start' },
  ];

  let cursorMs = ceilToLocalMinutes(range.startMs + 1, stepMin);
  let lastPx = 0;

  while (cursorMs < range.endMs) {
    const pct = ((cursorMs - range.startMs) / range.spanMs) * 100;
    const px = (pct / 100) * safeWidth;
    const requiredFromPrev = lastPx === 0 ? minEdgeGapPx : minBetweenGapPx;
    if (px - lastPx >= requiredFromPrev && safeWidth - px >= minEdgeGapPx) {
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

function normalizeSegmentsAndGroups(
  rawSegments: AnyTimelineSegment[],
  range: TimelineRange | null,
  effectiveNowMs: number | null,
  isRu: boolean
): { segments: NormalizedSegment[]; groups: BubbleGroup[] } {
  if (!range || range.spanMs <= 0) {
    return { segments: [], groups: [] };
  }

  const segments: NormalizedSegment[] = [];
  const groups: BubbleGroup[] = [];

  // Raw group accumulators to merge contiguous same-kind pieces (end_ms === start_ms) for callouts only
  interface RawGroup {
    groupId: number;
    kind: VisibleKind;
    startMs: number;
    endMs: number;
    allActual: boolean;
  }
  const rawGroups: RawGroup[] = [];

  rawSegments.forEach((seg, idx) => {
    if (!isVisibleKind(seg.kind)) {
      return;
    }

    const rawDurationMin = Math.max(0, (seg.end_ms - seg.start_ms) / MIN_MS);
    const durMin = typeof seg.minutes === 'number' ? seg.minutes : Math.round(rawDurationMin);
    const clampedStart = Math.max(range.startMs, Math.min(range.endMs, seg.start_ms));
    const clampedEnd = Math.max(clampedStart, Math.min(range.endMs, seg.end_ms));

    const leftPct = ((clampedStart - range.startMs) / range.spanMs) * 100;
    const widthPct = Math.max(0.35, ((clampedEnd - clampedStart) / range.spanMs) * 100);

    const rawActual = 'actual' in seg && typeof seg.actual === 'boolean' ? seg.actual : true;

    let actual = rawActual;
    let isCurrent = false;
    let progressPct = rawActual ? 100 : 0;

    if (effectiveNowMs !== null) {
      if (seg.start_ms < effectiveNowMs && effectiveNowMs < seg.end_ms) {
        isCurrent = true;
        actual = true;
        const segSpanMs = Math.max(1, seg.end_ms - seg.start_ms);
        progressPct = Math.max(0, Math.min(100, ((effectiveNowMs - seg.start_ms) / segSpanMs) * 100));
      } else if (!rawActual && seg.end_ms <= effectiveNowMs) {
        actual = true;
        progressPct = 100;
      }
    }

    // Merge contiguous same-kind pieces (end_ms == start_ms) into one BubbleGroup
    const prevGroup = rawGroups[rawGroups.length - 1];
    let groupId: number;
    if (prevGroup && prevGroup.kind === seg.kind && prevGroup.endMs === seg.start_ms) {
      prevGroup.endMs = Math.max(prevGroup.endMs, seg.end_ms);
      prevGroup.allActual = prevGroup.allActual && actual;
      groupId = prevGroup.groupId;
    } else {
      groupId = rawGroups.length;
      rawGroups.push({
        groupId,
        kind: seg.kind,
        startMs: seg.start_ms,
        endMs: seg.end_ms,
        allActual: actual,
      });
    }

    const label = getKindLabel(seg.kind, isRu);

    segments.push({
      id: idx,
      groupId,
      kind: seg.kind,
      actual,
      isCurrent,
      progressPct,
      isBreak: seg.kind === 'short_break' || seg.kind === 'long_break',
      startMs: seg.start_ms,
      endMs: seg.end_ms,
      minutes: durMin,
      timeRange: `${formatClock(seg.start_ms)}–${formatClock(seg.end_ms)}`,
      label,
      leftPct,
      widthPct,
    });
  });

  for (const g of rawGroups) {
    const clampedStart = Math.max(range.startMs, Math.min(range.endMs, g.startMs));
    const clampedEnd = Math.max(clampedStart, Math.min(range.endMs, g.endMs));
    const leftPct = ((clampedStart - range.startMs) / range.spanMs) * 100;
    const widthPct = Math.max(0.35, ((clampedEnd - clampedStart) / range.spanMs) * 100);
    const anchorPct = Math.min(100, leftPct + widthPct / 2);

    let isCurrent = false;
    let actual = g.allActual;
    let remainingMs = 0;

    if (effectiveNowMs !== null) {
      if (g.startMs < effectiveNowMs && effectiveNowMs < g.endMs) {
        isCurrent = true;
        actual = true;
        remainingMs = Math.max(0, g.endMs - effectiveNowMs);
      } else if (g.endMs <= effectiveNowMs) {
        actual = true;
      }
    }

    groups.push({
      groupId: g.groupId,
      kind: g.kind,
      actual,
      isCurrent,
      remainingMs,
      startMs: g.startMs,
      endMs: g.endMs,
      durationMs: Math.max(0, g.endMs - g.startMs),
      timeRange: `${formatClock(g.startMs)}–${formatClock(g.endMs)}`,
      label: getKindLabel(g.kind, isRu),
      anchorPct,
    });
  }

  return { segments, groups };
}

function clampBubblePosition(
  anchorPct: number,
  containerWidth: number
): { bubblePct: number; pointerOffsetPx: number } {
  const safeWidth = Math.max(containerWidth, 240);
  const minCenterPx = Math.max(0, BUBBLE_WIDTH_PX / 2 - SIDE_PADDING_PX + 2);
  const maxCenterPx = Math.min(safeWidth, safeWidth - BUBBLE_WIDTH_PX / 2 + SIDE_PADDING_PX - 2);
  const rawAnchorPx = (anchorPct / 100) * safeWidth;
  const clampedCenterPx =
    minCenterPx <= maxCenterPx
      ? Math.max(minCenterPx, Math.min(maxCenterPx, rawAnchorPx))
      : safeWidth / 2;

  const bubblePct = (clampedCenterPx / safeWidth) * 100;
  const rawOffsetPx = rawAnchorPx - clampedCenterPx;
  const maxPointerOffset = Math.max(8, BUBBLE_WIDTH_PX / 2 - 12);
  const pointerOffsetPx = Math.max(-maxPointerOffset, Math.min(maxPointerOffset, rawOffsetPx));
  return { bubblePct, pointerOffsetPx };
}

function getGroupPriorityTier(group: BubbleGroup): number {
  if (group.isCurrent) return 0; // 1) current ("идёт")
  if (group.kind === 'stopped' || group.kind === 'paused') return 1; // 2) stopped & paused
  return 2; // 3) rest by duration descending
}

function selectTopBubbles(
  groups: BubbleGroup[],
  containerWidth: number
): PlacedBubble[] {
  if (groups.length === 0) return [];

  const safeWidth = Math.max(containerWidth, 240);
  const requiredDistPx = BUBBLE_WIDTH_PX + BUBBLE_GAP_PX;
  const maxNudgePx = 20;
  const minCenterPx = Math.max(0, BUBBLE_WIDTH_PX / 2 - SIDE_PADDING_PX + 2);
  const maxCenterPx = Math.min(safeWidth, safeWidth - BUBBLE_WIDTH_PX / 2 + SIDE_PADDING_PX - 2);

  // Sort strictly by priority: 1) current, 2) stopped/paused, 3) longest duration first
  const ordered = [...groups].sort((a, b) => {
    const tierDiff = getGroupPriorityTier(a) - getGroupPriorityTier(b);
    if (tierDiff !== 0) return tierDiff;
    if (b.durationMs !== a.durationMs) return b.durationMs - a.durationMs;
    return a.startMs - b.startMs;
  });

  const placed: PlacedBubble[] = [];

  const getConflicts = (centerPx: number) =>
    placed.filter((other) => {
      const otherCenterPx = (other.bubblePct / 100) * safeWidth;
      return Math.abs(centerPx - otherCenterPx) < requiredDistPx;
    });

  for (const group of ordered) {
    const rawAnchorPx = (group.anchorPct / 100) * safeWidth;
    const baseCenterPx =
      minCenterPx <= maxCenterPx
        ? Math.max(minCenterPx, Math.min(maxCenterPx, rawAnchorPx))
        : safeWidth / 2;

    let finalCenterPx = baseCenterPx;
    const conflicts = getConflicts(baseCenterPx);

    if (conflicts.length === 1) {
      const other = conflicts[0];
      const otherCenterPx = (other.bubblePct / 100) * safeWidth;
      const dir = baseCenterPx >= otherCenterPx ? 1 : -1;
      const nudgedPx = Math.max(
        minCenterPx,
        Math.min(maxCenterPx, otherCenterPx + dir * requiredDistPx)
      );

      if (Math.abs(nudgedPx - baseCenterPx) <= maxNudgePx && getConflicts(nudgedPx).length === 0) {
        finalCenterPx = nudgedPx;
      } else {
        continue;
      }
    } else if (conflicts.length > 1) {
      continue;
    }

    const bubblePct = (finalCenterPx / safeWidth) * 100;
    const rawOffsetPx = rawAnchorPx - finalCenterPx;
    const maxPointerOffset = Math.max(8, BUBBLE_WIDTH_PX / 2 - 12);
    const pointerOffsetPx = Math.max(-maxPointerOffset, Math.min(maxPointerOffset, rawOffsetPx));

    placed.push({
      group,
      anchorPct: group.anchorPct,
      bubblePct,
      pointerOffsetPx,
    });
  }

  return placed.sort((a, b) => a.bubblePct - b.bubblePct);
}

function getSegmentBarClasses(
  kind: VisibleKind,
  isFact: boolean,
  isSelected: boolean
): string {
  const highlightRing = isSelected ? 'ring-1 ring-white/70' : '';

  if (!isFact) {
    switch (kind) {
      case 'farm':
        return `bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.95)_0px,rgba(255,255,255,0.95)_3px,rgba(255,255,255,0.3)_3px,rgba(255,255,255,0.3)_6px)] ${
          isSelected ? 'opacity-80' : 'opacity-45'
        } ${highlightRing}`;
      case 'long_break':
      case 'short_break':
        return `bg-[repeating-linear-gradient(-45deg,rgba(161,161,170,0.95)_0px,rgba(161,161,170,0.95)_3px,rgba(113,113,122,0.35)_3px,rgba(113,113,122,0.35)_6px)] ${
          isSelected ? 'opacity-80 ring-1 ring-zinc-300/70' : 'opacity-45 ring-1 ring-black/80'
        }`;
      case 'wait_window':
        return `bg-[repeating-linear-gradient(-45deg,rgba(82,82,91,0.9)_0px,rgba(82,82,91,0.9)_3px,rgba(39,39,42,0.4)_3px,rgba(39,39,42,0.4)_6px)] ${
          isSelected ? 'opacity-80 ring-1 ring-zinc-500/70' : 'opacity-45'
        }`;
      case 'stopped':
        return `bg-[repeating-linear-gradient(-45deg,rgba(190,18,60,0.9)_0px,rgba(190,18,60,0.9)_3px,rgba(136,19,55,0.35)_3px,rgba(136,19,55,0.35)_6px)] ${
          isSelected ? 'opacity-85 ring-1 ring-rose-400/70' : 'opacity-45 ring-1 ring-black/80'
        }`;
      case 'paused':
        return `bg-[repeating-linear-gradient(-45deg,rgba(245,158,11,0.95)_0px,rgba(245,158,11,0.95)_3px,rgba(180,83,9,0.35)_3px,rgba(180,83,9,0.35)_6px)] ${
          isSelected ? 'opacity-85 ring-1 ring-amber-300/70' : 'opacity-45 ring-1 ring-black/80'
        }`;
    }
  }

  switch (kind) {
    case 'farm':
      return isSelected
        ? 'bg-white shadow-[0_0_16px_rgba(255,255,255,0.95)]'
        : 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]';
    case 'long_break':
      return isSelected
        ? 'bg-zinc-400 ring-1 ring-zinc-200/70 shadow-[0_0_10px_rgba(161,161,170,0.45)]'
        : 'bg-zinc-500 ring-1 ring-black/80';
    case 'short_break':
      return isSelected
        ? 'bg-zinc-400 ring-1 ring-zinc-200/70 shadow-[0_0_10px_rgba(161,161,170,0.4)]'
        : 'bg-zinc-600 ring-1 ring-black/80';
    case 'wait_window':
      return isSelected
        ? 'bg-zinc-600 ring-1 ring-zinc-400/60'
        : 'bg-zinc-800 ring-1 ring-zinc-700/70';
    case 'stopped':
      return isSelected
        ? 'bg-rose-700 ring-1 ring-rose-400/70 shadow-[0_0_10px_rgba(225,29,72,0.4)]'
        : 'bg-rose-800 ring-1 ring-black/80';
    case 'paused':
      return isSelected
        ? 'bg-amber-400 ring-1 ring-amber-200/80 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
        : 'bg-amber-500 ring-1 ring-black/80';
  }
}

function getBubbleTheme(
  kind: VisibleKind,
  actual: boolean,
  isElevated = false
): {
  card: string;
  title: string;
  subtext: string;
  time: string;
  pointerDown: string;
} {
  const planOpacity = actual ? '' : isElevated ? 'opacity-90' : 'opacity-70';

  switch (kind) {
    case 'farm':
      return {
        card: `bg-white text-black ${
          isElevated
            ? 'shadow-[0_8px_28px_rgba(255,255,255,0.34)]'
            : 'shadow-[0_6px_22px_rgba(255,255,255,0.22)]'
        } ${planOpacity}`,
        title: 'text-zinc-800',
        subtext: 'text-zinc-500',
        time: 'text-black',
        pointerDown: 'bg-white',
      };
    case 'long_break':
    case 'short_break':
      return {
        card: `bg-zinc-800/95 border ${
          isElevated ? 'border-zinc-400' : 'border-zinc-600/80'
        } text-zinc-300 shadow-[0_6px_18px_rgba(0,0,0,0.75)] ${planOpacity}`,
        title: 'text-zinc-200',
        subtext: 'text-zinc-400',
        time: 'text-zinc-400',
        pointerDown: `bg-zinc-800 border-r border-b ${
          isElevated ? 'border-zinc-400' : 'border-zinc-600/80'
        }`,
      };
    case 'wait_window':
      return {
        card: `bg-zinc-900/95 border ${
          isElevated ? 'border-zinc-500' : 'border-zinc-700/80'
        } text-zinc-400 shadow-[0_6px_16px_rgba(0,0,0,0.75)] ${planOpacity}`,
        title: 'text-zinc-300',
        subtext: 'text-zinc-500',
        time: 'text-zinc-400',
        pointerDown: `bg-zinc-900 border-r border-b ${
          isElevated ? 'border-zinc-500' : 'border-zinc-700/80'
        }`,
      };
    case 'stopped':
      return {
        card: `bg-rose-950/95 border ${
          isElevated ? 'border-rose-500/80' : 'border-rose-700/70'
        } text-rose-200 shadow-[0_6px_18px_rgba(0,0,0,0.75)] ${planOpacity}`,
        title: 'text-rose-200',
        subtext: 'text-rose-400/85',
        time: 'text-rose-300/85',
        pointerDown: `bg-rose-950 border-r border-b ${
          isElevated ? 'border-rose-500/80' : 'border-rose-700/70'
        }`,
      };
    case 'paused':
      return {
        card: `bg-amber-950/95 border ${
          isElevated ? 'border-amber-400/80' : 'border-amber-500/60'
        } text-amber-200 shadow-[0_6px_18px_rgba(0,0,0,0.75)] ${planOpacity}`,
        title: 'text-amber-200',
        subtext: 'text-amber-400/85',
        time: 'text-amber-300/90',
        pointerDown: `bg-amber-950 border-r border-b ${
          isElevated ? 'border-amber-400/80' : 'border-amber-500/60'
        }`,
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
  const [hoveredGroupId, setHoveredGroupId] = useState<number | null>(null);
  const [pinnedGroupId, setPinnedGroupId] = useState<number | null>(null);

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

  useEffect(() => {
    setHoveredGroupId(null);
    setPinnedGroupId(null);
  }, [preview]);

  // Prefer the 1-second ticking nowMs prop; fall back to preview.now_ms only when prop is omitted
  const effectiveNowMs = useMemo(() => {
    if (nowMs != null) return nowMs;
    if (hasNowMs(preview)) return preview.now_ms;
    return null;
  }, [nowMs, preview]);

  const rawVisibleSegments = useMemo(() => {
    if (!preview || !preview.ok || preview.off) return [];
    return (preview.segments || []).filter((seg) => isVisibleKind(seg.kind));
  }, [preview]);

  const timelineRange = useMemo(
    () => computeTimelineRange(rawVisibleSegments),
    [rawVisibleSegments]
  );

  const { segments, groups } = useMemo(
    () =>
      preview && preview.ok && !preview.off
        ? normalizeSegmentsAndGroups(preview.segments || [], timelineRange, effectiveNowMs, isRu)
        : { segments: [], groups: [] },
    [preview, timelineRange, effectiveNowMs, isRu]
  );

  const axisTicks = useMemo(
    () => (timelineRange ? buildAxisTicks(timelineRange, containerWidth) : null),
    [timelineRange, containerWidth]
  );

  const topBubbles = useMemo(
    () => selectTopBubbles(groups, containerWidth),
    [groups, containerWidth]
  );

  const activeGroupId = hoveredGroupId !== null ? hoveredGroupId : pinnedGroupId;
  const activeGroup = useMemo(
    () => (activeGroupId !== null ? groups.find((g) => g.groupId === activeGroupId) || null : null),
    [activeGroupId, groups]
  );

  const activeBubblePlacement = useMemo(() => {
    if (!activeGroup) return null;
    return clampBubblePosition(activeGroup.anchorPct, containerWidth);
  }, [activeGroup, containerWidth]);

  // Strictly use backend-provided sessions & farm_s (pause does not split session count)
  const sessionsCount = useMemo(() => {
    if (preview && typeof preview.sessions === 'number') return preview.sessions;
    return groups.filter((g) => g.kind === 'farm').length;
  }, [preview, groups]);

  const totalFarmMinutes = useMemo(() => {
    if (preview && typeof preview.farm_s === 'number') {
      return Math.round(preview.farm_s / 60);
    }
    return segments.filter((s) => s.kind === 'farm').reduce((sum, s) => sum + s.minutes, 0);
  }, [preview, segments]);

  const breakGroups = useMemo(
    () => groups.filter((g) => g.kind === 'short_break' || g.kind === 'long_break'),
    [groups]
  );
  const breakCount = breakGroups.length;
  const totalBreakMinutes = useMemo(
    () => segments.filter((s) => s.isBreak).reduce((sum, s) => sum + s.minutes, 0),
    [segments]
  );

  const hasPaused = useMemo(() => segments.some((s) => s.kind === 'paused'), [segments]);
  const hasStopped = useMemo(() => segments.some((s) => s.kind === 'stopped'), [segments]);
  const hasPlanned = useMemo(
    () => segments.some((s) => !s.actual || s.isCurrent),
    [segments]
  );

  const isOffState = !isScheduleEnabled || !isDayEnabled || preview?.off === true;
  const hasError = preview !== null && preview.ok === false && Boolean(preview.error);

  const nowPct = useMemo(() => {
    if (effectiveNowMs == null || !timelineRange || timelineRange.spanMs <= 0) return null;
    if (effectiveNowMs < timelineRange.startMs || effectiveNowMs > timelineRange.endMs) return null;
    return ((effectiveNowMs - timelineRange.startMs) / timelineRange.spanMs) * 100;
  }, [effectiveNowMs, timelineRange]);

  const renderBubbleCard = (
    group: BubbleGroup,
    pointerOffsetPx: number,
    isElevated: boolean
  ) => {
    const theme = getBubbleTheme(group.kind, group.actual, isElevated);
    const titleSuffix = group.isCurrent
      ? isRu
        ? ' · идёт'
        : ' · live'
      : !group.actual
      ? isRu
        ? ' · план'
        : ' · plan'
      : '';
    const fullTitle = `${group.label}${titleSuffix}`;

    return (
      <div
        className={`relative w-[132px] rounded-xl px-2 py-1.5 text-center select-none ${theme.card}`}
      >
        {/* Row 1: fixed-height single-line title truncated with ellipsis */}
        <div
          className={`h-[14px] leading-[14px] text-[10px] truncate ${
            isElevated ? 'font-semibold' : 'font-medium'
          } ${theme.title}`}
        >
          {fullTitle}
        </div>
        {/* Row 2: fixed-height time range */}
        <div
          className={`h-[15px] leading-[15px] text-[11px] font-mono tabular-nums mt-0.5 truncate ${
            isElevated ? 'font-bold' : 'font-semibold'
          } ${theme.time}`}
        >
          {group.timeRange}
        </div>
        {/* Row 3: fixed-height countdown slot (empty for non-current bubbles so height never collapses) */}
        <div
          className={`h-[14px] leading-[14px] text-[10px] font-mono tabular-nums mt-0.5 truncate ${theme.subtext}`}
        >
          {group.isCurrent
            ? `${isRu ? 'осталось' : 'left'} ${formatCountdown(group.remainingMs)}`
            : '\u00A0'}
        </div>
        <span
          style={{
            transform: `translateX(calc(-50% + ${pointerOffsetPx}px)) rotate(45deg)`,
          }}
          className={`absolute left-1/2 -bottom-[4.5px] w-2.5 h-2.5 ${theme.pointerDown}`}
        />
      </div>
    );
  };

  return (
    <div
      className={`${className} flex flex-col gap-3`}
      onClick={() => {
        if (pinnedGroupId !== null) setPinnedGroupId(null);
      }}
    >
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

      {/* Inner side padding (~12px) prevents edge bubbles from clipping without stretching axis time */}
      <div className="px-3">
        <div
          ref={trackRef}
          className={`relative w-full pt-[80px] pb-1 transition-opacity duration-200 ${
            isLoading ? 'opacity-65' : 'opacity-100'
          }`}
        >
          {/* TOP-ONLY callouts layer (fixed-size 132px × 3-line bubbles above the bar) */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[74px]">
            {!isOffState &&
              !hasError &&
              topBubbles.map((item) => {
                const { group, bubblePct, pointerOffsetPx } = item;
                if (activeGroupId === group.groupId) return null;

                const isCrowdedByHover =
                  activeBubblePlacement !== null &&
                  Math.abs(((bubblePct - activeBubblePlacement.bubblePct) / 100) * containerWidth) <
                    BUBBLE_WIDTH_PX + BUBBLE_GAP_PX + 4;

                return (
                  <div
                    key={`top-${group.groupId}`}
                    style={{ left: `${bubblePct}%` }}
                    className={`absolute bottom-2 -translate-x-1/2 transition-opacity duration-150 ${
                      isCrowdedByHover ? 'opacity-15' : 'opacity-100'
                    }`}
                  >
                    {renderBubbleCard(group, pointerOffsetPx, false)}
                  </div>
                );
              })}

            {/* Always-on hover/tap callout above the bar for ANY segment */}
            {!isOffState && !hasError && activeGroup && activeBubblePlacement && (
              <div
                key={`active-${activeGroup.groupId}`}
                style={{ left: `${activeBubblePlacement.bubblePct}%` }}
                className="absolute bottom-2 -translate-x-1/2 z-40"
              >
                {renderBubbleCard(activeGroup, activeBubblePlacement.pointerOffsetPx, true)}
              </div>
            )}

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

          {/* Horizontal baseline + interactive segment pieces (solid fact / hatched plan rendered per-piece) */}
          <div className="relative h-6 flex items-center">
            <div
              className={`w-full h-[1.5px] rounded-full pointer-events-none ${
                isOffState ? 'bg-white/15' : 'bg-white/40'
              }`}
            />

            {!preview && !isOffState && (
              <div className="absolute inset-y-0 inset-x-0 flex items-center pointer-events-none">
                <div className="w-1/3 h-[6px] rounded-full bg-white/15 animate-pulse ml-[33%]" />
              </div>
            )}

            {!isOffState &&
              !hasError &&
              segments.map((seg) => {
                const isSelected = activeGroupId === seg.groupId;
                const zClass =
                  seg.kind === 'wait_window'
                    ? 'z-[5]'
                    : seg.kind === 'farm'
                    ? 'z-10'
                    : 'z-20';
                const heightClass =
                  seg.kind === 'wait_window'
                    ? isSelected
                      ? 'h-[5px]'
                      : 'h-[3px]'
                    : isSelected
                    ? 'h-[8px]'
                    : 'h-[6px]';

                return (
                  <button
                    key={seg.id}
                    type="button"
                    aria-label={`${seg.label} ${seg.timeRange}`}
                    style={{
                      left: `${seg.leftPct}%`,
                      width: `${seg.widthPct}%`,
                      minWidth: seg.kind === 'farm' ? '10px' : '8px',
                    }}
                    onMouseEnter={() => setHoveredGroupId(seg.groupId)}
                    onMouseLeave={() =>
                      setHoveredGroupId((prev) => (prev === seg.groupId ? null : prev))
                    }
                    onFocus={() => setHoveredGroupId(seg.groupId)}
                    onBlur={() =>
                      setHoveredGroupId((prev) => (prev === seg.groupId ? null : prev))
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setPinnedGroupId((prev) => (prev === seg.groupId ? null : seg.groupId));
                    }}
                    className={`absolute top-1/2 -translate-y-1/2 h-6 flex items-center justify-center focus:outline-none cursor-pointer ${zClass}`}
                  >
                    {seg.isCurrent ? (
                      <span className={`w-full rounded-full overflow-hidden flex ${heightClass}`}>
                        <span
                          style={{ width: `${seg.progressPct}%` }}
                          className={`h-full shrink-0 ${getSegmentBarClasses(
                            seg.kind,
                            true,
                            isSelected
                          )}`}
                        />
                        <span
                          style={{ width: `${Math.max(0, 100 - seg.progressPct)}%` }}
                          className={`h-full shrink-0 ${getSegmentBarClasses(
                            seg.kind,
                            false,
                            isSelected
                          )}`}
                        />
                      </span>
                    ) : (
                      <span
                        className={`w-full rounded-full transition-all duration-100 ${heightClass} ${getSegmentBarClasses(
                          seg.kind,
                          seg.actual,
                          isSelected
                        )}`}
                      />
                    )}
                  </button>
                );
              })}

            {/* Thin vertical "now" marker strictly inside [startMs, endMs] */}
            {!isOffState && !hasError && nowPct !== null && (
              <div
                style={{ left: `${nowPct}%` }}
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-30 flex flex-col items-center"
              >
                <span className="w-[1.5px] h-5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
              </div>
            )}
          </div>

          {/* Exact-edge + round-interior clock ticks */}
          <div className="relative h-5 mt-1 select-none pointer-events-none">
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
    </div>
  );
};
