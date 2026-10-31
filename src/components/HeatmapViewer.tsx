import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface HeatmapViewerProps {
  image: string;
  routeName?: string;
  width?: number;
  height?: number;
  onClose: () => void;
  language?: 'ru' | 'en';
}

export const HeatmapViewer: React.FC<HeatmapViewerProps> = ({
  image,
  routeName,
  width,
  height,
  onClose,
  language = 'ru',
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
  const hasBackendPanel = Boolean(!image.includes('EZF') && (width ? width > 1300 : true));

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

      {/* Main Interactive Canvas Area */}
      <div
        className={`flex-1 relative flex items-center justify-center overflow-hidden bg-[#09090b] ${
          isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-default'
        }`}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.05s ease-out',
          }}
          className="relative max-w-full max-h-full flex items-center justify-center pointer-events-none"
        >
          {hasBackendPanel ? (
            /* Clean map portion: right 22.5% info panel is completely cut out */
            <div
              className="relative overflow-hidden rounded-lg flex items-center justify-start bg-transparent"
              style={{
                height: '82vh',
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
              className="max-w-[92vw] max-h-[82vh] w-auto h-auto object-contain select-none"
            />
          )}
        </div>
      </div>

      {/* Bottom Hint Banner: 100% Solid Opaque Zinc-950 */}
      <div
        className="w-full py-2.5 border-t border-white/[0.08] bg-[#09090b] text-center z-20 shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-mono text-zinc-500">
          {isRu
            ? 'Колёсико — масштаб (1×–6×) • Перетаскивание мышью — сдвиг • 2× клик — сброс • Esc — закрыть'
            : 'Mouse wheel — zoom (1×–6×) • Mouse drag — pan • Double-click — reset • Esc — close'}
        </p>
      </div>
    </div>
  );

  return createPortal(viewerContent, document.body);
};
