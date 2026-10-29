import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { RoutePoint, RoutePath, RouteMarkKind } from '../types';
import { useMapImage } from '../hooks/useMapImage';
import { Plus, Minus, Maximize2, RotateCcw, Loader2 } from 'lucide-react';

export interface RouteCanvasProps {
  points: RoutePoint[];
  mapId?: number | null;
  paths?: RoutePath[];
  activeVariant?: number; // 0: 'Как записал', 1: 'Вариант 1', 2: 'Вариант 2', 3: 'Вариант 3'
  isAnimating?: boolean; // if true, bot runs along the active variant path
  aspect?: number;
  mode?: 'thumb' | 'live_record' | 'preview';
  loop?: boolean;
  className?: string;
  onHoverMark?: (mark: { kind: RouteMarkKind; label: string; count?: number } | null) => void;
}

export const MARK_METADATA: Record<RouteMarkKind, { icon: string; label: string; desc: string; color: string }> = {
  skip: { icon: '⤳', label: 'пропустит точку', desc: 'бот срежет и не побежит в эту точку', color: '#38bdf8' },
  back: { icon: '↶', label: 'вернётся назад', desc: 'на 1–3 точки, как будто что-то забыл', color: '#a855f7' },
  reverse: { icon: '⇄', label: 'развернётся', desc: 'дальше пойдёт по кругу в обратную сторону', color: '#f43f5e' },
  pause: { icon: '⏸', label: 'остановится осмотреться', desc: 'постоит пару секунд', color: '#fbbf24' },
  detour: { icon: '↗', label: 'свернёт в сторону', desc: 'отбежит на 7–17 ярдов от линии и вернётся', color: '#34d399' },
};

export const RouteCanvas: React.FC<RouteCanvasProps> = ({
  points,
  mapId,
  paths = [],
  activeVariant = 0,
  isAnimating = false,
  aspect = 1.5,
  mode = 'thumb',
  loop = true,
  className = '',
  onHoverMark,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 400, h: 260 });

  // Map image hook
  const mapImage = useMapImage(mapId);

  // Map dimensions
  const mapW = mapImage?.width || Math.round(1000 * aspect);
  const mapH = mapImage?.height || 1000;

  // ViewBox state (in map image pixels)
  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: mapW,
    h: mapH,
  });

  const [defaultViewBox, setDefaultViewBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: mapW,
    h: mapH,
  });

  // Track user manual panning/zooming timestamp
  const userInteractedAtRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Animation state for bot preview run
  const [animProgress, setAnimProgress] = useState(0); // 0 to 1
  const animReqRef = useRef<number | null>(null);

  // Measure container size
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ w: width, h: height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Pixel scale factor: 1 screen pixel = px viewBox units
  const px = useMemo(() => {
    return viewBox.w / Math.max(1, containerSize.w);
  }, [viewBox.w, containerSize.w]);

  // Convert RoutePoints [0..1, 0..1] to Map pixel points [0..mapW, 0..mapH]
  const mapPoints: [number, number][] = useMemo(() => {
    return points.map(([x, y]) => [x * mapW, y * mapH]);
  }, [points, mapW, mapH]);

  // Current bot path if in variant mode
  const currentBotPath: RoutePath | null = useMemo(() => {
    if (activeVariant > 0 && paths[activeVariant - 1]) {
      return paths[activeVariant - 1];
    }
    return null;
  }, [activeVariant, paths]);

  const botMapPoints: [number, number][] = useMemo(() => {
    if (!currentBotPath) return [];
    return currentBotPath.points.map(([x, y]) => [x * mapW, y * mapH]);
  }, [currentBotPath, mapW, mapH]);

  // Compute default bounding box frame
  const computeDefaultFrame = useCallback(() => {
    const ptsToConsider = botMapPoints.length > 0 ? botMapPoints : mapPoints;

    const canvasAspect = containerSize.w / Math.max(1, containerSize.h);

    if (ptsToConsider.length < 2) {
      // Show entire map
      let spanW = mapW;
      let spanH = mapW / canvasAspect;
      if (spanH > mapH) {
        spanH = mapH;
        spanW = mapH * canvasAspect;
      }
      return {
        x: (mapW - spanW) / 2,
        y: (mapH - spanH) / 2,
        w: spanW,
        h: spanH,
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    ptsToConsider.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });

    const rw = Math.max(1, maxX - minX);
    const rh = Math.max(1, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Margin is 35% of route size, but at least 18% of map width
    const minSpan = mapW * 0.18;
    let spanX = Math.max(rw * 1.7, minSpan);
    let spanY = Math.max(rh * 1.7, minSpan / canvasAspect);

    // Match canvas aspect ratio without stretching
    if (spanX / spanY < canvasAspect) {
      spanX = spanY * canvasAspect;
    } else {
      spanY = spanX / canvasAspect;
    }

    // Clamp inside map if possible
    if (spanX > mapW) {
      spanX = mapW;
      spanY = mapW / canvasAspect;
    }
    if (spanY > mapH) {
      spanY = mapH;
      spanX = mapH * canvasAspect;
    }

    const vx = Math.max(0, Math.min(mapW - spanX, cx - spanX / 2));
    const vy = Math.max(0, Math.min(mapH - spanY, cy - spanY / 2));

    return {
      x: vx,
      y: vy,
      w: spanX,
      h: spanY,
    };
  }, [mapPoints, botMapPoints, mapW, mapH, containerSize.w, containerSize.h]);

  // Recalculate default viewBox when points or map size change
  useEffect(() => {
    const frame = computeDefaultFrame();
    setDefaultViewBox(frame);
    // If not interacted recently, apply default frame
    if (Date.now() - userInteractedAtRef.current > 3000 || mode === 'thumb') {
      setViewBox(frame);
    }
  }, [computeDefaultFrame, mode]);

  // Live record: Follow "Ты здесь"
  useEffect(() => {
    if (mode !== 'live_record' || mapPoints.length === 0) return;
    const now = Date.now();
    if (now - userInteractedAtRef.current < 5000) return; // User interacted within 5s, don't jerk camera

    const lastPt = mapPoints[mapPoints.length - 1];
    const marginW = viewBox.w * 0.15;
    const marginH = viewBox.h * 0.15;

    const nearLeft = lastPt[0] < viewBox.x + marginW;
    const nearRight = lastPt[0] > viewBox.x + viewBox.w - marginW;
    const nearTop = lastPt[1] < viewBox.y + marginH;
    const nearBottom = lastPt[1] > viewBox.y + viewBox.h - marginH;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      setViewBox((prev) => ({
        ...prev,
        x: Math.max(0, Math.min(mapW - prev.w, lastPt[0] - prev.w / 2)),
        y: Math.max(0, Math.min(mapH - prev.h, lastPt[1] - prev.h / 2)),
      }));
    }
  }, [mapPoints, mode, viewBox.w, viewBox.h, viewBox.x, viewBox.y, mapW, mapH]);

  // Bot preview run animation: ~6 seconds full path
  useEffect(() => {
    if (!isAnimating || !currentBotPath || botMapPoints.length === 0) {
      setAnimProgress(0);
      return;
    }

    let startTime = performance.now();
    const duration = 6000; // 6s

    const run = (time: number) => {
      const elapsed = time - startTime;
      const prog = (elapsed % duration) / duration;
      setAnimProgress(prog);
      animReqRef.current = requestAnimationFrame(run);
    };

    animReqRef.current = requestAnimationFrame(run);
    return () => {
      if (animReqRef.current) cancelAnimationFrame(animReqRef.current);
    };
  }, [isAnimating, currentBotPath, botMapPoints.length]);

  // Compute SVG path string from points
  const pointsToSvgPath = (pts: [number, number][], isClosed: boolean): string => {
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

  const recordedRouteD = useMemo(() => {
    return pointsToSvgPath(mapPoints, loop && mode !== 'live_record');
  }, [mapPoints, loop, mode]);

  const botRouteD = useMemo(() => {
    return pointsToSvgPath(botMapPoints, loop);
  }, [botMapPoints, loop]);

  // Direction arrows calculation (chevrons every ~60px screen length)
  const computeArrows = (pts: [number, number][], stepPx = 60) => {
    if (pts.length < 2) return [];
    const stepView = stepPx * px;
    const arrows: { x: number; y: number; angle: number }[] = [];
    let accDist = 0;

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const segDist = Math.hypot(dx, dy);
      if (segDist === 0) continue;

      accDist += segDist;
      if (accDist >= stepView) {
        accDist = 0;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        arrows.push({
          x: p1[0] + dx * 0.5,
          y: p1[1] + dy * 0.5,
          angle,
        });
      }
    }
    return arrows;
  };

  const recordedArrows = useMemo(() => {
    if (mode === 'thumb') return [];
    return computeArrows(mapPoints, 65);
  }, [mapPoints, px, mode]);

  const botArrows = useMemo(() => {
    if (mode === 'thumb' || activeVariant === 0) return [];
    return computeArrows(botMapPoints, 65);
  }, [botMapPoints, px, mode, activeVariant]);

  // Animated bot coordinates & partial line
  const { botPos, botPassedD } = useMemo(() => {
    if (!isAnimating || botMapPoints.length < 2) {
      return { botPos: null, botPassedD: '' };
    }
    const totalSegs = botMapPoints.length - 1;
    const exact = animProgress * totalSegs;
    const idx = Math.floor(exact);
    const frac = exact - idx;

    const p1 = botMapPoints[idx];
    const p2 = botMapPoints[Math.min(totalSegs, idx + 1)];

    const curX = p1[0] + (p2[0] - p1[0]) * frac;
    const curY = p1[1] + (p2[1] - p1[1]) * frac;

    const passedPts = botMapPoints.slice(0, idx + 1);
    passedPts.push([curX, curY]);

    return {
      botPos: [curX, curY] as [number, number],
      botPassedD: pointsToSvgPath(passedPts, false),
    };
  }, [isAnimating, botMapPoints, animProgress]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    userInteractedAtRef.current = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseXView = viewBox.x + ((e.clientX - rect.left) / rect.width) * viewBox.w;
    const mouseYView = viewBox.y + ((e.clientY - rect.top) / rect.height) * viewBox.h;

    const zoom = e.deltaY < 0 ? 0.82 : 1.22;
    const canvasAspect = containerSize.w / Math.max(1, containerSize.h);

    const newW = Math.max(mapW * 0.05, Math.min(mapW * 1.5, viewBox.w * zoom));
    const newH = newW / canvasAspect;

    const newX = mouseXView - (mouseXView - viewBox.x) * (newW / viewBox.w);
    const newY = mouseYView - (mouseYView - viewBox.y) * (newH / viewBox.h);

    setViewBox({
      x: newX,
      y: newY,
      w: newW,
      h: newH,
    });
  };

  // Mouse Drag to Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || mode === 'thumb') return;
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    userInteractedAtRef.current = Date.now();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    userInteractedAtRef.current = Date.now();
    const dxScreen = e.clientX - dragStartRef.current.x;
    const dyScreen = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const dxView = dxScreen * px;
    const dyView = dyScreen * px;

    setViewBox((prev) => ({
      ...prev,
      x: prev.x - dxView,
      y: prev.y - dyView,
    }));
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Zoom Controls
  const handleZoom = (factor: number) => {
    userInteractedAtRef.current = Date.now();
    const canvasAspect = containerSize.w / Math.max(1, containerSize.h);
    const cx = viewBox.x + viewBox.w / 2;
    const cy = viewBox.y + viewBox.h / 2;

    const newW = Math.max(mapW * 0.05, Math.min(mapW * 1.5, viewBox.w * factor));
    const newH = newW / canvasAspect;

    setViewBox({
      x: cx - newW / 2,
      y: cy - newH / 2,
      w: newW,
      h: newH,
    });
  };

  const handleShowFullMap = () => {
    userInteractedAtRef.current = Date.now();
    const canvasAspect = containerSize.w / Math.max(1, containerSize.h);
    let spanW = mapW;
    let spanH = mapW / canvasAspect;
    if (spanH > mapH) {
      spanH = mapH;
      spanW = mapH * canvasAspect;
    }
    setViewBox({
      x: (mapW - spanW) / 2,
      y: (mapH - spanH) / 2,
      w: spanW,
      h: spanH,
    });
  };

  const handleResetFrame = () => {
    userInteractedAtRef.current = 0;
    const frame = computeDefaultFrame();
    setViewBox(frame);
  };

  // Start & finish points
  const startPt = mapPoints[0];
  const finishPt = mapPoints[mapPoints.length - 1];
  const botStartPt = botMapPoints[0];

  // Last 10 points for live record bright tail
  const recentTailPts = useMemo(() => {
    if (mode !== 'live_record' || mapPoints.length < 2) return [];
    return mapPoints.slice(Math.max(0, mapPoints.length - 10));
  }, [mapPoints, mode]);

  const recentTailD = useMemo(() => {
    return pointsToSvgPath(recentTailPts, false);
  }, [recentTailPts]);

  return (
    <div
      ref={containerRef}
      onWheel={mode !== 'thumb' ? handleWheel : undefined}
      onMouseDown={mode !== 'thumb' ? handleMouseDown : undefined}
      onMouseMove={mode !== 'thumb' ? handleMouseMove : undefined}
      onMouseUp={mode !== 'thumb' ? handleMouseUp : undefined}
      onMouseLeave={mode !== 'thumb' ? handleMouseUp : undefined}
      className={`w-full h-full relative overflow-hidden select-none bg-[#090b10] ${
        mode !== 'thumb' ? 'cursor-grab active:cursor-grabbing' : ''
      } ${className}`}
    >
      <svg
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
      >
        <defs>
          {/* Subtle Grid Pattern for fallback/loading */}
          <pattern id="gridPatternMap" width={40 * px} height={40 * px} patternUnits="userSpaceOnUse">
            <path d={`M ${40 * px} 0 L 0 0 0 ${40 * px}`} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1 * px} />
          </pattern>
        </defs>

        {/* 1. Background: Dark grid */}
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#07090e" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="url(#gridPatternMap)" />

        {/* 2. Map Image Underlay if ready */}
        {mapImage?.status === 'ready' && mapImage.image && (
          <>
            <image
              href={mapImage.image}
              x={0}
              y={0}
              width={mapW}
              height={mapH}
              preserveAspectRatio="none"
            />
            {/* Dark overlay (25-35% opacity) for contrast */}
            <rect x={0} y={0} width={mapW} height={mapH} fill="black" opacity={0.28} />
          </>
        )}

        {/* 3. Base Recorded Route */}
        {mapPoints.length >= 2 && (
          <g>
            {/* Outline 5px for contrast */}
            <path
              d={recordedRouteD}
              fill="none"
              stroke="#0a0a0f"
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={activeVariant > 0 ? 0.35 : 0.95}
            />
            {/* Main Gold Line (3px when normal, 1.5px when variant is selected) */}
            <path
              d={recordedRouteD}
              fill="none"
              stroke="#f5c542"
              strokeWidth={activeVariant > 0 ? 1.5 : 3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={activeVariant > 0 ? 0.35 : 1}
            />

            {/* Direction Arrows on Recorded Route (only when activeVariant === 0) */}
            {activeVariant === 0 &&
              recordedArrows.map((arr, i) => (
                <g key={i} transform={`translate(${arr.x}, ${arr.y}) rotate(${arr.angle}) scale(${px})`}>
                  <path
                    d="M -5 -4 L 3 0 L -5 4"
                    fill="none"
                    stroke="#0a0a0f"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -5 -4 L 3 0 L -5 4"
                    fill="none"
                    stroke="#fef08a"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
          </g>
        )}

        {/* 4. Variant Bot Path (Active Variant > 0) */}
        {activeVariant > 0 && botMapPoints.length >= 2 && (
          <g>
            {/* Dark Outline */}
            <path
              d={botRouteD}
              fill="none"
              stroke="#0a0a0f"
              strokeWidth={5}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.85}
            />
            {/* Ruby / Gold Bot Variant Route 3px */}
            <path
              d={botRouteD}
              fill="none"
              stroke="#ef4444"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
            />

            {/* Active animated trail when playing */}
            {isAnimating && botPassedD && (
              <path
                d={botPassedD}
                fill="none"
                stroke="#f0b232"
                strokeWidth={3.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Direction Arrows on Bot Path */}
            {botArrows.map((arr, i) => (
              <g key={i} transform={`translate(${arr.x}, ${arr.y}) rotate(${arr.angle}) scale(${px})`}>
                <path
                  d="M -5 -4 L 3 0 L -5 4"
                  fill="none"
                  stroke="#0a0a0f"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M -5 -4 L 3 0 L -5 4"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            ))}

            {/* Marks on Variant Path */}
            {currentBotPath?.marks?.map((m, idx) => {
              const pt = botMapPoints[m.index];
              if (!pt) return null;
              const meta = MARK_METADATA[m.kind];

              return (
                <g
                  key={idx}
                  transform={`translate(${pt[0]}, ${pt[1]}) scale(${px})`}
                  onMouseEnter={() => onHoverMark && onHoverMark({ kind: m.kind, label: meta.label })}
                  onMouseLeave={() => onHoverMark && onHoverMark(null)}
                  className="cursor-help"
                >
                  <circle r={8} fill="#090a10" stroke={meta.color} strokeWidth={2} />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={9}
                    fontWeight="bold"
                    fill={meta.color}
                  >
                    {meta.icon}
                  </text>
                  <title>{`${meta.icon} ${meta.label}: ${meta.desc}`}</title>
                </g>
              );
            })}

            {/* Bot Start Marker: Green circle + "Бот начнёт здесь" */}
            {botStartPt && mode !== 'thumb' && (
              <g transform={`translate(${botStartPt[0]}, ${botStartPt[1]}) scale(${px})`}>
                <circle r={7} fill="#22c55e" stroke="#ffffff" strokeWidth={2} />
                <rect x={-45} y={-23} width={90} height={14} rx={3} fill="#05070a" stroke="#22c55e" strokeWidth={1} opacity={0.9} />
                <text
                  x={0}
                  y={-14}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5}
                  fontWeight="bold"
                  fill="#4ade80"
                >
                  Бот начнёт здесь
                </text>
              </g>
            )}

            {/* Animated Bot Circle (6px) */}
            {isAnimating && botPos && (
              <g transform={`translate(${botPos[0]}, ${botPos[1]}) scale(${px})`}>
                <circle r={6} fill="#ffffff" stroke="#ef4444" strokeWidth={2.5} />
                <circle r={10} fill="none" stroke="#f0b232" strokeWidth={1.5} opacity={0.8} />
              </g>
            )}
          </g>
        )}

        {/* 5. Live Record: Bright tail + "Ты здесь" */}
        {mode === 'live_record' && (
          <>
            {recentTailD && (
              <path
                d={recentTailD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={3.5}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {finishPt && (
              <g transform={`translate(${finishPt[0]}, ${finishPt[1]}) scale(${px})`}>
                {/* Soft pulsing ring up to 14px */}
                <circle r={6} fill="none" stroke="#38bdf8" strokeWidth={1.5}>
                  <animate attributeName="r" values="6;14;6" dur="1.4s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.9;0;0.9" dur="1.4s" repeatCount="indefinite" />
                </circle>
                {/* 6px Cyan Circle with White Outline */}
                <circle r={6} fill="#06b6d4" stroke="#ffffff" strokeWidth={2} />
                <rect x={-26} y={-22} width={52} height={14} rx={3} fill="#05070a" stroke="#06b6d4" strokeWidth={1} opacity={0.9} />
                <text
                  x={0}
                  y={-13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5}
                  fontWeight="bold"
                  fill="#67e8f9"
                >
                  ты здесь
                </text>
              </g>
            )}
          </>
        )}

        {/* 6. Start / Finish Markers for Recorded Route (when activeVariant === 0) */}
        {activeVariant === 0 && mapPoints.length >= 2 && (
          <>
            {/* Start Marker (Green circle 7px + white outline) */}
            {startPt && (
              <g transform={`translate(${startPt[0]}, ${startPt[1]}) scale(${px})`}>
                <circle r={7} fill="#22c55e" stroke="#ffffff" strokeWidth={2} />
                {mode !== 'thumb' && (
                  <>
                    <rect
                      x={loop ? -38 : -20}
                      y={-22}
                      width={loop ? 76 : 40}
                      height={14}
                      rx={3}
                      fill="#05070a"
                      stroke="#22c55e"
                      strokeWidth={1}
                      opacity={0.9}
                    />
                    <text
                      x={0}
                      y={-13}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={8.5}
                      fontWeight="bold"
                      fill="#4ade80"
                    >
                      {loop ? 'Старт / финиш' : 'Старт'}
                    </text>
                  </>
                )}
              </g>
            )}

            {/* Finish Marker (only if linear route) */}
            {!loop && finishPt && mode !== 'thumb' && (
              <g transform={`translate(${finishPt[0]}, ${finishPt[1]}) scale(${px})`}>
                <rect x={-3.5} y={-3.5} width={7} height={7} rx={1.5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                <rect x={-20} y={-22} width={40} height={14} rx={3} fill="#05070a" stroke="#ef4444" strokeWidth={1} opacity={0.9} />
                <text
                  x={0}
                  y={-13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={8.5}
                  fontWeight="bold"
                  fill="#f87171"
                >
                  Финиш
                </text>
              </g>
            )}
          </>
        )}
      </svg>

      {/* Center Notice: if points < 2 during recording */}
      {mode === 'live_record' && mapPoints.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-[#05070a]/90 border border-cyan-800/60 text-cyan-200 px-3.5 py-2 rounded-lg text-xs font-mono text-center shadow-xl">
            Беги по месту фарма — линия появится через пару секунд
          </div>
        </div>
      )}

      {/* Center Loading banner for map */}
      {mapImage?.status === 'loading' && mode !== 'thumb' && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#05070a]/85 border border-zinc-700/80 px-3 py-1.5 rounded-md text-[11px] font-mono text-zinc-300 flex items-center gap-2 shadow-lg pointer-events-none">
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>Загружаю карту зоны… (первый раз до 20 с)</span>
        </div>
      )}

      {/* Corner Controls (Zoom, Full Map, Reset) — hidden in thumb mode */}
      {mode !== 'thumb' && (
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#06080d]/80 border border-zinc-800/80 p-1 rounded-lg backdrop-blur-xs">
          <button
            type="button"
            onClick={() => handleZoom(0.75)}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
            title="Приблизить (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoom(1.33)}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
            title="Отдалить (−)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleShowFullMap}
            className="px-1.5 h-6 rounded text-[10px] font-mono font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 flex items-center gap-1 transition-colors"
            title="Показать всю карту зоны"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Вся зона</span>
          </button>
          <button
            type="button"
            onClick={handleResetFrame}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800/80 transition-colors"
            title="Вернуть к маршруту"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Attribution & Error label in bottom right corner */}
      {mode !== 'thumb' && (
        <div className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded bg-black/75 border border-zinc-800/70 text-[9px] font-mono text-zinc-400 select-none pointer-events-none">
          {mapImage?.status === 'ready' && mapImage.source ? (
            <span>Карта: {mapImage.source} · wago.tools</span>
          ) : mapImage?.status === 'error' ? (
            <span className="text-zinc-500">{mapImage.error || 'Карта недоступна'}</span>
          ) : (
            <span>wago.tools</span>
          )}
        </div>
      )}
    </div>
  );
};
