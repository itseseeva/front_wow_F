import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, MapPin } from 'lucide-react';
import { SpecularButton } from './ui/Specular';
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

  // Reset to original 1x scale and centered pan
  const handleReset = useCallback(() => {
    soundFx.playClick();
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard navigation: Esc to close
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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[120] bg-black/92 backdrop-blur-md flex flex-col select-none overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Top Header Bar */}
      <div
        className="w-full px-4 py-3 flex items-center justify-between z-10 border-b border-white/[0.08] bg-zinc-950/80 backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/[0.08] text-xs font-mono text-zinc-300">
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

        {/* Center Zoom Controls */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            onClick={() => {
              soundFx.playClick();
              setScale((prev) => Math.max(1, prev * 0.8));
              if (scale <= 1.25) setPan({ x: 0, y: 0 });
            }}
            disabled={scale <= 1}
            className="p-1.5 rounded-md border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            title={isRu ? 'Отдалить' : 'Zoom out'}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="px-2 py-1 min-w-[54px] text-center rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-mono tabular-nums text-zinc-300 font-semibold">
            {scale.toFixed(1)}×
          </span>

          <button
            onClick={() => {
              soundFx.playClick();
              setScale((prev) => Math.min(6, prev * 1.25));
            }}
            disabled={scale >= 6}
            className="p-1.5 rounded-md border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
            title={isRu ? 'Приблизить' : 'Zoom in'}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {scale > 1.05 && (
            <button
              onClick={handleReset}
              className="p-1.5 rounded-md border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors ml-1"
              title={isRu ? 'Сбросить масштаб (1×)' : 'Reset zoom (1×)'}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Close Button */}
        <div className="flex items-center gap-2">
          <SpecularButton
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.12] text-xs font-mono text-zinc-200 hover:text-white cursor-pointer transition-all"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isRu ? 'Закрыть' : 'Close'}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">(Esc)</span>
          </SpecularButton>
        </div>
      </div>

      {/* Main Interactive Canvas Area */}
      <div
        className={`flex-1 relative flex items-center justify-center ${
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
          <img
            src={image}
            alt={routeName || 'Session Heatmap'}
            draggable={false}
            className="max-w-[92vw] max-h-[82vh] w-auto h-auto object-contain rounded shadow-2xl border border-white/[0.1]"
          />
        </div>
      </div>

      {/* Bottom Hint Banner */}
      <div
        className="w-full px-4 py-2 border-t border-white/[0.06] bg-zinc-950/70 text-center z-10"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-mono text-zinc-400">
          {isRu
            ? 'Колёсико — масштаб (1×–6×) • перетаскивание — сдвиг • 2x клик — сброс • Esc — закрыть'
            : 'Mouse wheel — zoom (1×–6×) • Drag — pan • Double-click — reset • Esc — close'}
        </p>
      </div>
    </div>
  );
};
