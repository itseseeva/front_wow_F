import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin, Loader2 } from 'lucide-react';
import { PassInfo } from '../types';
import { soundFx } from '../utils/audio';

interface HeatmapViewerProps {
  image?: string;
  routeName?: string;
  width?: number;
  height?: number;
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

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // References to keep event handlers fresh without re-subscribing
  const scaleRef = useRef<number>(scale);
  scaleRef.current = scale;
  const panRef = useRef<{ x: number; y: number }>(pan);
  panRef.current = pan;

  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);

  // Backend generated images place a legend on the right ~22.5% of the canvas.
  // When detected, we cleanly crop out the right panel so only the pure map is visible.
  const hasBackendPanel = Boolean(image && !image.includes('EZF') && (width ? width > 1300 : true));

  // Reset to original 1x scale and centered pan
  const handleReset = useCallback(() => {
    soundFx.playClick();
    setScale(1);
    setPan({ x: 0, y: 0 });
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

      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const currentScale = scaleRef.current;
      const currentPan = panRef.current;

      // Smooth zoom factor
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;
      const nextScale = Math.min(6, Math.max(1, currentScale * zoomFactor));

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
                setScale((prev) => Math.max(1, prev * 0.8));
                if (scale <= 1.25) setPan({ x: 0, y: 0 });
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
                setScale((prev) => Math.min(6, prev * 1.25));
              }}
              disabled={scale >= 6}
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
            className={`relative max-w-full max-h-full flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
              isLoading ? 'opacity-40 grayscale' : 'opacity-100'
            }`}
          >
            {hasBackendPanel ? (
              /* Clean map portion: right 22.5% info panel is completely cut out */
              <div
                className="relative overflow-hidden rounded-lg flex items-center justify-start bg-transparent"
                style={{
                  height: passes > 0 ? '77vh' : '82vh',
                  aspectRatio: '0.78',
                  maxWidth: '92vw',
                }}
              >
                <img
                  src={image}
                  alt={routeName || 'Session Heatmap'}
                  draggable={false}
                  className="h-full max-w-none object-cover object-left select-none"
                  style={{
                    width: '128.5%', // 100 / 0.778 ≈ 128.5%
                  }}
                />
              </div>
            ) : (
              /* Standalone map without panel (seamless, no container border) */
              <img
                src={image}
                alt={routeName || 'Session Heatmap'}
                draggable={false}
                className={`max-w-[92vw] ${passes > 0 ? 'max-h-[77vh]' : 'max-h-[82vh]'} w-auto h-auto object-contain select-none`}
              />
            )}
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
                ? 'Колёсико — масштаб (1×–6×) • Перетаскивание мышью — сдвиг • 2× клик — сброс • Esc — закрыть'
                : 'Mouse wheel — zoom (1×–6×) • Mouse drag — pan • Double-click — reset • Esc — close')
            : (isRu ? 'Esc — закрыть' : 'Esc — close')}
        </p>
      </div>
    </div>
  );

  return createPortal(viewerContent, document.body);
};
