import React, { useState, useEffect } from 'react';
import { RouteInfo, RoutePreview } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { mockGetRoutePreview } from '../data/mockRoutes';
import { X, Play, Pause, Loader2, Sparkles, Map, Repeat, ArrowRight } from 'lucide-react';

interface RoutePreviewModalProps {
  route: RouteInfo | null;
  onClose: () => void;
  onError: (msg: string) => void;
}

const PATH_COLORS = ['#38bdf8', '#c084fc', '#f59e0b'];

export const RoutePreviewModal: React.FC<RoutePreviewModalProps> = ({
  route,
  onClose,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RoutePreview | null>(null);
  const [activePathIndex, setActivePathIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!route) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchPreview = async () => {
      try {
        let res;
        if (window.pywebview?.api?.get_route_preview) {
          res = await window.pywebview.api.get_route_preview(route.id);
        } else {
          res = await mockGetRoutePreview(route.id);
        }

        if (isMounted) {
          if (res.ok && res.preview) {
            setPreview(res.preview);
          } else {
            onError(res.error || 'Не удалось загрузить предпросмотр маршрута');
            onClose();
          }
        }
      } catch (err: any) {
        if (isMounted) {
          onError(err?.message || 'Ошибка загрузки маршрута');
          onClose();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [route]);

  if (!route) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-3 bg-black/85 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-[500px] max-h-[95vh] bg-[#090b10] border border-cyan-900/60 rounded-xl shadow-[0_0_35px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col text-zinc-200">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-[#06080d] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)] shrink-0" />
            <h3 className="text-xs sm:text-[13px] font-mono font-black text-zinc-100 truncate">
              {route.name}
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-900/50 text-cyan-300 shrink-0">
              {route.loop ? 'Круг' : 'Туда-обратно'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">Генерация симуляции обхода...</span>
          </div>
        ) : preview ? (
          <div className="p-3 space-y-2.5 flex flex-col min-h-0 overflow-y-auto">
            {/* Metadata pills */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-[#05070a] px-2.5 py-1.5 rounded-lg border border-zinc-800/70">
              <span className="flex items-center gap-1">
                <Map className="w-3 h-3 text-cyan-400" />
                <span>Карта: {route.map_id ?? 'Auto'}</span>
              </span>
              <span>Точек: <strong className="text-zinc-200">{route.points}</strong></span>
              <span>Длина: <strong className="text-amber-300">{route.length_s} с</strong></span>
            </div>

            {/* Interactive Canvas */}
            <div className="h-48 sm:h-52 w-full bg-[#05070b] border border-cyan-900/40 rounded-lg overflow-hidden relative shadow-inner">
              <RouteCanvas
                points={preview.points}
                paths={preview.paths}
                activePathIndex={activePathIndex}
                isPaused={isPaused}
                aspect={preview.aspect || 1.5}
                loop={preview.route.loop}
                mode="preview"
              />
            </div>

            {/* Control Bar: Play/Pause and Path variants */}
            <div className="flex items-center justify-between gap-2 bg-[#06080d] p-1.5 rounded-lg border border-zinc-800/70">
              {/* Play / Pause Toggle */}
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                  isPaused
                    ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 hover:bg-amber-900/40'
                    : 'bg-[#080d15] border-cyan-900/60 text-cyan-300 hover:border-cyan-400'
                }`}
              >
                {isPaused ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3 fill-current" />}
                <span>{isPaused ? 'Возобновить' : 'Пауза'}</span>
              </button>

              {/* 3 Path Variation Switchers */}
              <div className="flex items-center gap-1">
                {(preview.paths || []).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActivePathIndex(idx)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                      activePathIndex === idx
                        ? 'border-cyan-400 bg-[#0c1626] text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                        : 'border-zinc-800 bg-[#05070a] text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: PATH_COLORS[idx % PATH_COLORS.length] }}
                    />
                    <span>Пример {idx + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Explanatory Footer Text */}
            <div className="bg-[#05080f] border border-cyan-900/30 p-2 rounded-lg text-[10px] font-mono text-zinc-400 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                Бот каждый круг выбирает случайные отклонения, паузы и обходы, чтобы поведение выглядело живым.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
