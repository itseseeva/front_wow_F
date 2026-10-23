import React, { useState, useEffect } from 'react';
import { RouteInfo, RoutePreview } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetRoutePreview } from '../data/mockRoutes';
import { X, Loader2, MapPin, Navigation, Clock } from 'lucide-react';

interface RoutePreviewModalProps {
  route: RouteInfo | null;
  onClose: () => void;
  onError: (msg: string) => void;
}

export const RoutePreviewModal: React.FC<RoutePreviewModalProps> = ({
  route,
  onClose,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<RoutePreview | null>(null);

  useEffect(() => {
    if (!route) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchPreview = async () => {
      try {
        const api = await getPywebviewApi();
        let res;
        if (api?.get_route_preview) {
          res = await api.get_route_preview(route.id);
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
      <div className="w-full max-w-[500px] max-h-[96vh] bg-[#090b10] border border-cyan-900/60 rounded-xl shadow-[0_0_35px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col text-zinc-200">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-[#06080d] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)] shrink-0" />
            <h3 className="text-xs sm:text-[13px] font-mono font-black text-zinc-100 truncate">
              {route.name}
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-900/50 text-cyan-300 shrink-0">
              {route.loop ? 'Круг' : 'Туда-обратно'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">Загрузка карты и маршрута...</span>
          </div>
        ) : preview ? (
          <div className="p-2.5 sm:p-3 space-y-2 flex flex-col min-h-0">
            {/* Canvas Container */}
            <div className="h-[245px] sm:h-[255px] w-full bg-[#05070b] border border-cyan-900/40 rounded-lg overflow-hidden relative shadow-inner shrink-0">
              <RouteCanvas
                points={preview.points}
                mapId={preview.route.map_id}
                activeVariant={0}
                aspect={preview.aspect || 1.5}
                loop={preview.route.loop}
                mode="preview"
              />
            </div>

            {/* Bottom info bar */}
            <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-mono text-zinc-400 bg-[#05070a] border border-zinc-800/60 rounded-md py-1.5 px-2.5">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>Карта: <strong className="text-cyan-300">{route.map_id ?? '—'}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-zinc-300">
                <Navigation className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span><strong className="text-amber-300">{route.points}</strong> точек</span>
              </div>

              <div className="flex items-center gap-1.5 text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span><strong className="text-emerald-300">≈{route.length_s}</strong> с бега</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
