import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin, Loader2 } from 'lucide-react';
import { PassInfo } from '../types';
import { soundFx } from '../utils/audio';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // References to keep event handlers fresh without re-subscribing
  const scaleRef = useRef<number>(scale);
  scaleRef.current = scale;
  const panRef = useRef<{ x: number; y: number }>(pan);
  panRef.current = pan;
  const focusRef = useRef<HeatmapFocusRect | null>(focus);
  focusRef.current = focus;

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);

  // Compute and apply scale & pan so that `focus` rect fills ~85% of the canvas area centered
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
    let dispW: number;
    let dispH: number;
    let imgLeft: number;
    let imgTop: number;

    if (scaleRef.current === 1 && panRef.current.x === 0 && panRef.current.y === 0) {
      const imgRect = img.getBoundingClientRect();
      dispW = imgRect.width;
      dispH = imgRect.height;
      imgLeft = imgRect.left - canvasRect.left;
      imgTop = imgRect.top - canvasRect.top;
    } else {
      dispW = img.offsetWidth;
      dispH = img.offsetHeight;
      imgLeft = img.offsetLeft;
      imgTop = img.offsetTop;
    }

    if (dispW <= 0 || dispH <= 0) return;

    const focusW = targetFocus.w * dispW;
    const focusH = targetFocus.h * dispH;
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
    const cx = imgLeft + (targetFocus.x + targetFocus.w / 2) * dispW;
    const cy = imgTop + (targetFocus.y + targetFocus.h / 2) * dispH;

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
  }, [image, focusX, focusY, focusW, focusH, passes, applyFocus]);

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

  // Keyboard navigation: Esc to close, R to reset
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      } else if (e.key === 'r' || e.key === 'R' || e.key === '0') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleReset]);

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

      // Smooth zoom factor
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
    if (e.button !== 0) return; // Only primary mouse button
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

  const viewerContent = (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[99999] bg-[#09090b] flex flex-col select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar: 100% Solid Opaque Zinc-950, cleanly partitioned into Left, Center, and Right */}
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

        {/* Center Slot: Zoom Controls (strictly centered, far away from corners) */}
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

        {/* Right Slot: Standalone Isolated Close Button - strictly on its own */}
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

      {/* Main Interactive Canvas Area */}
      <div
        ref={canvasRef}
        className={`flex-1 relative flex items-center justify-center overflow-hidden bg-[#09090b] ${
          !image ? 'cursor-default' : isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-default'
        }`}
        onDoubleClick={handleDoubleClick}
      >
        {image ? (
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.05s ease-out',
            }}
            className={`relative w-full h-full flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isLoading ? 'opacity-40 grayscale' : 'opacity-100'
            }`}
          >
            <img
              ref={imgRef}
              src={image}
              alt={routeName || 'Session Heatmap'}
              draggable={false}
              onLoad={() => applyFocus(focusRef.current)}
              className={`max-w-[92vw] ${passes > 0 ? 'max-h-[77vh]' : 'max-h-[82vh]'} w-auto h-auto object-contain select-none`}
            />
          </div>
        ) : !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 text-center px-6 font-mono">
            <MapPin className="w-8 h-8 text-zinc-600" />
            <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
              {emptyMessage || (isRu ? 'Карта маршрута недоступна' : 'Route heatmap is unavailable')}
            </p>
          </div>
        ) : null}

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

      {/* Bottom Hint Banner: 100% Solid Opaque Zinc-950 */}
      <div
        className="w-full py-2.5 border-t border-white/[0.08] bg-[#09090b] text-center z-20 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-mono text-zinc-500">
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
