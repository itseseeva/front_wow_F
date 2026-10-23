import React, { useState, useEffect, useRef } from 'react';
import { RouteInfo, RouteRecordStatus } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockStartRouteRecord,
  mockStopRouteRecord,
  mockGetRouteRecordStatus,
} from '../data/mockRoutes';
import { Radio, AlertTriangle, Square, Check, X, Loader2 } from 'lucide-react';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: RouteInfo) => void;
  onToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

export const RouteRecordModal: React.FC<RouteRecordModalProps> = ({
  isOpen,
  onClose,
  onRouteSaved,
  onToast,
}) => {
  const [routeName, setRouteName] = useState('Маршрут 1');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [status, setStatus] = useState<RouteRecordStatus | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const startRecordApi = async (name: string) => {
    const api = await getPywebviewApi();
    if (api?.start_route_record) {
      return await api.start_route_record(name);
    }
    return await mockStartRouteRecord(name);
  };

  const stopRecordApi = async (save: boolean) => {
    const api = await getPywebviewApi();
    if (api?.stop_route_record) {
      return await api.stop_route_record(save);
    }
    return await mockStopRouteRecord(save);
  };

  const getStatusApi = async (): Promise<RouteRecordStatus> => {
    const api = await getPywebviewApi();
    if (api?.get_route_record_status) {
      return await api.get_route_record_status();
    }
    return await mockGetRouteRecordStatus();
  };

  // Poll status while recording is active
  useEffect(() => {
    if (!isOpen || !status?.recording) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const s = await getStatusApi();
        if (s) {
          setStatus(s);
          if (!s.recording && s.name) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          }
        }
      } catch (err) {
        console.warn('Error polling route status:', err);
      }
    };

    pollTimerRef.current = window.setInterval(poll, 1000);
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, status?.recording]);

  // Initial check on modal open
  useEffect(() => {
    if (isOpen) {
      getStatusApi().then((s) => {
        if (s && s.recording) {
          setStatus(s);
        } else {
          setStatus(null);
        }
      });
    } else {
      setStatus(null);
      setIsStarting(false);
      setIsStopping(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeName.trim() || isStarting) return;

    setIsStarting(true);
    try {
      const res = await startRecordApi(routeName.trim());
      if (res.ok) {
        const initialStatus = await getStatusApi();
        setStatus(initialStatus);
      } else {
        onToast({
          type: 'error',
          message: res.error || 'Не удалось начать запись маршрута',
        });
      }
    } catch (err: any) {
      onToast({
        type: 'error',
        message: err?.message || 'Ошибка запуска записи маршрута',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinishAndSave = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      const res = await stopRecordApi(true);
      if (res.ok && res.route) {
        const routeType = res.route.loop ? 'круг' : 'туда-обратно';
        onToast({
          type: 'success',
          message: `Маршрут «${res.route.name}» сохранён: ${res.route.points} точек, ${routeType}, ≈${res.route.length_s} с бега`,
        });
        onRouteSaved(res.route);
        onClose();
      } else {
        onToast({
          type: 'error',
          message: `Маршрут не сохранён: ${res.error || 'маршрут слишком короткий'}`,
        });
        setStatus(null);
        onClose();
      }
    } catch (err: any) {
      onToast({
        type: 'error',
        message: `Маршрут не сохранён: ${err?.message || 'ошибка при сохранении'}`,
      });
      setStatus(null);
      onClose();
    } finally {
      setIsStopping(false);
    }
  };

  const handleCancelRecord = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      await stopRecordApi(false);
      onToast({
        type: 'info',
        message: 'Запись отменена',
      });
    } catch (err) {
      console.warn(err);
    } finally {
      setIsStopping(false);
      setStatus(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-3 bg-black/85 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-[500px] bg-[#090b10] border border-cyan-900/60 rounded-xl shadow-[0_0_35px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col text-zinc-200">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-[#06080d] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-black uppercase tracking-wider text-zinc-100">
              {status?.recording ? 'ИДЁТ ЗАПИСЬ МАРШРУТА' : 'ЗАПИСАТЬ МАРШРУТ ФАРМА'}
            </span>
          </div>

          <button
            onClick={status?.recording ? handleCancelRecord : onClose}
            className="w-6 h-6 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Start dialog if not currently recording */}
        {!status?.recording ? (
          <form onSubmit={handleStart} className="p-4 space-y-3.5">
            <div className="text-[11px] text-zinc-300 leading-relaxed bg-[#0c1018] p-3 rounded-lg border border-zinc-800/60">
              <p className="font-semibold text-cyan-300 mb-1">Как записать маршрут:</p>
              <ul className="list-disc list-inside space-y-0.5 text-zinc-400">
                <li>Зайдите в игру за персонажа в зоне фарма.</li>
                <li>Нажмите «Начать запись» и пробегите желаемый круг или линию.</li>
                <li>Бот будет считывать координаты с карты автоматически.</li>
                <li>По окончании круга нажмите «Закончить и сохранить».</li>
              </ul>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1 tracking-wider">
                Название маршрута
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Например: Побережье мурлоков"
                maxLength={40}
                required
                className="w-full h-8 px-2.5 bg-[#05070a] border border-cyan-900/60 rounded-md text-xs font-mono text-cyan-200 placeholder-zinc-600 focus:outline-hidden focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isStarting || !routeName.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 transition-all cursor-pointer active:scale-95"
              >
                {isStarting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>Начать запись</span>
              </button>
            </div>
          </form>
        ) : (
          /* Active Recording HUD */
          <div className="p-3 space-y-2 flex flex-col">
            {/* Top Status Line: «Карта {map_id} · Точек {N} · {секунды записи} с · ≈{length_s} с бега» */}
            <div className="flex items-center justify-between text-[10.5px] font-mono bg-[#05070a] px-3 py-1.5 rounded-lg border border-zinc-800/80 text-zinc-300">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                <span className="text-rose-400 font-bold">REC</span>
                <span className="text-zinc-500">·</span>
                <span>Карта {status.map_id ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>Точек <strong className="text-cyan-300">{status.points?.length || 0}</strong></span>
                <span className="text-zinc-500">·</span>
                <span>{status.seconds} с</span>
                <span className="text-zinc-500">·</span>
                <span className="text-amber-300 font-bold">≈{status.length_s} с бега</span>
              </div>
            </div>

            {/* Warning banner if any */}
            {status.warning && (
              <div className="bg-amber-950/40 border border-amber-600/70 text-amber-300 px-2.5 py-1.5 rounded-md text-[11px] font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Canvas: full width, height ~220px */}
            <div className="h-[220px] w-full bg-[#05070b] border border-cyan-900/40 rounded-lg overflow-hidden relative shadow-inner">
              <RouteCanvas
                points={status.points || []}
                mapId={status.map_id}
                mode="live_record"
                aspect={1.5}
                loop={false}
              />
            </div>

            {/* Caption below canvas */}
            <p className="text-[9.5px] font-mono text-zinc-500 text-center select-none">
              Запись идёт сама. Бот ничего не нажимает. Вернись к старту — получится круг.
            </p>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
              <button
                type="button"
                onClick={handleCancelRecord}
                disabled={isStopping}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/60 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 text-rose-500 fill-rose-500" />
                <span>Отменить запись</span>
              </button>

              <button
                type="button"
                onClick={handleFinishAndSave}
                disabled={isStopping || (status.points?.length || 0) < 2}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-50 transition-all cursor-pointer active:scale-95"
              >
                {isStopping ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                <span>Закончить и сохранить</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
