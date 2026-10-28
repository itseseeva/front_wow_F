import React, { useState, useEffect, useRef } from 'react';
import { RouteInfo, RouteRecordStatus, TerrainStatus } from '../types';
import { RouteCanvas } from './RouteCanvas';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockStartRouteRecord,
  mockStopRouteRecord,
  mockGetRouteRecordStatus,
} from '../data/mockRoutes';
import { Radio, AlertTriangle, Check, X, Loader2, Play } from 'lucide-react';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: RouteInfo, terrain?: TerrainStatus | null) => void;
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
        onRouteSaved(res.route, res.terrain);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-xs animate-fadeIn select-none">
      {/* Ultra-compact Cyber Capsule */}
      <div className="w-full max-w-[340px] bg-[#06080d]/98 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.98),0_0_25px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col text-zinc-200 animate-screen-assemble relative">
        {/* Top Animated Neon Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Header */}
        <div className="px-3 py-2.5 bg-[#04060a] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {status?.recording ? (
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-90" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,1)]" />
              </span>
            ) : (
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span className="text-[11px] font-mono font-black uppercase tracking-wider text-zinc-100">
              {status?.recording ? 'Запись пути' : 'Новый маршрут'}
            </span>
          </div>

          <button
            onClick={status?.recording ? handleCancelRecord : onClose}
            className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Закрыть"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* State 1: Before Recording Starts */}
        {!status?.recording ? (
          <form onSubmit={handleStart} className="p-3.5 space-y-3">
            <div>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Имя маршрута (напр. Маршрут 1)"
                maxLength={40}
                autoFocus
                required
                className="w-full h-9 px-3 bg-[#030508] border border-cyan-900/50 focus:border-cyan-400 rounded-xl text-xs font-mono text-cyan-200 placeholder-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-cyan-400/40 transition-all shadow-inner"
              />
            </div>

            {/* Micro hint */}
            <p className="text-[10px] font-mono text-zinc-400 text-center leading-tight">
              Пробегите круг в игре — бот запишет координаты сам
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="w-1/3 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={isStarting || !routeName.trim()}
                className="w-2/3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.35)] disabled:opacity-50 transition-all cursor-pointer active:scale-95"
              >
                {isStarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Начать</span>
              </button>
            </div>
          </form>
        ) : (
          /* State 2: Active Recording HUD */
          <div className="p-3 space-y-2.5 flex flex-col">
            {/* Live Canvas Preview */}
            <div className="h-[155px] w-full bg-[#020407] border border-cyan-950/70 rounded-xl overflow-hidden relative shadow-inner">
              <RouteCanvas
                points={status.points || []}
                mapId={status.map_id}
                mode="live_record"
                aspect={1.6}
                loop={false}
              />
              {/* Subtle pulsing live badge in canvas */}
              <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-[#020407]/90 border border-rose-500/50 text-[9px] font-mono font-bold text-rose-300 flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                <span>REC</span>
              </div>
            </div>

            {/* Warning banner if character is standing still */}
            {status.warning && (
              <div className="bg-amber-950/40 border border-amber-600/50 text-amber-300 px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center justify-center gap-1.5 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Cyber Metrics HUD Bar */}
            <div className="grid grid-cols-3 gap-1 py-1.5 px-2 rounded-xl bg-[#030508] border border-zinc-850 text-center font-mono">
              <div className="flex flex-col">
                <span className="text-[8.5px] text-zinc-500 uppercase tracking-wider">Точек</span>
                <span className="text-xs font-bold text-cyan-300">{status.points?.length || 0}</span>
              </div>
              <div className="flex flex-col border-x border-zinc-850/80">
                <span className="text-[8.5px] text-zinc-500 uppercase tracking-wider">Время</span>
                <span className="text-xs font-bold text-zinc-200">{status.seconds} с</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8.5px] text-zinc-500 uppercase tracking-wider">Бег</span>
                <span className="text-xs font-bold text-amber-300">≈{status.length_s} с</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCancelRecord}
                disabled={isStopping}
                className="w-1/3 py-2 rounded-xl text-xs font-mono text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleFinishAndSave}
                disabled={isStopping || (status.points?.length || 0) < 2}
                className="w-2/3 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)] disabled:opacity-40 transition-all cursor-pointer active:scale-95"
              >
                {isStopping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                <span>Сохранить</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
