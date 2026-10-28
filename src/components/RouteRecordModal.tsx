import React, { useState, useEffect, useRef } from 'react';
import { RouteInfo, RouteRecordStatus, TerrainStatus } from '../types';
import { ThreeRouteRecordView } from './ThreeRouteRecordView';
import { ThreeWaypointOrb } from './ThreeWaypointOrb';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockStartRouteRecord,
  mockStopRouteRecord,
  mockGetRouteRecordStatus,
} from '../data/mockRoutes';
import { AlertTriangle, Check, X, Loader2, Play, Footprints, Clock } from 'lucide-react';

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
          message: `Маршрут не сохранён: ${res.error || 'слишком короткий'}`,
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

  // Format seconds to mm:ss
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-xs animate-fadeIn select-none overflow-y-auto">
      {/* =========================================================================
          State 1: Before Recording Starts — Compact 3D Rectangular Strip
         ========================================================================= */}
      {!status?.recording ? (
        <div className="w-[94%] max-w-[400px] sm:max-w-[420px] bg-[#040812]/98 border border-cyan-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.98),0_0_20px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col text-zinc-200 animate-screen-assemble relative my-auto">
          {/* Top Neon Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-85 shadow-[0_0_8px_#22d3ee]" />

          {/* Minimalist Header with 3D Holographic Waypoint Orb */}
          <div className="px-3 py-1.5 bg-[#02050a] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5">
              <ThreeWaypointOrb className="w-6 h-6" />
              <span className="text-[11px] font-mono font-black uppercase tracking-wider text-zinc-100">
                Запись маршрута
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Закрыть"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Minimalist Horizontal Bar Layout: Input + Actions in a single sleek row */}
          <form onSubmit={handleStart} className="p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="Имя маршрута (напр. Круг 1)"
                maxLength={40}
                autoFocus
                required
                className="flex-1 min-w-0 h-8 px-2.5 bg-[#020408] border border-cyan-900/60 focus:border-cyan-400 rounded-xl text-xs font-mono text-cyan-200 placeholder-zinc-600 focus:outline-hidden focus:ring-1 focus:ring-cyan-400/40 transition-all shadow-inner"
              />

              <button
                type="button"
                onClick={onClose}
                className="h-8 px-2.5 rounded-xl text-xs font-mono text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer shrink-0"
              >
                Отмена
              </button>

              <button
                type="submit"
                disabled={isStarting || !routeName.trim()}
                className="h-8 px-3.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                {isStarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Начать</span>
              </button>
            </div>

            <p className="text-[9px] font-mono text-zinc-500 pl-0.5 leading-none truncate">
              Пробегите круг по месту фарма в игре — координаты запишутся сами.
            </p>
          </form>
        </div>
      ) : (
        /* =========================================================================
            State 2: Active Recording HUD — 3D Holographic Tactical Radar (100% Adaptive)
           ========================================================================= */
        <div className="w-[94%] max-w-[420px] sm:max-w-[440px] max-h-[90vh] bg-[#040812]/98 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.98),0_0_20px_rgba(6,182,212,0.18)] overflow-hidden flex flex-col text-zinc-200 animate-screen-assemble relative my-auto">
          {/* Top Neon Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 shadow-[0_0_8px_#22d3ee]" />

          {/* Header Bar */}
          <div className="px-2.5 py-1.5 bg-[#02050a] border-b border-zinc-800/80 flex items-center justify-between shrink-0">
            {/* Left: Live REC badge + Route Name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-90" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              </span>
              <span className="text-[9.5px] font-mono font-black text-rose-300 uppercase tracking-widest shrink-0">
                REC
              </span>
              <span className="text-zinc-600 font-mono text-xs">/</span>
              <span className="text-xs font-mono font-bold text-zinc-100 truncate max-w-[90px] sm:max-w-[120px]">
                {status.name || routeName}
              </span>
            </div>

            {/* Right: Telemetry Badges + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Digital Timer */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#020409] border border-cyan-950">
                <Clock className="w-2.5 h-2.5 text-cyan-400" />
                <span className="text-[11px] font-mono font-black text-cyan-300 tracking-wider">
                  {formatTimer(status.seconds)}
                </span>
              </div>

              {/* Points badge */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#020409] border border-zinc-800 text-[9.5px] font-mono text-zinc-300">
                <Footprints className="w-2.5 h-2.5 text-cyan-400" />
                <span>{status.points?.length || 0}</span>
              </div>

              {/* Length badge */}
              <div className="px-1.5 py-0.5 rounded-md bg-[#020409] border border-zinc-800 text-[9.5px] font-mono text-amber-300 font-bold">
                ≈{status.length_s}с
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCancelRecord}
                className="w-5 h-5 rounded-md flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Отменить запись"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3D WebGL Holographic Tactical Radar (Sleek height: 110-120px) */}
          <div className="p-2 flex flex-col gap-1.5">
            <div className="h-[110px] sm:h-[125px] w-full bg-[#010307] border border-cyan-900/60 rounded-xl overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
              <ThreeRouteRecordView
                points={status.points || []}
                mapId={status.map_id}
              />
            </div>

            {/* Warning if character is standing still */}
            {status.warning && (
              <div className="bg-amber-950/40 border border-amber-600/50 text-amber-300 px-2 py-0.5 rounded-lg text-[9px] font-mono flex items-center justify-center gap-1.5 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCancelRecord}
                disabled={isStopping}
                className="h-7.5 px-3 rounded-xl text-xs font-mono text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors cursor-pointer"
              >
                Отмена
              </button>

              <button
                type="button"
                onClick={handleFinishAndSave}
                disabled={isStopping || (status.points?.length || 0) < 2}
                className="h-7.5 px-3.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-black shadow-[0_0_15px_rgba(16,185,129,0.45)] disabled:opacity-40 transition-all cursor-pointer active:scale-95"
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
        </div>
      )}
    </div>
  );
};
