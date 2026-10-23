import React, { useState, useEffect, useRef } from 'react';
import { RouteInfo, RouteRecordStatus } from '../types';
import { RouteCanvas } from './RouteCanvas';
import {
  mockStartRouteRecord,
  mockStopRouteRecord,
  mockGetRouteRecordStatus,
} from '../data/mockRoutes';
import { Radio, AlertTriangle, Square, Check, X, Loader2, MapPin } from 'lucide-react';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: RouteInfo) => void;
  onError: (msg: string) => void;
}

export const RouteRecordModal: React.FC<RouteRecordModalProps> = ({
  isOpen,
  onClose,
  onRouteSaved,
  onError,
}) => {
  const [routeName, setRouteName] = useState('Маршрут 1');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [status, setStatus] = useState<RouteRecordStatus | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  // Check backend bridge methods with fallback to mocks
  const startRecordApi = async (name: string) => {
    if (window.pywebview?.api?.start_route_record) {
      return await window.pywebview.api.start_route_record(name);
    }
    return await mockStartRouteRecord(name);
  };

  const stopRecordApi = async (save: boolean) => {
    if (window.pywebview?.api?.stop_route_record) {
      return await window.pywebview.api.stop_route_record(save);
    }
    return await mockStopRouteRecord(save);
  };

  const getStatusApi = async (): Promise<RouteRecordStatus> => {
    if (window.pywebview?.api?.get_route_record_status) {
      return await window.pywebview.api.get_route_record_status();
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
            // Stopped externally
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

  // Initial check on modal open if already recording
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
        onError(res.error || 'Не удалось начать запись маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка запуска записи маршрута');
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinishAndSave = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      const res = await stopRecordApi(true);
      if (res.ok) {
        if (res.route) {
          onRouteSaved(res.route);
        }
        onClose();
      } else {
        onError(res.error || 'Ошибка при сохранении маршрута');
      }
    } catch (err: any) {
      onError(err?.message || 'Ошибка сохранения');
    } finally {
      setIsStopping(false);
    }
  };

  const handleCancelRecord = async () => {
    if (isStopping) return;
    if (window.confirm('Отменить запись маршрута без сохранения?')) {
      setIsStopping(true);
      try {
        await stopRecordApi(false);
      } catch (err) {
        console.warn(err);
      } finally {
        setIsStopping(false);
        onClose();
      }
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-xs animate-fadeIn select-none">
      <div className="w-full max-w-[480px] bg-[#090b10] border border-cyan-900/60 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col text-zinc-200">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-[#06080d] border-b border-zinc-800/80 flex items-center justify-between">
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

        {/* Content */}
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
          <div className="p-3 space-y-2.5 flex flex-col">
            {/* Top HUD metrics */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="bg-[#05070a] border border-zinc-800/80 rounded-md py-1 px-1.5">
                <div className="flex items-center justify-center gap-1 text-[9px] font-mono text-rose-400 font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping inline-block" />
                  <span>REC</span>
                </div>
                <div className="text-xs font-mono font-black text-rose-300">
                  {formatTime(status.seconds)}
                </div>
              </div>

              <div className="bg-[#05070a] border border-zinc-800/80 rounded-md py-1 px-1.5">
                <div className="text-[9px] font-mono text-zinc-400 uppercase">Точек</div>
                <div className="text-xs font-mono font-black text-cyan-300">
                  {status.points?.length || 0}
                </div>
              </div>

              <div className="bg-[#05070a] border border-zinc-800/80 rounded-md py-1 px-1.5">
                <div className="text-[9px] font-mono text-zinc-400 uppercase">Длина</div>
                <div className="text-xs font-mono font-black text-amber-300">
                  {status.length_s} с
                </div>
              </div>

              <div className="bg-[#05070a] border border-zinc-800/80 rounded-md py-1 px-1.5">
                <div className="text-[9px] font-mono text-zinc-400 uppercase">Карта</div>
                <div className="text-xs font-mono font-black text-zinc-300">
                  {status.map_id ?? '—'}
                </div>
              </div>
            </div>

            {/* Warning banner if any */}
            {status.warning && (
              <div className="bg-amber-950/40 border border-amber-600/70 text-amber-300 px-2.5 py-1.5 rounded-md text-[11px] font-mono flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Live Minimap View */}
            <div className="h-44 w-full bg-[#05070b] border border-cyan-900/40 rounded-lg overflow-hidden relative shadow-inner">
              <RouteCanvas
                points={status.points || []}
                mode="live_record"
                aspect={1.5}
                loop={false}
              />
            </div>

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
                disabled={isStopping || (status.points?.length || 0) < 3}
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
