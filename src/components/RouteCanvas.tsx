import React, { useEffect, useState, useMemo, useRef } from 'react';
import { RoutePoint, RoutePath, RouteMarkKind } from '../types';

interface RouteCanvasProps {
  points: RoutePoint[];
  paths?: RoutePath[];
  activePathIndex?: number;
  isPaused?: boolean;
  aspect?: number;
  mode?: 'thumb' | 'live_record' | 'preview';
  loop?: boolean;
  className?: string;
  onActivePathComplete?: () => void;
}

const MARK_ICONS: Record<RouteMarkKind, { icon: string; label: string; color: string }> = {
  skip: { icon: '⏩', label: 'пропустил точку', color: '#38bdf8' },
  back: { icon: '🔄', label: 'вернулся назад', color: '#a855f7' },
  reverse: { icon: '↩️', label: 'развернулся', color: '#f43f5e' },
  pause: { icon: '👁️', label: 'остановился осмотреться', color: '#fbbf24' },
  detour: { icon: '↗️', label: 'заглянул в сторону', color: '#34d399' },
};

const PATH_COLORS = ['#38bdf8', '#c084fc', '#f59e0b'];

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
  points,
  paths = [],
  activePathIndex = 0,
  isPaused = false,
  aspect = 1.5,
  mode = 'thumb',
  loop = true,
  className = '',
  onActivePathComplete,
}) => {
  // Animation state for preview mode
  const [animProgress, setAnimProgress] = useState(0); // 0 to 1
  const [activePopupMark, setActivePopupMark] = useState<{ kind: RouteMarkKind; point: [number, number] } | null>(null);

  const reqRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  // Compute transformed coordinates [wx, wy] where wx = x * aspect, wy = y
  const transformedPoints: [number, number][] = useMemo(() => {
    return points.map(([x, y]) => [x * aspect, y]);
  }, [points, aspect]);

  // Compute bounding box with margins
  const { viewBox, minX, minY, width, height } = useMemo(() => {
    if (transformedPoints.length === 0) {
      return { viewBox: '0 0 150 100', minX: 0, minY: 0, width: 150, height: 100 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    transformedPoints.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    // Also include paths in bounding box if in preview mode
    if (mode === 'preview') {
      paths.forEach((p) => {
        p.points.forEach(([x, y]) => {
          const wx = x * aspect;
          if (wx < minX) minX = wx;
          if (wx > maxX) maxX = wx;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        });
      });
    }

    const spanX = Math.max(0.08, maxX - minX);
    const spanY = Math.max(0.06, maxY - minY);

    // Padding (approx 10-15%)
    const padX = spanX * 0.14;
    const padY = spanY * 0.14;

    const boxX = minX - padX;
    const boxY = minY - padY;
    const boxW = spanX + padX * 2;
    const boxH = spanY + padY * 2;

    return {
      viewBox: `${boxX} ${boxY} ${boxW} ${boxH}`,
      minX: boxX,
      minY: boxY,
      width: boxW,
      height: boxH,
    };
  }, [transformedPoints, paths, mode, aspect]);

  // SVG Path data generator for points
  const pointsToPathD = (pts: [number, number][], isClosed: boolean): string => {
    if (pts.length < 2) return '';
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i][0]} ${pts[i][1]}`;
    }
    if (isClosed) {
      d += ' Z';
    }
    return d;
  };

  const baseSvgPathD = useMemo(() => {
    return pointsToPathD(transformedPoints, loop && mode !== 'live_record');
  }, [transformedPoints, loop, mode]);

  // Transform path points
  const transformedPaths = useMemo(() => {
    return paths.map((p) => ({
      ...p,
      transformedPoints: p.points.map(([x, y]) => [x * aspect, y] as [number, number]),
    }));
  }, [paths, aspect]);

  // Animation loop in preview mode (8 to 12s per full loop)
  useEffect(() => {
    if (mode !== 'preview' || paths.length === 0) return;

    const animate = (time: number) => {
      if (!isPaused) {
        const delta = (time - lastTimeRef.current) / 1000;
        // Complete full path in ~10 seconds
        const step = delta / 10;
        setAnimProgress((prev) => {
          const next = prev + step;
          if (next >= 1) {
            if (onActivePathComplete) onActivePathComplete();
            return 0;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      reqRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = performance.now();
    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [mode, paths.length, isPaused, onActivePathComplete]);

  // Active bot coordinates & trail
  const currentPathData = transformedPaths[activePathIndex] || transformedPaths[0];

  const { botPos, passedPoints, passedMarks } = useMemo(() => {
    if (!currentPathData || currentPathData.transformedPoints.length === 0) {
      return { botPos: null, passedPoints: [], passedMarks: [] };
    }

    const pts = currentPathData.transformedPoints;
    const totalSegments = pts.length - 1;
    if (totalSegments <= 0) return { botPos: pts[0], passedPoints: pts, passedMarks: [] };

    const exactIndex = animProgress * totalSegments;
    const baseIdx = Math.floor(exactIndex);
    const frac = exactIndex - baseIdx;

    const p1 = pts[baseIdx];
    const p2 = pts[Math.min(totalSegments, baseIdx + 1)];

    const curX = p1[0] + (p2[0] - p1[0]) * frac;
    const curY = p1[1] + (p2[1] - p1[1]) * frac;

    // Passed points for trail
    const passed = pts.slice(0, baseIdx + 1);
    passed.push([curX, curY]);

    // Active marks that have been passed or near
    const marksPassed = (currentPathData.marks || []).filter((m) => m.index <= baseIdx);

    // Active popup check
    const nearMark = (currentPathData.marks || []).find((m) => Math.abs(m.index - exactIndex) < 0.6);
    if (nearMark) {
      const pt = pts[nearMark.index];
      setActivePopupMark({ kind: nearMark.kind, point: pt });
    } else {
      setActivePopupMark(null);
    }

    return {
      botPos: [curX, curY] as [number, number],
      passedPoints: passed,
      passedMarks: marksPassed,
    };
  }, [currentPathData, animProgress]);

  // Calculate direction arrows along recorded route
  const directionArrows = useMemo(() => {
    if (mode === 'thumb' || transformedPoints.length < 5) return [];
    const arrows: { x: number; y: number; angle: number }[] = [];
    const step = Math.max(4, Math.floor(transformedPoints.length / 8));

    for (let i = step; i < transformedPoints.length; i += step) {
      const p1 = transformedPoints[i - 1];
      const p2 = transformedPoints[i];
      const angle = (Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180) / Math.PI;
      arrows.push({ x: p2[0], y: p2[1], angle });
    }
    return arrows;
  }, [transformedPoints, mode]);

  const startPoint = transformedPoints[0];
  const lastPoint = transformedPoints[transformedPoints.length - 1];

  return (
    <div className={`w-full h-full relative flex items-center justify-center overflow-hidden select-none ${className}`}>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <defs>
          {/* Subtle Grid Pattern */}
          <pattern id="gridPattern" width="0.1" height="0.1" patternUnits="userSpaceOnUse">
            <path d="M 0.1 0 L 0 0 0 0.1" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.002" />
          </pattern>

          {/* Golden Glow Filter for Base Route */}
          <filter id="goldenGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.008" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Bot Glow Filter */}
          <filter id="botGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.015" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Arrow Marker */}
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#facc15" opacity="0.8" />
          </marker>
        </defs>

        {/* Background grid */}
        <rect x={minX} y={minY} width={width} height={height} fill="url(#gridPattern)" />

        {/* 1. Base Recorded Route points line */}
        {transformedPoints.length >= 2 && (
          <path
            d={baseSvgPathD}
            fill="none"
            stroke="#eab308"
            strokeWidth={mode === 'thumb' ? '0.018' : '0.014'}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={mode === 'preview' ? 0.45 : 0.9}
            filter={mode !== 'thumb' ? 'url(#goldenGlow)' : undefined}
          />
        )}

        {/* Direction arrows along base route in preview */}
        {mode === 'preview' &&
          directionArrows.map((arr, i) => (
            <g key={i} transform={`translate(${arr.x}, ${arr.y}) rotate(${arr.angle})`}>
              <path d="M -0.012 -0.007 L 0.008 0 L -0.012 0.007" fill="none" stroke="#fef08a" strokeWidth="0.004" opacity="0.85" />
            </g>
          ))}

        {/* 2. Previous paths (faded trails of their color) in preview mode */}
        {mode === 'preview' &&
          transformedPaths.map((p, idx) => {
            if (idx === activePathIndex) return null;
            const pD = pointsToPathD(p.transformedPoints, loop);
            return (
              <path
                key={idx}
                d={pD}
                fill="none"
                stroke={PATH_COLORS[idx % PATH_COLORS.length]}
                strokeWidth="0.007"
                strokeDasharray="0.012, 0.008"
                strokeLinecap="round"
                opacity={0.3}
              />
            );
          })}

        {/* 3. Current active path (faded dashed full line + bright active trail) */}
        {mode === 'preview' && currentPathData && (
          <>
            <path
              d={pointsToPathD(currentPathData.transformedPoints, loop)}
              fill="none"
              stroke={PATH_COLORS[activePathIndex % PATH_COLORS.length]}
              strokeWidth="0.008"
              strokeDasharray="0.012, 0.008"
              strokeLinecap="round"
              opacity={0.35}
            />

            {/* Active animated trail behind bot */}
            {passedPoints.length >= 2 && (
              <path
                d={pointsToPathD(passedPoints, false)}
                fill="none"
                stroke={PATH_COLORS[activePathIndex % PATH_COLORS.length]}
                strokeWidth="0.01"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            )}
          </>
        )}

        {/* 4. Marks icons on path */}
        {mode === 'preview' &&
          currentPathData?.marks?.map((m, idx) => {
            const pt = currentPathData.transformedPoints[m.index];
            if (!pt) return null;
            const isPassed = animProgress * (currentPathData.transformedPoints.length - 1) >= m.index;
            const meta = MARK_ICONS[m.kind] || MARK_ICONS.skip;

            return (
              <g key={idx} transform={`translate(${pt[0]}, ${pt[1]})`}>
                <circle r="0.014" fill="#090a10" stroke={meta.color} strokeWidth="0.003" opacity={isPassed ? 1 : 0.6} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="0.014"
                  fill={meta.color}
                  opacity={isPassed ? 1 : 0.7}
                >
                  {meta.icon}
                </text>
              </g>
            );
          })}

        {/* 5. Start Point (Green circle) */}
        {startPoint && (
          <g transform={`translate(${startPoint[0]}, ${startPoint[1]})`}>
            <circle r="0.02" fill="#22c55e" stroke="#15803d" strokeWidth="0.004" opacity="0.9" filter="url(#botGlow)" />
            <circle r="0.028" fill="none" stroke="#4ade80" strokeWidth="0.003" opacity="0.5" />
            {mode !== 'thumb' && (
              <text
                x="0"
                y="-0.025"
                textAnchor="middle"
                fontSize="0.016"
                fontWeight="bold"
                fill="#4ade80"
                fontFamily="sans-serif"
              >
                старт
              </text>
            )}
          </g>
        )}

        {/* End Point if linear path */}
        {!loop && lastPoint && mode !== 'thumb' && (
          <g transform={`translate(${lastPoint[0]}, ${lastPoint[1]})`}>
            <circle r="0.016" fill="#ef4444" stroke="#991b1b" strokeWidth="0.004" />
            <text x="0" y="0.025" textAnchor="middle" fontSize="0.013" fontWeight="bold" fill="#f87171">
              конец
            </text>
          </g>
        )}

        {/* 6. Live Record: "ты здесь" blinking circle at last point */}
        {mode === 'live_record' && lastPoint && (
          <g transform={`translate(${lastPoint[0]}, ${lastPoint[1]})`}>
            <circle r="0.024" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.005" filter="url(#botGlow)">
              <animate attributeName="r" values="0.018;0.028;0.018" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.6;1" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <text x="0" y="-0.03" textAnchor="middle" fontSize="0.016" fontWeight="bold" fill="#38bdf8">
              ты здесь
            </text>
          </g>
        )}

        {/* 7. Preview: Animated Bot circle moving along path */}
        {mode === 'preview' && botPos && (
          <g transform={`translate(${botPos[0]}, ${botPos[1]})`}>
            <circle
              r="0.02"
              fill={PATH_COLORS[activePathIndex % PATH_COLORS.length]}
              stroke="#ffffff"
              strokeWidth="0.004"
              filter="url(#botGlow)"
            />
            <circle
              r="0.032"
              fill="none"
              stroke={PATH_COLORS[activePathIndex % PATH_COLORS.length]}
              strokeWidth="0.002"
              opacity="0.6"
            />
          </g>
        )}
      </svg>

      {/* Popup tooltip when passing a mark in preview mode */}
      {mode === 'preview' && activePopupMark && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md text-xs font-mono font-bold border shadow-xl flex items-center gap-1.5 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
          style={{
            backgroundColor: '#090b14',
            borderColor: MARK_ICONS[activePopupMark.kind].color,
            color: MARK_ICONS[activePopupMark.kind].color,
            boxShadow: `0 0 15px ${MARK_ICONS[activePopupMark.kind].color}44`,
          }}
        >
          <span>{MARK_ICONS[activePopupMark.kind].icon}</span>
          <span>{MARK_ICONS[activePopupMark.kind].label}</span>
        </div>
      )}
    </div>
  );
};
