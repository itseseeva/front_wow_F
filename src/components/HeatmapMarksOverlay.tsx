import React, { useState, useEffect, useCallback, useLayoutEffect, useRef, useMemo } from 'react';
import { HeatmapMark } from '../types';
import { soundFx } from '../utils/audio';

export type HeatmapLayerKey = 'ok' | 'fight' | 'problems' | 'camp' | 'detour';
export type HeatmapLayersState = Record<HeatmapLayerKey, boolean>;

const LAYERS_STORAGE_KEY = 'wowbot_heatmap_layers';
const LAYERS_SYNC_EVENT = 'wowbot:heatmap-layers-changed';

export const DEFAULT_HEATMAP_LAYERS: HeatmapLayersState = {
  ok: true,
  fight: true,
  problems: true,
  camp: false,
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
      problems: typeof parsed.problems === 'boolean' ? parsed.problems : DEFAULT_HEATMAP_LAYERS.problems,
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

export interface HeatmapMarkCounts {
  ok: number;
  fight: number;
  stuck: number;
  skip: number;
  problems: number;
  camp: number;
  detour: number;
}

export function getHeatmapMarkCounts(marks: HeatmapMark[]): HeatmapMarkCounts {
  let ok = 0;
  let fight = 0;
  let stuck = 0;
  let skip = 0;
  let camp = 0;
  let detour = 0;

  for (const m of marks) {
    switch (m.kind) {
      case 'ok':
        ok += 1;
        break;
      case 'fight':
        fight += 1;
        break;
      case 'stuck':
        stuck += 1;
        break;
      case 'skip':
        skip += 1;
        break;
      case 'camp':
        camp += 1;
        break;
      case 'detour':
        detour += 1;
        break;
      default:
        break;
    }
  }

  return { ok, fight, stuck, skip, problems: stuck + skip, camp, detour };
}

// Bottom-to-top rendering order: camp, detour, ok, fight, skip, stuck, start/finish
const MARK_Z_ORDER: Record<HeatmapMark['kind'], number> = {
  camp: 0,
  detour: 1,
  ok: 2,
  fight: 3,
  skip: 4,
  stuck: 5,
  start: 6,
  finish: 7,
};

function isMarkVisible(mark: HeatmapMark, layers: HeatmapLayersState): boolean {
  switch (mark.kind) {
    case 'start':
    case 'finish':
      return true;
    case 'ok':
      return layers.ok;
    case 'fight':
      return layers.fight;
    case 'stuck':
    case 'skip':
      return layers.problems;
    case 'camp':
      return layers.camp;
    case 'detour':
      return layers.detour;
    default:
      return true;
  }
}

interface HeatmapMarksSvgProps {
  marks: HeatmapMark[];
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

  const sortedMarks = useMemo(() => {
    return marks
      .map((mark, idx) => ({ mark, key: `${mark.kind}-${idx}` }))
      .filter(({ mark }) => isMarkVisible(mark, layers))
      .sort((a, b) => MARK_Z_ORDER[a.mark.kind] - MARK_Z_ORDER[b.mark.kind]);
  }, [marks, layers]);

  if (width <= 0 || height <= 0 || sortedMarks.length === 0) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="absolute inset-0 w-full h-full overflow-visible pointer-events-none select-none"
      aria-label={isRu ? 'Интерактивные метки маршрута' : 'Interactive route markers'}
    >
      {sortedMarks.map(({ mark, key }) => {
        const cx = mark.x * width;
        const cy = mark.y * height;
        const isHovered = hoveredKey === key;

        const handleMouseEnter = (e: React.MouseEvent) => {
          onHoverMark(mark, key, e);
        };
        const handleMouseMove = (e: React.MouseEvent) => {
          onMoveMark(e);
        };
        const handleMouseLeave = () => {
          onHoverMark(null, null);
        };

        // Camp circles scale WITH the image (radius = r * image width)
        if (mark.kind === 'camp') {
          const radius = Math.max(4 * invScale, (mark.r ?? 0.04) * width);
          return (
            <g
              key={key}
              className="pointer-events-auto cursor-pointer"
              onMouseEnter={handleMouseEnter}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="#E24B4A"
                fillOpacity={isHovered ? 0.22 : 0.12}
                stroke="#E24B4A"
                strokeOpacity={isHovered ? 1 : 0.78}
                strokeWidth={(isHovered ? 2 : 1.5) * invScale}
                strokeDasharray={`${5 * invScale} ${3.5 * invScale}`}
              />
            </g>
          );
        }

        // Point marks stay constant size on screen regardless of zoom (divide by scale)
        return (
          <g
            key={key}
            transform={`translate(${cx}, ${cy}) scale(${invScale})`}
            className="pointer-events-auto cursor-pointer"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {mark.kind === 'ok' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7} fill="none" stroke="#1D9E75" strokeWidth={1.5} strokeOpacity={0.75} />
                )}
                <circle r={4} fill="#1D9E75" stroke="#ffffff" strokeWidth={1.5} />
              </>
            )}

            {mark.kind === 'fight' && (
              <>
                <circle r={10} fill="transparent" />
                {isHovered && (
                  <polygon
                    points="0,-8.5 8.5,0 0,8.5 -8.5,0"
                    fill="none"
                    stroke="#BA7517"
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                  />
                )}
                <polygon
                  points="0,-5.5 5.5,0 0,5.5 -5.5,0"
                  fill="#BA7517"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                />
              </>
            )}

            {mark.kind === 'stuck' && (
              <>
                <circle r={10} fill="transparent" />
                {isHovered && (
                  <polygon
                    points="0,-9 8.5,6.5 -8.5,6.5"
                    fill="none"
                    stroke="#E24B4A"
                    strokeWidth={1.5}
                    strokeOpacity={0.8}
                    strokeLinejoin="round"
                  />
                )}
                <polygon
                  points="0,-6 5.5,4.5 -5.5,4.5"
                  fill="#E24B4A"
                  stroke="#ffffff"
                  strokeWidth={1.2}
                  strokeLinejoin="round"
                />
              </>
            )}

            {mark.kind === 'skip' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7.5} fill="none" stroke="#888780" strokeWidth={1.5} strokeOpacity={0.8} />
                )}
                <circle r={4.5} fill="#888780" stroke="#ffffff" strokeWidth={1.3} />
                <line
                  x1={-3}
                  y1={3}
                  x2={3}
                  y2={-3}
                  stroke="#ffffff"
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              </>
            )}

            {mark.kind === 'detour' && (
              <>
                <circle r={9} fill="transparent" />
                {isHovered && (
                  <circle r={7} fill="none" stroke="#FACC15" strokeWidth={1.5} strokeOpacity={0.8} />
                )}
                <circle r={4} fill="#FACC15" stroke="#18181b" strokeWidth={1.6} />
              </>
            )}

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
    </svg>
  );
};

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

    // Prefer right + slightly above cursor; flip when nearing container edges
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
        <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0" aria-hidden="true">
          <circle r="4" fill="#1D9E75" stroke="#ffffff" strokeWidth="1.4" />
        </svg>
      );
    case 'fight':
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0" aria-hidden="true">
          <polygon points="0,-5 5,0 0,5 -5,0" fill="#BA7517" stroke="#ffffff" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
      );
    case 'problems':
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0" aria-hidden="true">
          <polygon points="0,-5 5,4 -5,4" fill="#E24B4A" stroke="#ffffff" strokeWidth="1.1" strokeLinejoin="round" />
        </svg>
      );
    case 'camp':
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0" aria-hidden="true">
          <circle
            r="4.5"
            fill="#E24B4A"
            fillOpacity="0.22"
            stroke="#E24B4A"
            strokeWidth="1.4"
            strokeDasharray="2.5 1.8"
          />
        </svg>
      );
    case 'detour':
      return (
        <svg width="12" height="12" viewBox="-6 -6 12 12" className="shrink-0" aria-hidden="true">
          <circle r="4" fill="#FACC15" stroke="#18181b" strokeWidth="1.5" />
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
    { key: 'problems', labelRu: 'Проблемы', labelEn: 'Problems', count: counts.problems },
    { key: 'camp', labelRu: 'Лагеря', labelEn: 'Camps', count: counts.camp },
    { key: 'detour', labelRu: 'Обходы', labelEn: 'Detours', count: counts.detour },
  ];
  const buttons = allButtons.filter((btn) => btn.count > 0);

  const isDarkOnly = variant === 'dark';

  const stats = [
    {
      key: 'ok',
      label: isRu ? 'собрано' : 'gathered',
      value: counts.ok,
      accent: '#1D9E75',
    },
    {
      key: 'fight',
      label: isRu ? 'боёв' : 'fights',
      value: counts.fight,
      accent: '#BA7517',
    },
    {
      key: 'stuck',
      label: isRu ? 'застреваний' : 'stucks',
      value: counts.stuck,
      accent: '#E24B4A',
    },
    {
      key: 'detour',
      label: isRu ? 'обходов' : 'detours',
      value: counts.detour,
      accent: '#FACC15',
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

      {/* 4 Summary Stat Tiles */}
      <div
        className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${
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
