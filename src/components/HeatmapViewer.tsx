import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin, Loader2 } from 'lucide-react';
import { HeatmapMark, HeatmapSavings, HeatmapTimeline, PassInfo } from '../types';
import { soundFx } from '../utils/audio';
import {
  HeatmapMarksSvg,
  HeatmapMarkTooltip,
  HeatmapLayerControlsAndStats,
  HeatmapSavingsBanner,
  HeatmapTimelineBar,
  useHeatmapLayers,
  useHeatmapPlayback,
} from './HeatmapMarksOverlay';

export interface HeatmapFocusRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MAX_ZOOM = 12;

interface HeatmapViewerProps {
  image?: string;
  routeName?: string;
  width?: number;
  height?: number;
  focus?: HeatmapFocusRect | null;
  marks?: HeatmapMark[] | null;
  timeline?: HeatmapTimeline | null;
  savings?: HeatmapSavings | null;
  onClose: () => void;
  language?: 'ru' | 'en';
  passes?: number;
  selectedPassIndex?: number | null;
  onSelectPassIndex?: (pass: number | null) => void;
  activePassInfo?: PassInfo | null;
  isLoading?: boolean;
  emptyMessage?: string;
}

function formatPassDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
  image,
  routeName,
  width,
  height,
  focus = null,
  marks = null,
  timeline = null,
  savings = null,
  onClose,
  language = 'ru',
  passes = 0,
  selectedPassIndex = null,
  onSelectPassIndex,
  activePassInfo = null,
  isLoading = false,
  emptyMessage,
}) => {
  const isRu = language === 'ru';
  const hasMarks = Array.isArray(marks);
  const hasTimeline = Boolean(timeline && timeline.pts && timeline.pts.length > 0 && timeline.end_s > 0);
  const hasSavings = Boolean(savings && (savings.total_s > 0 || savings.detours > 0));
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Canvas & image intrinsic size tracking for exact pixel-locked SVG overlay
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({
    w: width && width > 0 ? width : 0,
    h: height && height > 0 ? height : 0,
  });

  // Interactive layer toggles, timeline playback & hover tooltip
  const [layers, toggleLayer] = useHeatmapLayers();
  const { currentT, isPlaying, togglePlay, seekTo } = useHeatmapPlayback(timeline);
  const [hoveredMark, setHoveredMark] = useState<HeatmapMark | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // References to keep event handlers fresh without re-subscribing
  const scaleRef = useRef<number>(scale);
  scaleRef.current = scale;
  const panRef = useRef<{ x: number; y: number }>(pan);
  panRef.current = pan;
  const focusRef = useRef<HeatmapFocusRect | null>(focus);
  focusRef.current = focus;

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);

  // Observe canvas container dimensions
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize((prev) =>
        Math.abs(prev.w - rect.width) < 0.5 && Math.abs(prev.h - rect.height) < 0.5
          ? prev
          : { w: rect.width, h: rect.height }
      );
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasMarks, hasTimeline, hasSavings, passes]);

  // Keep naturalSize aligned with props if image changes
  useEffect(() => {
    setHoveredMark(null);
    setHoveredKey(null);
    setCursorPos(null);
    if (width && width > 0 && height && height > 0) {
      setNaturalSize({ w: width, h: height });
    }
  }, [image, width, height]);

  // Compute exact fitted image box at scale = 1 inside canvasRef
  let dispW = 0;
  let dispH = 0;
  if (canvasSize.w > 0 && canvasSize.h > 0 && naturalSize.w > 0 && naturalSize.h > 0) {
    const padX = Math.min(24, canvasSize.w * 0.04);
    const padY = Math.min(18, canvasSize.h * 0.04);
    const availW = Math.max(1, canvasSize.w - padX * 2);
    const availH = Math.max(1, canvasSize.h - padY * 2);
    const fit = Math.min(2, availW / naturalSize.w, availH / naturalSize.h);
    dispW = Math.max(1, naturalSize.w * fit);
    dispH = Math.max(1, naturalSize.h * fit);
  }

  const dispSizeRef = useRef<{ w: number; h: number }>({ w: dispW, h: dispH });
  dispSizeRef.current = { w: dispW, h: dispH };

  // Compute and apply scale & pan so that `focus` rect fills ~85% of the canvas area centered.
  // When focus is null/absent, displays the full map cleanly at scale 1.
  const applyFocus = useCallback((targetFocus: HeatmapFocusRect | null) => {
    if (!targetFocus || targetFocus.w <= 0 || targetFocus.h <= 0) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerW = canvasRect.width;
    const containerH = canvasRect.height;
    if (containerW <= 0 || containerH <= 0) return;

    // Untransformed (scale=1) rendered image size & position inside canvas
    let w = dispSizeRef.current.w;
    let h = dispSizeRef.current.h;
    let imgLeft: number;
    let imgTop: number;

    if (w > 0 && h > 0) {
      imgLeft = (containerW - w) / 2;
      imgTop = (containerH - h) / 2;
    } else if (scaleRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
      const imgRect = img.getBoundingClientRect();
      w = imgRect.width;
      h = imgRect.height;
      imgLeft = imgRect.left - canvasRect.left;
      imgTop = imgRect.top - canvasRect.top;
    } else {
      const stage = stageRef.current;
      w = img.offsetWidth;
      h = img.offsetHeight;
      imgLeft = (stage ? stage.offsetLeft : 0) + img.offsetLeft;
      imgTop = (stage ? stage.offsetTop : 0) + img.offsetTop;
    }

    if (w <= 0 || h <= 0) return;

    const focusW = targetFocus.w * w;
    const focusH = targetFocus.h * h;
    if (focusW <= 0 || focusH <= 0) return;

    const nextScale = Math.min(
      MAX_ZOOM,
      Math.max(1, 0.85 * Math.min(containerW / focusW, containerH / focusH))
    );

    if (nextScale <= 1.001) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Center of focus rect inside canvas at scale=1
    const cx = imgLeft + (targetFocus.x + targetFocus.w / 2) * w;
    const cy = imgTop + (targetFocus.y + targetFocus.h / 2) * h;

    // With transformOrigin '0 0' on the full-size canvas wrapper:
    // screenPos = pan + scale * localPos => pan = containerCenter - scale * focusCenter
    const nextPanX = containerW / 2 - nextScale * cx;
    const nextPanY = containerH / 2 - nextScale * cy;

    setScale(nextScale);
    setPan({ x: nextPanX, y: nextPanY });
  }, []);

  // Re-apply focus whenever focus or image changes (e.g., switching pass or session)
  const focusX = focus?.x;
  const focusY = focus?.y;
  const focusW = focus?.w;
  const focusH = focus?.h;

  useEffect(() => {
    if (!image) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    if (!focus) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      const rafId = requestAnimationFrame(() => applyFocus(focusRef.current));
      return () => cancelAnimationFrame(rafId);
    }
  }, [image, focusX, focusY, focusW, focusH, passes, dispW, dispH, applyFocus]);

  const handleImgLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const el = e.currentTarget;
      if (el.naturalWidth > 0 && el.naturalHeight > 0) {
        setNaturalSize((prev) =>
          prev.w === el.naturalWidth && prev.h === el.naturalHeight
            ? prev
            : { w: el.naturalWidth, h: el.naturalHeight }
        );
      }
      requestAnimationFrame(() => applyFocus(focusRef.current));
    },
    [applyFocus]
  );

  // Reset to original 1x scale and centered pan
  const handleReset = useCallback(() => {
    soundFx.playClick();
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom around canvas center for +/- buttons
  const zoomAroundCenter = useCallback((factor: number) => {
    const currentScale = scaleRef.current;
    const currentPan = panRef.current;
    const nextScale = Math.min(MAX_ZOOM, Math.max(1, currentScale * factor));
    if (nextScale === currentScale) return;

    if (nextScale <= 1.001) {
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const ratio = nextScale / currentScale;
      setScale(nextScale);
      setPan({
        x: cx - (cx - currentPan.x) * ratio,
        y: cy - (cy - currentPan.y) * ratio,
      });
    } else {
      setScale(nextScale);
    }
  }, []);

  // Keyboard navigation: Esc to close, R/0 to reset, Space to play/pause replay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      } else if (e.key === 'r' || e.key === 'R' || e.key === '0') {
        handleReset();
      } else if (e.key === ' ' && hasTimeline) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleReset, hasTimeline, togglePlay]);

  // Prevent background scroll and attach non-passive wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const canvas = canvasRef.current || container;
      const rect = canvas.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentPan = panRef.current;

      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
      const nextScale = Math.min(MAX_ZOOM, Math.max(1, currentScale * zoomFactor));

      if (nextScale === currentScale) return;

      if (nextScale <= 1.001) {
        setScale(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      // Keep point under cursor invariant
      const ratio = nextScale / currentScale;
      const nextPanX = cursorX - (cursorX - currentPan.x) * ratio;
      const nextPanY = cursorY - (cursorY - currentPan.y) * ratio;

      setScale(nextScale);
      setPan({ x: nextPanX, y: nextPanY });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const nextPanX = e.clientX - dragStartRef.current.x;
    const nextPanY = e.clientY - dragStartRef.current.y;
    setPan({ x: nextPanX, y: nextPanY });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleReset();
  };

  const updateCursorFromEvent = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setCursorPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleHoverMark = useCallback(
    (mark: HeatmapMark | null, key: string | null, e?: React.MouseEvent) => {
      setHoveredMark(mark);
      setHoveredKey(key);
      if (mark && e) {
        updateCursorFromEvent(e);
      } else if (!mark) {
        setCursorPos(null);
      }
    },
    [updateCursorFromEvent]
  );

  const handleMoveMark = useCallback(
    (e: React.MouseEvent) => {
      if (!isDraggingRef.current) {
        updateCursorFromEvent(e);
      }
    },
    [updateCursorFromEvent]
  );

  const viewerContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-[#09090b] flex flex-col select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar: 100% Solid Opaque Zinc-950 */}
      <div
        className="w-full h-14 px-4 sm:px-6 flex items-center justify-between z-20 border-b border-white/[0.08] bg-[#09090b] shrink-0 relative"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Left Slot: Route Info */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-zinc-300">
            <MapPin className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-semibold text-white tracking-wide">
              {routeName || (isRu ? 'Маршрут сессии' : 'Session Route')}
            </span>
          </div>

          {width && height && (
            <span className="hidden sm:inline-block text-[11px] font-mono text-zinc-500 tabular-nums">
              {width} × {height} px
            </span>
          )}
        </div>

        {/* Center Slot: Zoom Controls */}
        {image && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 font-mono text-xs z-10">
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                zoomAroundCenter(0.8);
              }}
              disabled={scale <= 1}
              className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-colors"
              title={isRu ? 'Отдалить' : 'Zoom out'}
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="px-2.5 py-1 min-w-[58px] text-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono tabular-nums text-zinc-200 font-semibold">
              {scale.toFixed(1)}×
            </span>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                zoomAroundCenter(1.25);
              }}
              disabled={scale >= MAX_ZOOM}
              className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-colors"
              title={isRu ? 'Приблизить' : 'Zoom in'}
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            {scale > 1.05 && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors ml-1"
                title={isRu ? 'Сбросить масштаб (1×)' : 'Reset zoom (1×)'}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Right Slot: Close Button */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              soundFx.playClick();
              onClose();
            }}
            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-zinc-400 hover:text-white border border-white/[0.1] hover:border-white/20 transition-all cursor-pointer flex items-center justify-center active:scale-95 group"
            title={isRu ? 'Закрыть просмотр (Esc)' : 'Close viewer (Esc)'}
            aria-label={isRu ? 'Закрыть' : 'Close'}
          >
            <X className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200 text-zinc-300 group-hover:text-white" />
          </button>
        </div>
      </div>

      {/* Optional Passes Selector Sub-bar */}
      {passes > 0 && onSelectPassIndex && (
        <div
          className="w-full px-4 sm:px-6 py-2 border-b border-white/[0.06] bg-[#09090b] flex flex-wrap items-center justify-between gap-2 z-20 shrink-0 font-mono"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider pr-1 shrink-0">
              {isRu ? 'Проход:' : 'Pass:'}
            </span>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onSelectPassIndex(null);
              }}
              className={`px-2.5 py-1 rounded-md border text-xs transition-all cursor-pointer shrink-0 ${
                selectedPassIndex === null
                  ? 'border-white bg-white/10 text-white font-semibold'
                  : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
              }`}
            >
              {isRu ? 'Все' : 'All'}
            </button>

            {Array.from({ length: passes }).map((_, idx) => {
              const passNum = idx + 1;
              const isPassSelected = selectedPassIndex === passNum;
              return (
                <button
                  key={passNum}
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onSelectPassIndex(passNum);
                  }}
                  className={`min-w-[28px] px-2 py-1 rounded-md border text-xs text-center transition-all cursor-pointer shrink-0 ${
                    isPassSelected
                      ? 'border-white bg-white/10 text-white font-semibold'
                      : 'border-white/10 text-zinc-400 hover:text-white hover:border-white/20'
                  }`}
                >
                  {passNum}
                </button>
              );
            })}
          </div>

          {activePassInfo && (
            <div className="text-[11px] text-zinc-400 flex items-center gap-2">
              <span>
                {isRu ? `проход ${activePassInfo.index}: ` : `pass ${activePassInfo.index}: `}
                <strong className="text-zinc-200">
                  {activePassInfo.direction === 'forward'
                    ? (isRu ? 'туда' : 'forward')
                    : activePassInfo.direction === 'back'
                    ? (isRu ? 'обратно' : 'back')
                    : (isRu ? 'круг' : 'loop')}
                </strong>
                {' · '}
                {formatPassDuration(activePassInfo.duration_s)}
                {' · '}
                {isRu ? `узлов ${activePassInfo.nodes}` : `nodes ${activePassInfo.nodes}`}
                {' · '}
                {isRu ? `упоров ${activePassInfo.stucks}` : `stucks ${activePassInfo.stucks}`}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Savings Banner Above Map */}
      {image && hasSavings && (
        <div
          className="w-full px-4 sm:px-6 pt-2.5 pb-1 bg-[#09090b] z-20 shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <HeatmapSavingsBanner savings={savings} language={language} variant="dark" />
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <div
        ref={canvasRef}
        className={`flex-1 min-h-0 relative flex items-center justify-center overflow-hidden bg-[#09090b] ${
          !image ? 'cursor-default' : isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-default'
        }`}
        onDoubleClick={handleDoubleClick}
        onMouseLeave={() => {
          setHoveredMark(null);
          setHoveredKey(null);
          setCursorPos(null);
        }}
      >
        {image ? (
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: 'none',
            }}
            className={`relative w-full h-full flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isLoading ? 'opacity-40 grayscale' : 'opacity-100'
            }`}
          >
            <div
              ref={stageRef}
              style={dispW > 0 && dispH > 0 ? { width: `${dispW}px`, height: `${dispH}px` } : undefined}
              className="relative shrink-0 flex items-center justify-center"
            >
              <img
                ref={imgRef}
                src={image}
                alt={routeName || 'Session Heatmap'}
                draggable={false}
                onLoad={handleImgLoad}
                className={
                  dispW > 0 && dispH > 0
                    ? 'w-full h-full block object-contain select-none'
                    : 'max-w-[92vw] max-h-[75vh] w-auto h-auto object-contain block select-none'
                }
              />

              {(hasMarks || hasTimeline) && dispW > 0 && dispH > 0 && (
                <HeatmapMarksSvg
                  marks={marks}
                  timeline={timeline}
                  currentT={currentT}
                  isPlaying={isPlaying}
                  layers={layers}
                  width={dispW}
                  height={dispH}
                  scale={scale}
                  language={language}
                  hoveredKey={isDragging ? null : hoveredKey}
                  onHoverMark={handleHoverMark}
                  onMoveMark={handleMoveMark}
                />
              )}
            </div>
          </div>
        ) : !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center px-6 font-mono">
            <MapPin className="w-8 h-8 text-zinc-600" />
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              {emptyMessage || (isRu ? 'Карта маршрута недоступна' : 'Route heatmap is unavailable')}
            </p>
          </div>
        ) : null}

        {/* Hover tooltip clamped inside canvas bounds */}
        {hasMarks && !isDragging && (
          <HeatmapMarkTooltip
            mark={hoveredMark}
            cursor={cursorPos}
            containerWidth={canvasSize.w}
            containerHeight={canvasSize.h}
            language={language}
          />
        )}

        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none font-mono">
            <Loader2 className="w-7 h-7 animate-spin text-zinc-200 drop-shadow" />
            {!image && (
              <span className="text-xs text-zinc-400">
                {isRu ? 'Загрузка карты...' : 'Loading map...'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls & Hint Banner */}
      <div
        className="w-full px-4 sm:px-6 py-2.5 border-t border-white/[0.08] bg-[#09090b] flex flex-col items-center gap-2.5 z-20 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {image && hasTimeline && timeline && (
          <HeatmapTimelineBar
            timeline={timeline}
            marks={marks}
            layers={layers}
            currentT={currentT}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            language={language}
            variant="dark"
          />
        )}

        {image && hasMarks && marks && (
          <HeatmapLayerControlsAndStats
            marks={marks}
            layers={layers}
            onToggleLayer={toggleLayer}
            language={language}
            variant="dark"
          />
        )}

        <p className="text-[11px] font-mono text-zinc-500 text-center">
          {image
            ? (isRu
                ? 'Колёсико — масштаб (1×–12×) • Перетаскивание мышью — сдвиг • 2× клик — сброс • Esc — закрыть'
                : 'Mouse wheel — zoom (1×–12×) • Mouse drag — pan • Double-click — reset • Esc — close')
            : (isRu ? 'Esc — закрыть' : 'Esc — close')}
        </p>
      </div>
    </div>
  );

  return createPortal(viewerContent, document.body);
};
