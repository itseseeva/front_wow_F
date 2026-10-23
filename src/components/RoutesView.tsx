import React, { useState, useEffect, useCallback } from 'react';
import { RouteInfo } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { RouteRecordModal } from './RouteRecordModal';
import { RoutePreviewModal } from './RoutePreviewModal';
import {
  mockListRoutes,
  mockSetActiveRoute,
  mockDeleteRoute,
} from '../data/mockRoutes';
import {
  Compass,
  Plus,
  Play,
  Eye,
  Trash2,
  CheckCircle,
  Circle,
  Clock,
  MapPin,
  Repeat,
  Sparkles,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface RoutesViewProps {
  isBotRunning: boolean;
  onToast: (msg: string) => void;
  onError: (msg: string) => void;
}

export const RoutesView: React.FC<RoutesViewProps> = ({
  isBotRunning,
  onToast,
  onError,
}) => {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [previewRoute, setPreviewRoute] = useState<RouteInfo | null>(null);

  // Fetch routes from pywebview or mock
  const fetchRoutes = useCallback(async () => {
    try {
      let res;
      if (window.pywebview?.api?.list_routes) {
        res = await window.pywebview.api.list_routes();
      } else {
        res = await mockListRoutes();
      }

      if (res.ok) {
        setRoutes(res.routes || []);
        setActiveId(res.active_id ?? null);
      } else {
        onError(res.error || 'Не удалось загрузить список маршрутов');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка загрузки маршрутов');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  // Set active route (or null for auto)
  const handleSetActive = async (id: string | null) => {
    try {
      let res;
      if (window.pywebview?.api?.set_active_route) {
        res = await window.pywebview.api.set_active_route(id);
      } else {
        res = await mockSetActiveRoute(id);
      }

      if (res.ok) {
        setActiveId(id);
        setRoutes((prev) =>
          prev.map((r) => ({
            ...r,
            active: id === null ? false : r.id === id,
          }))
        );
        onToast(id ? 'Маршрут выбран основным' : 'Включён автовыбор маршрута');
      } else {
        onError(res.error || 'Ошибка выбора маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка выбора маршрута');
    }
  };

  // Delete route with confirmation
  const handleDelete = async (route: RouteInfo) => {
    if (!window.confirm(`Удалить маршрут «${route.name}»?`)) return;

    try {
      let res;
      if (window.pywebview?.api?.delete_route) {
        res = await window.pywebview.api.delete_route(route.id);
      } else {
        res = await mockDeleteRoute(route.id);
      }

      if (res.ok) {
        onToast(`Маршрут «${route.name}» удалён`);
        fetchRoutes();
      } else {
        onError(res.error || 'Не удалось удалить маршрут');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка при удалении маршрута');
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full animate-fadeIn select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/60 shrink-0">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-[11px] font-mono font-black uppercase tracking-wider text-zinc-200">
            Маршруты фарма
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-[#070b12] border border-cyan-900/60 text-cyan-300">
            {routes.length}
          </span>
        </div>

        {/* Record Route Button */}
        <button
          type="button"
          onClick={() => {
            if (isBotRunning) {
              onError('Идёт сессия бота — сначала нажмите Стоп');
              return;
            }
            setIsRecordModalOpen(true);
          }}
          disabled={isBotRunning}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono font-black tracking-wider uppercase border transition-all cursor-pointer active:scale-95 ${
            isBotRunning
              ? 'opacity-50 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-500'
              : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)]'
          }`}
          title={isBotRunning ? 'Идёт сессия бота — сначала нажмите Стоп' : 'Записать новый маршрут в игре'}
        >
          <Plus className="w-3 h-3 stroke-[3]" />
          <span>Записать маршрут</span>
        </button>
      </div>

      {/* Auto-mode banner */}
      <div className="mb-2 px-2.5 py-1.5 rounded-lg bg-[#070a10] border border-zinc-800/80 flex items-center justify-between text-[10px] font-mono shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSetActive(null)}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-cyan-300 cursor-pointer"
          >
            {activeId === null ? (
              <CheckCircle className="w-3.5 h-3.5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
            ) : (
              <Circle className="w-3.5 h-3.5 text-zinc-600" />
            )}
            <span className="font-bold">Автовыбор:</span>
          </button>
          <span className="text-zinc-400">ближайший маршрут своей карты</span>
        </div>
        {activeId === null && (
          <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
            АКТИВЕН
          </span>
        )}
      </div>

      {/* Route list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 min-h-0">
        {loading ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono text-zinc-400">Загрузка маршрутов...</span>
          </div>
        ) : routes.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-[#070a10] border border-zinc-800/70 space-y-2">
            <Compass className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs font-mono font-bold text-zinc-300">Маршруты пока не созданы</p>
            <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
              Нажмите «Записать маршрут», зайдите в игру и пробегите желаемую траекторию фарма.
            </p>
          </div>
        ) : (
          routes.map((route) => {
            const isSelected = activeId === route.id;

            return (
              <div
                key={route.id}
                className={`p-2 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                  isSelected
                    ? 'bg-[#0a101d] border-cyan-500/70 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
                    : 'bg-[#07090e] border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Left: Thumbnail Canvas */}
                <div
                  onClick={() => setPreviewRoute(route)}
                  className="w-16 h-12 rounded-lg bg-[#040508] border border-cyan-900/40 overflow-hidden cursor-pointer shrink-0 relative group"
                  title="Нажмите для предпросмотра"
                >
                  <RouteCanvas
                    points={route.thumb && route.thumb.length > 0 ? route.thumb : []}
                    mode="thumb"
                    loop={route.loop}
                    aspect={1.5}
                  />
                  <div className="absolute inset-0 bg-cyan-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Eye className="w-3.5 h-3.5 text-cyan-300" />
                  </div>
                </div>

                {/* Middle: Details & Active Toggle */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-[11px] sm:text-xs font-mono font-bold text-zinc-100 truncate">
                      {route.name}
                    </h4>
                    {route.loop ? (
                      <span className="text-[8.5px] px-1 py-0.2 rounded bg-amber-950/40 text-amber-300 border border-amber-800/40 shrink-0">
                        Круг
                      </span>
                    ) : (
                      <span className="text-[8.5px] px-1 py-0.2 rounded bg-purple-950/40 text-purple-300 border border-purple-800/40 shrink-0">
                        Линия
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2 text-[9px] font-mono text-zinc-400 mt-0.5">
                    <span>Карта: {route.map_id ?? 'Auto'}</span>
                    <span>•</span>
                    <span>{route.points} точек</span>
                    <span>•</span>
                    <span className="text-amber-400/90">{route.length_s} с</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Select as Primary */}
                  <button
                    type="button"
                    onClick={() => handleSetActive(route.id)}
                    className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                        : 'bg-[#05070a] border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                    title="Сделать этот маршрут основным"
                  >
                    {isSelected ? (
                      <CheckCircle className="w-3 h-3 text-cyan-400" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    <span>{isSelected ? 'Основной' : 'Выбрать'}</span>
                  </button>

                  {/* Preview Modal Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewRoute(route)}
                    className="w-7 h-7 rounded-md bg-[#05070a] border border-zinc-800 hover:border-cyan-500/60 text-zinc-400 hover:text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
                    title="Просмотреть симуляцию обхода"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDelete(route)}
                    className="w-7 h-7 rounded-md bg-[#05070a] border border-zinc-800 hover:border-rose-500/60 text-zinc-400 hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                    title="Удалить маршрут"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Record Modal */}
      <RouteRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onRouteSaved={(newRoute) => {
          onToast(`Маршрут «${newRoute.name}» успешно сохранён!`);
          fetchRoutes();
        }}
        onError={onError}
      />

      {/* Preview Modal */}
      <RoutePreviewModal
        route={previewRoute}
        onClose={() => setPreviewRoute(null)}
        onError={onError}
      />
    </div>
  );
};
